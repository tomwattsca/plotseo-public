import { RecoilRoot } from 'recoil';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { trpc } from '../utils';
import { API_URL } from '../../constants';

const Dashboard = React.lazy(() => import('./dashboard/Dashboard'));
const Discovery = React.lazy(() => import('./discovery/Discovery'));
const DiscoveryTopicMap = React.lazy(() => import('./topic-map/TopicMap'));

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient({ url: API_URL + '/__t' }));
  return (
    <React.StrictMode>
      <RecoilRoot>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/discovery/:id" element={<Discovery />} />
                <Route path="/discovery/topic-map/:reportId" element={<DiscoveryTopicMap />} />
              </Routes>
            </BrowserRouter>
          </QueryClientProvider>
        </trpc.Provider>
      </RecoilRoot>
    </React.StrictMode>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
