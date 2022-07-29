import axios from 'axios';
import xml2js from 'xml2js';
import { uniq } from 'lodash';
import { sleep } from './time';
import { ICountryType } from '../types/ICountryType';
import { IGoogleDomain } from '../types/IGoogleDomain';
import { ILanguageType } from '../types/ILanguageType';
import { cleanKeyword } from './keyword';

const SUGGEST_DEBUG = false;

const SPACE_RE = / /gi;

export const getGoogleSuggestionsForPhrase = async (
  kw: string,
  searchEngine: IGoogleDomain,
  language: ILanguageType,
  country: ICountryType,
): Promise<string[]> => {
  let match;
  let suggestions: string[] = await getGoogleSuggest(kw, searchEngine, language, country, 0);

  while ((match = SPACE_RE.exec(kw)) != null) {
    await sleep(400);

    const _sug = await getGoogleSuggest(kw, searchEngine, language, country, match.index + 1);
    suggestions = [...suggestions, ..._sug];
  }

  await sleep(400);

  const sug = await getGoogleSuggest(kw, searchEngine, language, country, kw.length - 1);
  suggestions = uniq([...suggestions, ...sug]);

  return suggestions;
};

export const extractGoogleAutoSuggestKeywords = (data: string): string[] => {
  const keywordsFound: string[] = [];

  let keywords = data.match(/"[a-zA-Z0-9À-ž\u2019\u003c\u003e\\ '\-/]+",0/gi);

  if (keywords) {
    keywords = keywords.map((k) => k.replace(/["\][,]/gi, ''));

    for (const item of keywords) {
      let key = item.replace(/["\][,]/gi, '');

      if (key && key.trim() !== '') {
        if (key.endsWith('0')) {
          key = key.slice(0, key.length - 1);
        }

        // open <b>
        key = key.replace(/\\u003cb\\u003e/gi, '');

        // close </b>
        key = key.replace(/\\u003c\\\/b\\u003e/gi, '');

        // single quote
        key = key.replace(/\\u2019/gi, "'");

        keywordsFound.push(key);
      }
    }
  }

  return keywordsFound;
};

export const getGoogleSuggest = async (
  search: string,
  domain: IGoogleDomain,
  language: ILanguageType,
  country: ICountryType,
  pointer: number,
) => {
  let google: string[] = [];

  try {
    const query = search.replace(/\s+/g, '%20');
    const suggestUrl = `https://www.${domain}/complete/search?gl=${country.toUpperCase()}&cr=${country.toUpperCase()}&cp=${
      pointer || 0
    }&client=gws-wiz&xssi=t&gs_ri=gws-wiz&hl=${language}-${country}&lr=lang_${language.toUpperCase()}&q=${query}&gs_mss=${query}$dpr=1`;

    const response = await axios.get(suggestUrl, {
      headers: {
        'User-Agent': process.env.GOOGLE_USER_AGENT || '',
      },
    });

    if (response) {
      if (response.data) {
        google = extractGoogleAutoSuggestKeywords(response.data);
      }
    }
  } catch (err) {
    console.error('Error getting data from Google', err, { domain, language, country, search });
  }

  if (google.length === 1 && google[0] === search) {
    return [];
  }

  if (SUGGEST_DEBUG) {
    console.log({ keywords: google, search, pointer });
  } else {
    console.log(`Generated ${google.length} keywords from ${search} at ${pointer}`);
  }

  return google.map((kw) => cleanKeyword(kw));
};
