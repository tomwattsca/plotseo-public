import { IDiscoverySearchType } from './IDiscoverySearchType';
import { ILanguageType } from './ILanguageType';
import { IGoogleDomain } from './IGoogleDomain';
import { ICountryType } from './ICountryType';

export interface IDiscoveryExpandMessage {
  url?: string;
  seed?: string;
  isNew: boolean;
  reportId: string;
  taskUuid?: string;
  keywords?: string[];
  serpLocation: string;
  location: ICountryType;
  language: ILanguageType;
  easyWinsDefaults?: boolean;
  easyWinsPatterns?: string[];
  searchEngine: IGoogleDomain;
  searchType: IDiscoverySearchType;
}
