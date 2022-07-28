export const SEARCH_TYPE_URL = 'url' as const;
export const SEARCH_TYPE_CUSTOM = 'custom' as const;
export const SEARCH_TYPE_WILDCARD = 'wildcard' as const;
export const SEARCH_TYPE_QUESTIONS = 'questions' as const;

export type IDiscoverySearchType =
  | typeof SEARCH_TYPE_URL
  | typeof SEARCH_TYPE_CUSTOM
  | typeof SEARCH_TYPE_WILDCARD
  | typeof SEARCH_TYPE_QUESTIONS;
