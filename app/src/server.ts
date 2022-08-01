import cors from 'cors';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';

import { connectDb } from './shared/db';
import { dbCreateIndexes } from './db/indexes';
import * as trpcExpress from '@trpc/server/adapters/express';

import { appRouter } from './shared/appRouter';
import { createContext } from './shared/context';
import { searchLocations } from './api/locations';
import { viewSimple } from './controllers/viewSimple';
import { viewTopicMap } from './controllers/viewTopicMap';
import { viewDiscovery } from './controllers/viewDiscovery';

const port = process.env.APP_PORT || 8080;
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

  // VIEWS
  app.get('/discovery/:id', viewDiscovery);
  app.get('/', viewSimple('dashboard.html'));
  app.get('/discovery/topic-map/:reportId', viewTopicMap);

  app.post('/api/location', searchLocations);
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
