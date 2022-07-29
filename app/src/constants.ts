import path from 'path';

import { IQueueType } from './types/IQueueType';

const isDev = process.env.NODE_ENV === 'development';
export const API_URL = isDev ? 'http://localhost:8080/api' : 'https://seoruler.tools/api';

export const ROOT_DIR = path.resolve(__dirname);
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

export const MAX_CUSTOM_KEYWORDS = 5_000;
export const DISCOVERY_KEYWORDS_LIMIT = 20_000;
export const DEFAULT_SERP_LOCATION = 'United States';

export const QUEUES: Record<IQueueType, { development: string; endpoint: string }> = {
  'discovery-expand': {
    endpoint: '/service/discovery-expand',
    development: 'http://services:8081',
  },
  'discovery-verbs': {
    endpoint: '/service/discovery-verbs',
    development: 'http://services:8081',
  },
  'discovery-keywords': {
    endpoint: '/service/discovery-keywords',
    development: 'http://services:8081',
  },
  'discovery-serps': {
    endpoint: '/service/discovery-serps',
    development: 'http://services:8081',
  },
  'discovery-serps-similarity': {
    endpoint: '/service/discovery-serps-similarity',
    development: 'http://services:8081',
  },
  'discovery-item-analysis': {
    endpoint: '/service/discovery-item-analysis',
    development: 'http://services:8081',
  },
  'discovery-topic-map': {
    endpoint: '/service/discovery-topic-map',
    development: 'http://services:8081',
  },
};
