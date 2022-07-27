import cors from 'cors';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';

import { connectDb } from './shared/db';
import { dbCreateIndexes } from './db/indexes';
import * as trpcExpress from '@trpc/server/adapters/express';

import { appRouter } from './shared/appRouter';
import { search } from './api/free-tools/search';
import { createContext } from './shared/context';
import { searchLocations } from './api/locations';
import { viewSimple } from './controllers/viewSimple';
import { viewTopicMap } from './controllers/viewTopicMap';
import { viewDiscovery } from './controllers/viewDiscovery';
import { getCountries, getDomains, getLanguages, getLocations } from './api/free-tools/complete';

const port = 8080;
const app = express();

const start = async () => {
  console.log(`Starting server setup in ${process.env.NODE_ENV} mode`);

  await connectDb();
  await dbCreateIndexes();

  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(compression());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use(
    cors({
      origin: '*',
      credentials: true,
      methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
    }),
  );

  app.use('/public', express.static(path.join(__dirname, 'public')));

  // API OTHERS
  app.post('/api/location', searchLocations);

  // FREE APIS
  app.post(`/api/free/search`, search);
  app.post(`/api/free/domains`, getDomains);
  app.post(`/api/free/languages`, getLanguages);
  app.post(`/api/free/locations`, getLocations);
  app.post(`/api/free/countries`, getCountries);

  // VIEWS
  app.get('/discovery/:id', viewDiscovery);
  app.get('/', viewSimple('dashboard.html'));
  app.get('/discovery/topic-map/:reportId', viewTopicMap);

  app.use(
    '/api/__t',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

start().then(() => {
  console.log('Finished server setup');
});
