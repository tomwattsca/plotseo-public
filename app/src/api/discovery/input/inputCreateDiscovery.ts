import { z } from 'zod';
import { asOptionalField } from '../../../shared/z';
import { ENGLISH } from '../../../types/ILanguageType';
import { GOOGLE_CANADA, GOOGLE_UK, GOOGLE_US } from '../../../types/IGoogleDomain';
import { CANADA_CODE, UNITED_KINGDOM_CODE, UNITED_STATES_CODE } from '../../../types/ICountryType';
import { SEARCH_TYPE_CUSTOM, SEARCH_TYPE_QUESTIONS, SEARCH_TYPE_URL, SEARCH_TYPE_WILDCARD } from '../../../types/IDiscoverySearchType';

export const inputCreateDiscovery = z
  .object({
    serpLocation: z.string(),
    url: z.string().optional(),
    language: z.enum([ENGLISH]),
    keywords: z.array(z.string()).optional(),
    easyWinsDefaults: z.boolean().optional(),
    easyWinsPatterns: z.array(z.string()).optional(),
    competitorPatterns: z.array(z.string()).optional(),
    name: z.string().min(1).max(50),
    searchEngine: z.enum([GOOGLE_US, GOOGLE_UK, GOOGLE_CANADA]),
    seed: asOptionalField(z.string().min(1).max(45)),
    location: z.enum([UNITED_STATES_CODE, CANADA_CODE, UNITED_KINGDOM_CODE]),
    searchType: z.enum([SEARCH_TYPE_WILDCARD, SEARCH_TYPE_QUESTIONS, SEARCH_TYPE_CUSTOM, SEARCH_TYPE_URL]),
  })
  .required();

export const outputCreateDiscovery = z.object({
  success: z.boolean(),
  id: z.string().optional(),
});
