import { getSuggestionsForWildcard } from './getSuggestionsForWildcard';
import { getSuggestionsForQuestions } from './getSuggestionsForQuestions';

import { IDiscovery } from '../../types/IDiscovery';
import { SEARCH_TYPE_QUESTIONS, SEARCH_TYPE_WILDCARD } from '../../types/IDiscoverySearchType';
import { getExtraSuggestions } from './getExtraSuggestions';
import { uniq } from 'lodash';

export const generateSuggestions = async (
  rootSeed: string,
  report: Pick<IDiscovery, '_id' | 'location' | 'language' | 'searchEngine' | 'searchType'>,
) => {
  let suggestions: string[] = [];
  if (report.searchType === SEARCH_TYPE_QUESTIONS) {
    suggestions = await getSuggestionsForQuestions(rootSeed, report);
  } else if (report.searchType === SEARCH_TYPE_WILDCARD) {
    suggestions = await getSuggestionsForWildcard(rootSeed, report);
  }

  if (suggestions.length > 0 && report.searchType === SEARCH_TYPE_QUESTIONS) {
    const extras = await getExtraSuggestions(report, rootSeed, suggestions);
    if (extras.length > 0) {
      console.log(`[discovery-suggest]: Got ${extras.length} extra suggestions`);
      suggestions.push(...extras);
    }

    suggestions = suggestions.filter((sug) => {
      return sug.split(' ').length <= 10 && sug.includes(rootSeed);
    });
  } else if (suggestions.length > 0 && report.searchType === SEARCH_TYPE_WILDCARD) {
    suggestions = suggestions.filter((sug) => {
      return sug.split(' ').length <= 10;
    });
  }

  return uniq(suggestions);
};
