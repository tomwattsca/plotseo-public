import { debounce, uniq } from 'lodash';
import { trpc } from '../../../utils';
import isURL from 'validator/lib/isURL';
import Button from '../../../components/Button';
import AutoComplete from 'antd/es/auto-complete';
import { ICountry } from '../../../../types/ICountry';
import { ENGLISH } from '../../../../types/ILanguageType';
import InputWithIcon from '../../../components/InputWithIcon';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { GOOGLE_CANADA, GOOGLE_UK, GOOGLE_US, SEARCH_ENGINES } from '../../../../types/IGoogleDomain';
import { CANADA_CODE, UNITED_KINGDOM_CODE, UNITED_STATES_CODE } from '../../../../types/ICountryType';
import { API_URL, DEFAULT_SERP_LOCATION, MAX_CUSTOM_KEYWORDS } from '../../../../constants';
import {
  SEARCH_TYPE_URL,
  SEARCH_TYPE_CUSTOM,
  SEARCH_TYPE_WILDCARD,
  IDiscoverySearchType,
  SEARCH_TYPE_QUESTIONS,
} from '../../../../types/IDiscoverySearchType';

export const LANGUAGES = [{ name: 'English', code: 'en' }];

export const COUNTRIES: ICountry[] = [
  {
    code: 'us',
    name: 'United States',
  },
  {
    code: 'ca',
    name: 'Canada',
  },
  {
    code: 'uk',
    name: 'United Kingdom',
  },
];

interface Props {
  close: () => void;
}

const NewDiscoverySection = ({ close }: Props) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [canSubmit, setCanSubmit] = useState(false);
  const [seedKeyword, setSeedKeyword] = useState('');
  const [location, setLocation] = useState(DEFAULT_SERP_LOCATION);
  const [tmpDisabled, setTmpDisabled] = useState(false);
  const [customKeywords, setCustomKeywords] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [language, setLanguage] = useState<typeof ENGLISH>(ENGLISH);
  const [type, setType] = useState<IDiscoverySearchType>(SEARCH_TYPE_QUESTIONS);
  const [searchEngine, setSearchEngine] = useState<typeof GOOGLE_US | typeof GOOGLE_UK | typeof GOOGLE_CANADA>(GOOGLE_US);
  const [country, setCountry] = useState<typeof UNITED_STATES_CODE | typeof CANADA_CODE | typeof UNITED_KINGDOM_CODE>(UNITED_STATES_CODE);

  const createDiscovery = trpc.useMutation('discovery:create', {
    onSuccess: (data) => {
      if (data.success && data.id) {
        setTimeout(() => {
          window.location.href = `/discovery/${data.id}`;
        }, 1500);
      } else {
        setCanSubmit(true);

        if (!data.success) {
          setError(
            'Something went wrong, we could not create your report. If this happens again please contact us at contact@seoruler.tools',
          );
        }
      }
    },
  });

  const handleSubmit = useCallback(
    (keywords: string[]) => {
      if (canSubmit) {
        createDiscovery.mutate({
          url,
          name,
          language,
          keywords,
          searchEngine,
          searchType: type,
          location: country,
          easyWinsPatterns: [],
          easyWinsDefaults: true,
          serpLocation: location,
          competitorPatterns: [],
          seed: type === SEARCH_TYPE_QUESTIONS || type === SEARCH_TYPE_WILDCARD ? seedKeyword.trim().toLowerCase() : undefined,
        });
      }
    },
    [canSubmit, country, createDiscovery, language, location, name, searchEngine, seedKeyword, type, url],
  );

  useEffect(() => {
    let errorMsg = '';

    const seedNeeded = type === SEARCH_TYPE_QUESTIONS || type === SEARCH_TYPE_WILDCARD;

    if (!name) {
      errorMsg = 'Please enter a name for your report';
    } else if (!type) {
      errorMsg = 'Please select a search type';
    } else if (seedNeeded && !seedKeyword) {
      errorMsg = 'Please enter a seed keyword';
    } else if (!location) {
      errorMsg = 'Please select a SERP location';
    } else if (!country) {
      errorMsg = 'Please select a country';
    } else if (!searchEngine) {
      errorMsg = 'Please select a search engine';
    } else if (type === SEARCH_TYPE_URL && !url) {
      errorMsg = 'Please enter a URL';
    } else if (
      type === SEARCH_TYPE_URL &&
      !isURL(url, {
        require_host: true,
        require_port: false,
        allow_fragments: false,
        protocols: ['http', 'https'],
        require_valid_protocol: true,
      })
    ) {
      errorMsg = 'Please enter a valid URL';
    } else if (seedNeeded && type !== SEARCH_TYPE_WILDCARD && seedKeyword.includes('*')) {
      errorMsg = 'You can only use * with wildcard search';
    } else if (type === SEARCH_TYPE_CUSTOM && (customKeywords.includes(',') || customKeywords.includes('*'))) {
      errorMsg = 'Custom keywords cannot contain commas or asterisks';
    } else if (type === SEARCH_TYPE_CUSTOM && customKeywords.length === 0) {
      errorMsg = 'Please enter at least one custom keyword';
    } else if (type === SEARCH_TYPE_WILDCARD && seedKeyword.split('*').length > 3) {
      errorMsg = 'Seed keyword cannot contain more than two wildcards';
    } else if (type === SEARCH_TYPE_WILDCARD && !seedKeyword.includes('*')) {
      errorMsg = 'Wildcard search requires one wildcard character';
    } else if (seedNeeded && seedKeyword.length <= 1) {
      errorMsg = 'Seed keyword must be at least 2 characters long';
    }

    setError(errorMsg);
    setCanSubmit(errorMsg === '');
  }, [seedKeyword, customKeywords, location, type, country, searchEngine, name, url]);

  const getLocations = useCallback(
    async (s: string) => {
      const response = await fetch(API_URL + '/location', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search: s,
        }),
      });

      const data: { locations: string[] } = await response.json();

      if (data.locations.length > 0) {
        setLocations(data.locations);
      }
    },
    [setLocations],
  );

  const getLocationsDebounced = debounce(getLocations, 500);

  return (
    <div>
      <div className="bg-white px-3 pb-1 shadow overflow-hidden sm:rounded-md select-none">
        <div className="text-lg text-slate-700 py-2">Create New Discovery Report</div>
        <div className="pb-2">
          <div className="text-base font-medium text-slate-500 mb-1 mt-1">Report Name</div>
          <InputWithIcon value={name} label="Report Name" className="w-full mb-3" placeholder="Report Name" onChange={(e) => setName(e)} />
          <div className="text-base font-medium text-slate-600 mb-1 mt-1">What do you want to do?</div>
          <select
            value={type}
            onChange={(e) => {
              if (e.target.value !== SEARCH_TYPE_CUSTOM) {
                setCustomKeywords('');
              }
              setType(e.target.value as IDiscoverySearchType);
            }}
            className="focus:ring-indigo-500 focus:border-indigo-500 w-full shadow-sm text-sm border-gray-300 rounded-md"
          >
            <option value={SEARCH_TYPE_CUSTOM}>Add my own keywords</option>
            <option value={SEARCH_TYPE_URL}>Get keywords for a URL</option>
            <option value={SEARCH_TYPE_QUESTIONS}>Discover question keywords</option>
            <option value={SEARCH_TYPE_WILDCARD}>Wildcard search suggestions</option>
          </select>
          {(type === SEARCH_TYPE_QUESTIONS || type === SEARCH_TYPE_WILDCARD) && (
            <Fragment>
              <div className="text-base font-medium text-slate-500 mt-3 mb-1">Seed Keyword</div>
              <InputWithIcon
                value={seedKeyword}
                label="Seed Keyword"
                className="w-full"
                placeholder="Seed Keyword"
                onChange={(e) => setSeedKeyword(e)}
              />
            </Fragment>
          )}
          {type === SEARCH_TYPE_URL && (
            <Fragment>
              <div className="text-base font-medium text-slate-500 mb-1 mt-3">Domain or URL</div>
              <InputWithIcon
                value={url}
                label="Domain or URL"
                className="w-full mb-1"
                placeholder="Domain or URL"
                onChange={(e) => setUrl(e)}
              />
              <div className="text-xs text-slate-600 mb-1.5">
                Include protocol. Example: <span className="italic">https://www.example.com/blog/post</span>
              </div>
            </Fragment>
          )}
          {type === SEARCH_TYPE_CUSTOM && (
            <Fragment>
              <div className="text-base font-medium text-slate-500 mt-3 mb-1">Custom Keywords</div>
              <textarea
                rows={3}
                value={customKeywords}
                disabled={type !== SEARCH_TYPE_CUSTOM}
                onChange={(e) => setCustomKeywords(e.target.value || '')}
                className={`w-full shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm border border-gray-300 ${
                  type !== SEARCH_TYPE_CUSTOM ? 'bg-slate-50' : ''
                } rounded-md`}
              />
              <div className="text-xs text-slate-600 mb-1.5">One keyword per line</div>
            </Fragment>
          )}
          <div className="font-semibold text-slate-500 mb-1 mt-3 select-none">Google Domain</div>
          <select
            value={searchEngine}
            onChange={(e) => setSearchEngine(e.target.value as any)}
            className="focus:ring-indigo-500 focus:border-indigo-500 w-full shadow-sm text-sm border-gray-300 rounded-md"
          >
            {SEARCH_ENGINES.map((item) => {
              return (
                <option key={item} value={item}>
                  {item}
                </option>
              );
            })}
          </select>
          <div className="text-base font-medium text-slate-500 mb-1 mt-3 select-none">Country</div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as any)}
            className="focus:ring-indigo-500 focus:border-indigo-500 w-full shadow-sm text-sm border-gray-300 rounded-md"
          >
            {COUNTRIES.map((item) => {
              return (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              );
            })}
          </select>
          <div className="font-semibold text-slate-500 mb-1 mt-3 select-none">Language</div>
          <select
            value={language}
            disabled={true}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="focus:ring-indigo-500 focus:border-indigo-500 w-full shadow-sm text-sm border-gray-300 rounded-md"
          >
            {LANGUAGES.map((item) => {
              return (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              );
            })}
          </select>
          <div className="text-xs text-slate-500 mt-1.5">Only English is supported right now</div>
          <div className="font-semibold text-slate-500 mb-1 mt-3 select-none">Location when Scraping the SERP</div>
          <AutoComplete
            defaultValue={location}
            style={{ width: '100%' }}
            onSearch={getLocationsDebounced}
            placeholder="Type a location, then select"
            onSelect={(s: string) => setLocation(s || '')}
            options={locations.map((l) => ({ value: l }))}
            onChange={(e) => {
              if (e === '') {
                setLocation('');
              }
            }}
          />
          <p className="text-xs text-slate-500 mt-2 mb-0 leading-none select-none">Used when getting SERP data</p>
          {error && <div className="px-3 py-2 rounded bg-red-100 text-red-800 text-sm mt-3">{error}</div>}
          <div className="px-3 py-2 bg-sky-50 text-sky-700 rounded mt-2">
            You can set competitors and other settings inside your report.
          </div>
          <Button
            className="mt-2"
            text="Create Report"
            color="text-white bg-lime-600 hover:bg-lime-700"
            disabled={!canSubmit || tmpDisabled}
            onClick={() => {
              if (canSubmit) {
                let keywords: string[] = [];
                if (type === SEARCH_TYPE_CUSTOM) {
                  keywords = uniq(
                    customKeywords
                      .split('\n')
                      .map((k) => k.trim())
                      .filter((k) => k.length > 0),
                  );

                  if (keywords.length > MAX_CUSTOM_KEYWORDS) {
                    setError(`You can only enter ${MAX_CUSTOM_KEYWORDS} custom keywords`);
                    setCanSubmit(false);
                    return;
                  }
                }

                handleSubmit(keywords);
                setTmpDisabled(true);
              }
            }}
          />
          <Button
            text="Cancel"
            className="ml-2"
            color={`text-white bg-red-400 hover:bg-red-500`}
            onClick={() => {
              close();
              setCanSubmit(true);
              setTmpDisabled(false);
              setCustomKeywords('');
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NewDiscoverySection;
