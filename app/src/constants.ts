import path from 'path';

import { IQueueType } from './types/IQueueType';

const isDev = process.env.NODE_ENV === 'development';
const SERVICES_URL = `http://services:${process.env.SERVICES_PORT}`;
export const API_URL = isDev ? `http://localhost:${process.env.APP_PORT}/api` : 'https://seoruler.tools/api';

export const ROOT_DIR = path.resolve(__dirname);
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

export const MAX_CUSTOM_KEYWORDS = 5_000;
export const DISCOVERY_KEYWORDS_LIMIT = 20_000;
export const DEFAULT_SERP_LOCATION = 'United States';

export const QUEUES: Record<IQueueType, { development: string; endpoint: string }> = {
  'discovery-expand': {
    endpoint: '/service/discovery-expand',
    development: SERVICES_URL,
  },
  'discovery-verbs': {
    endpoint: '/service/discovery-verbs',
    development: SERVICES_URL,
  },
  'discovery-keywords': {
    endpoint: '/service/discovery-keywords',
    development: SERVICES_URL,
  },
  'discovery-serps': {
    endpoint: '/service/discovery-serps',
    development: SERVICES_URL,
  },
  'discovery-serps-similarity': {
    endpoint: '/service/discovery-serps-similarity',
    development: SERVICES_URL,
  },
  'discovery-item-analysis': {
    endpoint: '/service/discovery-item-analysis',
    development: SERVICES_URL,
  },
  'discovery-topic-map': {
    endpoint: '/service/discovery-topic-map',
    development: SERVICES_URL,
  },
};
