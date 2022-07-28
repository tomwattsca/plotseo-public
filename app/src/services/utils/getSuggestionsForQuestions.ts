import { uniq } from 'lodash';

import { sleep } from '../../shared/time';
import { IDiscovery } from '../../types/IDiscovery';
import { QUESTIONS } from '../../shared/text';
import { getGoogleSuggest } from '../../shared/suggest';
import { getExtraModifiersFromQuestionSuggestion } from './getExtraModifiersFromQuestionSuggestion';

interface ISuggestionResponse {
  extraModifiers: string[];
  suggestions: string[];
}

const POOL_SIZE = 2;

export const getSuggestionsForQuestion = async (
  rootSeed: string,
  report: Pick<IDiscovery, 'location' | 'language' | 'searchEngine'>,
  questionMod: string,
): Promise<ISuggestionResponse> => {
  let extraModifiers: string[] = [];
  const suggestions: string[] = [];

  const seed = `${questionMod} ${rootSeed}`;
  const seedA = `${questionMod} ${rootSeed} *`;
  const seedB = `${questionMod} * ${rootSeed} *`;
  const googleSuggestions = await getGoogleSuggest(seed, report.searchEngine, report.language, report.location, seed.length - 1);
  const googleSuggestionsA = await getGoogleSuggest(seedA, report.searchEngine, report.language, report.location, seedA.length - 1);
  const googleSuggestionsB = await getGoogleSuggest(seedB, report.searchEngine, report.language, report.location, seedB.length - 1);

  for (const sug of uniq([...googleSuggestions, ...googleSuggestionsA, ...googleSuggestionsB])) {
    try {
      const extra = getExtraModifiersFromQuestionSuggestion(sug, questionMod, rootSeed);
      if (extra) {
        extraModifiers = [...extraModifiers, ...extra];
      }
    } catch (err) {
      console.error(`Error getting extra modifiers for ${questionMod} ${rootSeed}`);
      console.error(err);
    }

    if (sug !== seed) {
      suggestions.push(sug);
    }
  }

  if (extraModifiers.length > 0) {
    extraModifiers = uniq(extraModifiers.filter((extra) => extra.split(' ').length > 1));
    console.log(`[discovery-suggest]: Found ${extraModifiers.length} extra modifiers for ${questionMod}, sample: ${extraModifiers[0]}`);
  }

  return {
    suggestions,
    extraModifiers,
  };
};

const getFirstSuggestions = async (rootSeed: string, report: Pick<IDiscovery, '_id' | 'location' | 'language' | 'searchEngine'>) => {
  let extraModifiers: string[] = [];
  let suggestions: string[] = [];

  let tasks: Promise<ISuggestionResponse>[] = [];
  for (const question of QUESTIONS) {
    tasks.push(getSuggestionsForQuestion(rootSeed, report, question));

    if (tasks.length > POOL_SIZE) {
      const results = await Promise.all(tasks);
      for (const result of results) {
        if (result.suggestions) {
          suggestions = [...suggestions, ...result.suggestions];
          extraModifiers = [...extraModifiers, ...result.extraModifiers];
        }
      }

      tasks = [];

      await sleep(500);
    }
  }

  if (tasks.length > 0) {
    const results = await Promise.all(tasks);
    for (const result of results) {
      if (result.suggestions) {
        suggestions = [...suggestions, ...result.suggestions];
        extraModifiers = [...extraModifiers, ...result.extraModifiers];
      }
    }
  }

  console.log(`[discovery-suggest]: Found first ${suggestions.length} suggestions, ${extraModifiers.length} modifiers for ${report._id}`);

  return {
    suggestions,
    extraModifiers: uniq(extraModifiers),
  };
};

const getExtraSuggestions = async (
  rootSeed: string,
  report: Pick<IDiscovery, 'searchEngine' | 'language' | 'location'>,
  question: string,
): Promise<string[]> => {
  const suggestions: string[] = [];

  const mod = `${question} *`;
  const seed = `${mod} ${rootSeed}`;
  const firstSuggestions = await getGoogleSuggest(seed, report.searchEngine, report.language, report.location, mod.length);
  const secondSuggestions = await getGoogleSuggest(seed, report.searchEngine, report.language, report.location, seed.length);
  for (const sug of uniq([...firstSuggestions, ...secondSuggestions])) {
    if (sug !== `${question} ${rootSeed}`) {
      suggestions.push(sug);
    }
  }

  return suggestions;
};

const getSecondSuggestions = async (
  rootSeed: string,
  report: Pick<IDiscovery, '_id' | 'location' | 'language' | 'searchEngine'>,
  extraModifiers: string[],
) => {
  let suggestions: string[] = [];

  let tasks: Promise<string[]>[] = [];
  for (const question of extraModifiers) {
    tasks.push(getExtraSuggestions(rootSeed, report, question));

    if (tasks.length > POOL_SIZE) {
      const results = await Promise.all(tasks);
      for (const result of results) {
        if (result) {
          suggestions = [...suggestions, ...result];
        }
      }

      tasks = [];

      await sleep(500);
    }
  }

  if (tasks.length > 0) {
    const results = await Promise.all(tasks);
    for (const result of results) {
      if (result) {
        suggestions = [...suggestions, ...result];
      }
    }
  }

  return suggestions;
};

export const getSuggestionsForQuestions = async (
  rootSeed: string,
  report: Pick<IDiscovery, '_id' | 'location' | 'language' | 'searchEngine'>,
): Promise<string[]> => {
  const firstSuggestions = await getFirstSuggestions(rootSeed, report);

  console.log(`[discovery-suggest]: Getting extra suggestions for ${rootSeed}`);

  const extraSuggestions = await getSecondSuggestions(rootSeed, report, firstSuggestions.extraModifiers);
  const suggestions = uniq([...firstSuggestions.suggestions, ...extraSuggestions]);

  const filteredSuggestions = suggestions.filter((sug) => {
    const firstWord = sug.split(' ')[0];
    const includesQuestion = QUESTIONS.includes(firstWord);
    const isNotSeed = sug !== rootSeed;
    const withoutSeed = sug.replace(rootSeed, '').trim().split(' ');
    const hasMoreThanOneModifier = withoutSeed.length > 1;
    const sugIncludesAllKeywordWords = rootSeed.split(' ').every((word) => sug.includes(word));
    return includesQuestion && isNotSeed && hasMoreThanOneModifier && sugIncludesAllKeywordWords;
  });

  console.log(`[discovery-suggest]: Found a total of ${suggestions.length} uniq suggestions for ${rootSeed}`);
  console.log(`[discovery-suggest]: After filtering, found ${filteredSuggestions.length} uniq suggestions for ${rootSeed}`);

  return filteredSuggestions;
};
