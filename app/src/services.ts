import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { QUEUES } from './constants';
import { connectDb } from './shared/db';
import { checkPython } from './api/check-python';
import { serviceDiscoveryExpand } from './services/serviceDiscoveryExpand';
import { serviceDiscoverySerps } from './services/serviceDiscoverySerps';
import { serviceDiscoveryVerbs } from './services/serviceDiscoveryVerbs';
import { serviceDiscoveryKeywords } from './services/serviceDiscoveryKeywords';
import { serviceDiscoveryTopicMap } from './services/serviceDiscoveryTopicMap';
import { serviceDiscoverySerpsSimilarity } from './services/serviceDiscoverySerpsSimilarity';

const app = express();
const port = process.env.SERVICES_PORT || 8081;

const start = async () => {
  await connectDb();

  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(compression());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));

  app.post(QUEUES['discovery-serps'].endpoint, serviceDiscoverySerps);
  app.post(QUEUES['discovery-verbs'].endpoint, serviceDiscoveryVerbs);
  app.post(QUEUES['discovery-expand'].endpoint, serviceDiscoveryExpand);
  app.post(QUEUES['discovery-keywords'].endpoint, serviceDiscoveryKeywords);
  app.post(QUEUES['discovery-topic-map'].endpoint, serviceDiscoveryTopicMap);
  app.post(QUEUES['discovery-serps-similarity'].endpoint, serviceDiscoverySerpsSimilarity);

  app.get('/__py', checkPython);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

start().then(() => {
  console.log(`Services running on port ${port}`);
});
