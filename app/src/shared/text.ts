import { uniq } from 'lodash';
import { getWordBoundaryRegex } from './regex';

export const getPartsAndWords = (sentence: string, ngrams: string[]): string[] => {
  const parts: string[] = [];

  for (const gram of ngrams) {
    if (sentence.match(getWordBoundaryRegex(gram.replace(/_/g, ' ')))) {
      parts.push(gram.split(' ').join('_').toLowerCase());
    }
  }

  return parts;
};

export const ALPHABET = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
];

export const QUESTIONS = uniq([
  'how',
  'can',
  'when',
  'where',
  'what',
  'why',
  'is',
  'are',
  'does',
  'do',
  'will',
  'can',
  'could',
  'would',
  'should',
  'which',
  'who',
]);

export const POS_QUESTIONS = ['WRB', 'WP$', 'WP', 'WDT'];

export const POS_MODIFIERS = [
  'JJ',
  'JJR',
  'JJS',
  'IN',
  'DT',
  'MD',
  'NN',
  'NNS',
  'PDT',
  'RB',
  'RBR',
  'RBS',
  'VB',
  'VBD',
  'VBG',
  'VBN',
  'VBP',
  'VBZ',
];
