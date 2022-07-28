import { IDiscovery } from '../../types/IDiscovery';
import { uniqBy } from 'lodash';
import { getGoogleSuggest, getGoogleSuggestionsForPhrase } from '../../shared/suggest';
import { ALPHABET } from '../../shared/text';
import { sleep } from '../../shared/time';

export const getSuggestionsForWildcard = async (
  rootSeed: string,
  report: Pick<IDiscovery, 'location' | 'language' | 'searchEngine'>,
): Promise<string[]> => {
  const suggestions: string[] = [];

  if (!rootSeed.includes('*')) {
    return suggestions;
  }

  const wildcardCount = rootSeed.match(/\*/gi)?.length;

  const mainSuggestions = await getGoogleSuggestionsForPhrase(rootSeed, report.searchEngine, report.language, report.location);
  for (const suggestion of mainSuggestions) {
    suggestions.push(suggestion);
  }

  if (!rootSeed.endsWith('*') && wildcardCount === 1) {
    const rootSeedB = `${rootSeed} *`;
    const suggestionsB = await getGoogleSuggestionsForPhrase(rootSeedB, report.searchEngine, report.language, report.location);
    for (const suggestion of suggestionsB.filter((sug) => !mainSuggestions.includes(sug))) {
      suggestions.push(suggestion);
    }
  }

  if (wildcardCount === 1) {
    const parts = rootSeed.split('*').map((part) => part.trim());
    for (const letter of ALPHABET) {
      await sleep(400);

      const mod = `${parts[0]} ${letter}`;
      const seed = `${mod} ${parts[1]}`.trim();
      const googleSuggestions = await getGoogleSuggest(seed, report.searchEngine, report.language, report.location, mod.length);
      for (const sug of googleSuggestions) {
        suggestions.push(sug);
      }
    }
  } else if (wildcardCount === 2) {
    const indexOfFirstWildcard = rootSeed.indexOf('*');
    const indexOfSecondWildcard = rootSeed.indexOf('*', indexOfFirstWildcard + 1);
    for (const letter of ALPHABET) {
      const seed = rootSeed.substring(0, indexOfSecondWildcard) + letter + rootSeed.substring(indexOfSecondWildcard + 1).trim();
      const googleSuggestions = await getGoogleSuggest(seed, report.searchEngine, report.language, report.location, indexOfSecondWildcard);
      for (const sug of googleSuggestions) {
        if (sug.includes('*')) {
          continue;
        }
        suggestions.push(sug);
      }
    }
  }

  const filtered = suggestions.filter((suggestion) => suggestion !== rootSeed);
  return uniqBy(filtered, 'suggestion');
};
