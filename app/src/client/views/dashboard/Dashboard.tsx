import 'antd/dist/antd.css';

import { trpc } from '../../utils';
import message from 'antd/es/message';
import Nav from '../../components/Nav';
import PopConfirm from 'antd/es/popconfirm';
import { createRoot } from 'react-dom/client';
import { API_URL } from '../../../constants';
import Button from '../../components/Button';
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import NewDiscoverySection from './NewDiscoverySection';
import { IDiscoveryForList } from '../../../types/IDiscoveryForList';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING, REPORT_STATUS_QUEUED } from '../../../types/IReportStatus';

const Dashboard = () => {
  const [showNewDiscoveryForm, setShowNewDiscoveryForm] = useState(false);

  const discoveryReports = trpc.useQuery(['discovery:list']);
  const deleteDiscoveryReport = trpc.useMutation(['discovery:delete'], {
    onSuccess: (deleted) => {
      if (deleted) {
        message.success('Report deleted successfully');
        discoveryReports.refetch();
      }
    },
    onError: () => {
      message.error('We could not delete this report');
    },
  });

  if (discoveryReports.isLoading) {
    return (
      <div>
        <Nav current="dashboard" />
        <div className="container mx-auto pt-8">
          <div className="px-3 py-2 bg-slate-600 text-white rounded">Loading</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Nav current="dashboard" />
      <div className="container mx-auto pt-8 pb-12">
        <div className="mb-4">
          <div className="flex flex-wrap">
            <Button
              icon="ri-add-line ri-lg"
              text="New Keyword Discovery"
              color="text-white bg-green-600 hover:bg-green-700"
              onClick={() => setShowNewDiscoveryForm(true)}
            />
          </div>
        </div>
        <div className="flex flex-wrap">
          {showNewDiscoveryForm && (
            <div className="w-full lg:w-4/12">
              <div className="pr-3">
                <NewDiscoverySection close={() => setShowNewDiscoveryForm(false)} />
              </div>
            </div>
          )}
          <div className={`${showNewDiscoveryForm ? 'w-full lg:w-8/12' : 'w-full'}`}>
            <div className="bg-white shadow overflow-hidden sm:rounded-md select-none">
              <div className="flex flex-wrap items-center px-3 py-2">
                <div className="text-lg text-slate-700">Keyword Discovery Reports</div>
              </div>
              {discoveryReports.data?.length === 0 && (
                <div className="m-3 bg-slate-500 text-white px-3 py-2 rounded inter font-semibold select-none">No reports created yet.</div>
              )}
              {(discoveryReports.data || []).length > 0 && (
                <div role="list" className="divide-y divide-gray-200 border-t border-slate-200 border-solid">
                  {discoveryReports.data?.map((report) => (
                    <Item
                      key={report._id}
                      item={report}
                      onDelete={() => {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        deleteDiscoveryReport.mutate({ reportId: report._id });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Item = ({ item, onDelete }: { item: IDiscoveryForList; onDelete: () => void }) => {
  return (
    <div>
      <div className="flex items-center px-4 py-2">
        <div className="text-base font-medium truncate capitalize">
          <a href={`/discovery/${item._id}`} className="block text-sky-700">
            {item.name}
          </a>
        </div>
        <div className="flex-grow text-sm flex items-center justify-end">
          {item.status === REPORT_STATUS_PROCESSING && <i className="ri-refresh-line ri-lg text-amber-500" />}
          {item.status === REPORT_STATUS_ERROR && <i className="ri-close-line ri-lg text-red-500" />}
          {item.status === REPORT_STATUS_COMPLETED && <i className="ri-check-line ri-lg text-lime-500" />}
          {item.status === REPORT_STATUS_QUEUED && <i className="ri-refresh-line ri-lg text-sky-500" />}
          <span className="pl-2">{item.status}</span>
          <time dateTime={item.date} className="text-gray-500 pl-3">
            {item.date}
          </time>
          {(item.status === REPORT_STATUS_COMPLETED || item.status === REPORT_STATUS_ERROR) && (
            <PopConfirm
              placement="left"
              title="Are you sure to delete this report?"
              onConfirm={onDelete}
              okText="Yes"
              okType="danger"
              okButtonProps={{
                type: 'primary',
              }}
              cancelText="No"
            >
              <div className="text-red-500 hover:text-red-600 cursor-pointer pl-2">
                <i className="ri-delete-bin-6-line" />
              </div>
            </PopConfirm>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardWrapper = () => {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient({ url: API_URL + '/__t' }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </trpc.Provider>
  );
};

const container = document.getElementById('root');
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(container!);
root.render(<DashboardWrapper />);
