import { ObjectId } from 'mongodb';
import { IReportTask } from './IReportTask';
import { ICountryType } from './ICountryType';
import { IGoogleDomain } from './IGoogleDomain';
import { ILanguageType } from './ILanguageType';
import { IKeywordGroup } from './IKeywordGroup';
import { IReportStatus } from './IReportStatus';
import { IDiscoveryTerm } from './IDiscoveryTerm';
import { IDiscoverySearchType } from './IDiscoverySearchType';
import { IDiscoverySerpSimilarity } from './IDiscoverySerpSimilarity';
import type { IDiscoveryClusterOutput } from '../api/discovery/input/inputGetDiscoveryClusters';

export interface IDiscovery {
  _id: ObjectId;
  status: IReportStatus;

  // Params
  name: string;

  // Metadata
  day: string;
  date: string;
  year: string;
  month: string;

  // Processing
  tasks: IReportTask[];

  // Params
  seed?: string;
  serpLocation: string;
  location: ICountryType;
  language: ILanguageType;
  searchEngine: IGoogleDomain;
  searchType: IDiscoverySearchType;

  // Data
  verbs?: string[];
  groups?: IKeywordGroup[];
  terms?: IDiscoveryTerm[];
  easyWinsDefaults?: boolean;
  easyWinsPatterns?: string[];
  competitorPatterns?: string[];
  tags?: Record<string, string[]>;
  clusters?: IDiscoveryClusterOutput[];
  semanticClusters?: Record<string, string[]>;
  serpSimilarity?: Record<string, IDiscoverySerpSimilarity>;
}
