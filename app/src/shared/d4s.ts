import { flatten, uniq } from 'lodash';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

import { cleanKeyword } from './keyword';

import { FEATURED_SNIPPET, ORGANIC, PAA } from '../types/ISerpFeature';
import { ISerpData } from '../types/ISerpData';
import { ID4SResponse } from '../types/ID4SResponse';
import { ID4SSerpRequest } from '../types/ID4SSerpRequest';
import { ObjectId } from 'mongodb';
import { dbUpdateDiscoveryItem } from '../db/discovery-item';
import { IDiscoverySerpItem } from '../types/IDiscoverySerpItem';
import { ID4SRankedKeywords } from '../types/ID4SRankedKeywords';

export interface IGetSerpResult {
  keyword: string;
  newKeywords: string[];
}

export const d4sPOST = async <TResponse, TData>(ax: AxiosInstance, path: string, data: TData): Promise<TResponse | undefined> => {
  let response: AxiosResponse | undefined;

  try {
    response = await ax.post(`https://api.dataforseo.com${path}`, data);
  } catch (err: any) {
    if (err.data && err.data.status_message) {
      console.error(err.data.status_message);
    } else if (err.response) {
      if (err.response.data) {
        console.error(err.response.data);
      } else {
        console.error(err.response.statusText);
      }
    } else {
      console.error(err);
    }
  }

  return response && response.data;
};

export const getD4SSerpAdvanced = async (
  username: string,
  password: string,
  keyword: string,
  location: string,
  domain: string,
  language: string,
  os: string,
  device: string,
  limit: number,
): Promise<ISerpData | undefined> => {
  return new Promise((resolve) => {
    const authorization = Buffer.from(`${username}:${password}`).toString('base64');
    const ax = axios.create({
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-type': 'application/json',
      },
    });

    let serp: ISerpData | undefined;

    d4sPOST<ID4SResponse, ID4SSerpRequest>(ax, '/v3/serp/google/organic/live/advanced', {
      0: {
        os,
        device,
        depth: limit,
        se_domain: domain,
        location_name: location,
        language_code: language,
        keyword: keyword.toLowerCase(),
      },
    })
      .then((response) => {
        if (response && response.tasks && response.tasks[0] && response.tasks[0].result && response.tasks[0].result[0]) {
          const data = response.tasks[0].result[0];
          if (data) {
            serp = {
              items: data.items,
              cost: response.cost,
              time: response.time,
              check_url: data.check_url,
              item_types: data.item_types,
              total_results: data.se_results_count,
            };
            resolve(serp);
          } else {
            console.log(response);
            resolve(undefined);
          }
        } else {
          console.log(response);
          console.log({
            location,
            keyword,
            domain,
            language,
            os,
            device,
            limit,
          });
          resolve(undefined);
        }
      })
      .catch(() => resolve(undefined));
  });
};

export const updateDiscoveryItemSerp = async (
  reportId: ObjectId,
  keyword: string,
  serpLocation: string,
  language: string,
  searchEngine: string,
  d4sUser: string,
  d4sPassword: string,
): Promise<IGetSerpResult | undefined> => {
  let d4sSerp: ISerpData | undefined;
  try {
    d4sSerp = await getD4SSerpAdvanced(d4sUser, d4sPassword, keyword, serpLocation, searchEngine, language, 'windows', 'desktop', 100);
  } catch (err) {
    console.error(err);
  }

  if (d4sSerp) {
    const foundPaa = d4sSerp.items.filter((item) => item.type === PAA) as Array<{ items: Array<{ title: string }> }>;
    const paa: string[] = flatten(foundPaa.map((item) => item.items.map((i) => i.title)));
    const bolded: string[] = flatten(d4sSerp.items.filter((pos) => pos.type === ORGANIC).map((item) => item.highlighted || []));

    const foundRelated = d4sSerp.items.filter((item) => item.type === 'related_searches') as Array<{ items: string[] }>;
    const foundAlsoSearch = d4sSerp.items.filter((item) => item.type === 'people_also_search') as Array<{ items: string[] }>;
    const foundQuestionsAndAnswers = d4sSerp.items.filter((item) => item.type === 'questions_and_answers') as Array<{
      items: Array<{ question_text?: string }>;
    }>;
    const related: string[] = flatten(foundRelated.map((item) => item.items));
    const alsoSearch: string[] = flatten(foundAlsoSearch.map((item) => item.items));
    const questionsAndAnswers: string[] = flatten(foundQuestionsAndAnswers.map((item) => item.items.map((i) => i.question_text || '')));
    const allRelated = uniq([...related, ...alsoSearch, ...questionsAndAnswers])
      .filter((kw) => kw !== '')
      .map((kw) => cleanKeyword(kw));

    const foundExtendedPeopleAlsoAsk = d4sSerp.items
      .filter((item) => item.extended_people_also_search && Array.isArray(item.extended_people_also_search))
      .map((item) => item.extended_people_also_search) as string[][];
    const extended = flatten(foundExtendedPeopleAlsoAsk).map((kw) => cleanKeyword(kw));

    const newKeywords = uniq([...allRelated, ...extended, ...paa.map((kw) => cleanKeyword(kw))]).filter((kw) => kw !== '');

    const allOrganic = d4sSerp.items.filter((item) => item.url && item.type === 'organic');
    const urlsAll: Array<{ url: string; position: number }> = allOrganic.map((item) => ({
      url: item.url || '',
      position: item.rank_group,
    }));
    const urlsTop: IDiscoverySerpItem[] = allOrganic.slice(0, 10).map((item) => {
      return {
        title: item.title,
        url: item.url || '',
        position: item.rank_group,
        description: item.description,
      };
    });

    const featuredSnippet = d4sSerp.items.find((item) => item.type === FEATURED_SNIPPET);

    const pills = flatten(
      d4sSerp.items.filter((item) => item.type === 'images').map((item) => (item.related_image_searches || []).map((i) => i.title)),
    );

    await dbUpdateDiscoveryItem(reportId, keyword, {
      urlsTop,
      urlsAll,
      serpData: d4sSerp,
      serpUpdatedAt: new Date(),
      googleUrl: d4sSerp.check_url,
      pills: uniq(pills.map((kw) => cleanKeyword(kw))),
      paa: uniq(paa.map((kw) => cleanKeyword(kw))),
      bolded: uniq(bolded.map((kw) => cleanKeyword(kw))),
      serpFeatures: d4sSerp.item_types.filter((item) => item !== 'organic'),
      related: uniq([...extended, ...allRelated].map((kw) => cleanKeyword(kw))),
      featuredSnippet: featuredSnippet
        ? {
            position: 0,
            url: featuredSnippet.url,
            title: featuredSnippet.title,
            description: featuredSnippet.description,
          }
        : undefined,
    });

    return {
      keyword,
      newKeywords,
    };
  } else {
    console.log(`[getSerp]: No D4S serp for keyword: ${keyword}, ${serpLocation}, ${language}, ${searchEngine}`);
  }

  return undefined;
};

export const getD4SRankedKeywords = async (
  username: string,
  password: string,
  domain: string,
  pathname: string | undefined,
  location: string,
  seDomain: string,
  language: string,
): Promise<string[] | undefined> => {
  return new Promise((resolve) => {
    const authorization = Buffer.from(`${username}:${password}`).toString('base64');
    const ax = axios.create({
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-type': 'application/json',
      },
    });

    let filters;
    if (pathname) {
      console.log(`[getD4SRankedKeywords]: Using domain: ${domain}, pathname: ${pathname}`);
      filters = [
        ['ranked_serp_element.serp_item.type', '=', 'organic'],
        'and',
        ['ranked_serp_element.serp_item.relative_url', '=', pathname],
        'and',
        ['ranked_serp_element.serp_item.rank_group', '<=', 10],
        'and',
        ['keyword_data.keyword_info.search_volume', '>=', 10],
      ];
    } else {
      console.log(`[getD4SRankedKeywords]: Using domain: ${domain}`);
      filters = [
        ['ranked_serp_element.serp_item.type', '=', 'organic'],
        'and',
        ['ranked_serp_element.serp_item.rank_group', '<=', 10],
        'and',
        ['keyword_data.keyword_info.search_volume', '>=', 10],
      ];
    }

    const params = {
      0: {
        limit: 1000,
        offset: 1,
        filters,
        target: domain,
        se_domain: seDomain,
        location_name: location,
        language_code: language,
        item_types: ['organic', 'featured_snippet'],
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      },
    };

    d4sPOST<ID4SRankedKeywords | undefined, typeof params>(ax, '/v3/dataforseo_labs/ranked_keywords/live', params)
      .then((rankedKeywords) => {
        let keywords: string[] | undefined;

        if (rankedKeywords && rankedKeywords.tasks_error !== 0) {
          console.error(`[getD4SRankedKeywords]: Error getting keywords`);
          console.log(rankedKeywords);
          resolve(undefined);
        }

        if (rankedKeywords && rankedKeywords.tasks_count === 1) {
          if (
            rankedKeywords.tasks?.length === 1 &&
            rankedKeywords.tasks[0].result_count > 0 &&
            rankedKeywords.tasks[0].result.length > 0 &&
            rankedKeywords.tasks[0].result[0].items
          ) {
            console.log(`[getD4SRankedKeywords]: Cost for keywords was: ${rankedKeywords.tasks[0].cost}`);

            if (!keywords) {
              keywords = [];
            }

            const keywordsFound = rankedKeywords.tasks[0].result[0].items;
            console.log(`[getD4SRankedKeywords]: Found ${keywordsFound.length} keywords`);

            for (const item of keywordsFound) {
              keywords.push(cleanKeyword(item.keyword_data.keyword));
            }
          }
        } else {
          console.error('[getD4SRankedKeywords]: There seems to be an error getting keywords from D4S');
          console.error('[getD4SRankedKeywords]: Errors on D4S Keyword Ranked' + rankedKeywords?.tasks_error);
        }

        resolve(keywords);
      })
      .catch((err) => {
        console.error(err);
        resolve(undefined);
      });
  });
};
