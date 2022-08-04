import Nav from '../../components/Nav';
import { flatten, sortBy, uniq } from 'lodash';
import { formatNumber, trpc } from '../../utils';
import { cleanKeyword } from '../../../shared/keyword';
import React, { useEffect, useMemo, useState } from 'react';
import { ITopicMapItem } from '../../../types/IDiscoveryTopicMap';
import { IDiscoveryItemOutput } from '../../../api/discovery/input/inputGetDiscoveryItems';
import type { IDiscoveryTopicMapItemOutput } from '../../../api/discovery/input/apiGetTopicMap';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING, REPORT_STATUS_QUEUED } from '../../../types/IReportStatus';
import { useParams } from 'react-router-dom';

const TopicMap = () => {
  const params = useParams<{ id: string }>();
  const reportId = params.id || '';

  const doGetBase = trpc.useQuery(['discovery:base', { reportId }], {
    refetchOnWindowFocus: false,
  });

  const doGetTopicMap = trpc.useQuery(['discovery:get-topic-map', { reportId }], {
    refetchOnWindowFocus: false,
    enabled: doGetBase.data !== undefined,
  });
  const base = useMemo(() => doGetBase.data?.report, [doGetBase.data?.report]);
  const topicMap = useMemo(() => doGetTopicMap.data, [doGetTopicMap.data]);
  const categories = useMemo(() => doGetTopicMap.data?.categories, [doGetTopicMap.data?.categories]);
  const map = useMemo(() => {
    const current = doGetTopicMap.data?.map;
    if (current) {
      return sortBy(current, (item: ITopicMapItem) => -item.count) as ITopicMapItem[];
    }
    return [];
  }, [doGetTopicMap.data?.map]);

  useEffect(() => {
    if (topicMap && topicMap.status !== REPORT_STATUS_COMPLETED && topicMap.status !== REPORT_STATUS_ERROR) {
      setTimeout(() => {
        doGetTopicMap.refetch();
      }, 10_000);
    }
  });

  if (!base || doGetBase.isLoading || !topicMap || doGetTopicMap.isLoading) {
    return (
      <div>
        <Nav />
        <div className="container mx-auto mt-5">
          <div className="px-3 py-2 rounded bg-slate-700 text-white flex items-center">
            <i className="ri-refresh-line" />
            <span className="ml-2">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (topicMap.status === REPORT_STATUS_QUEUED || topicMap.status === REPORT_STATUS_PROCESSING) {
    return (
      <div>
        <Nav />
        <div className="container mx-auto mt-5">
          <a className="block text-base font-medium text-sky-700 hover:text-sky-800 mb-2 flex items-center" href={`/discovery/${reportId}`}>
            <i className="ri-arrow-left-line pr-2" />
            Go back to report
          </a>
          <div className="px-3 py-2 rounded bg-slate-700 text-white flex items-center">
            <i className="ri-refresh-line" />
            <span className="ml-2">Your Topic Map is being created, please wait for a few minutes.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Nav />
      <div className="container mx-auto px-3 mt-5">
        <a className="block text-base font-medium text-sky-700 hover:text-sky-800 mb-2 flex items-center" href={`/discovery/${reportId}`}>
          <i className="ri-arrow-left-line pr-2" />
          Go back to report
        </a>
        <div className="pb-10">
          <div className="text-3xl font-medium text-slate-600 text-center">
            {base.name} <span className="text-xl text-slate-600 font-normal capitalize">Topic Map</span>
          </div>
          <div className="flex flex-wrap justify-center mt-3">
            <div className="w-full lg:w-8/12">
              <div className="rounded bg-white">
                {categories?.map((category, index) => {
                  const categoryMaps = map.filter((item) => [...category.keywords, category.key].includes(item.name));
                  return (
                    <div key={`${category.key}-${index}`} className="">
                      <div className="text-slate-600 font-medium text-lg capitalize pl-2 pt-1">{category.name}</div>
                      <div className="">
                        {categoryMaps.map((topic, index) => {
                          if (!topic) {
                            return undefined;
                          }
                          return <Topic items={topicMap.items || []} key={`${category.key}-${topic.key}-${index}`} topic={topic} />;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Topic = ({ topic, items }: { topic: IDiscoveryTopicMapItemOutput; items: IDiscoveryItemOutput[] }) => {
  const [open, setOpen] = useState(false);

  const key = topic.key ? cleanKeyword(topic.key) : '';
  const name = topic.name ? cleanKeyword(topic.name) : '';
  const clusters: Array<{
    count: number;
    keyword: string;
    keywords: string[];
  }> = [];

  for (const key of Object.keys(topic.clusters)) {
    const cluster = topic.clusters[key];
    clusters.push({
      keyword: key,
      keywords: cluster,
      count: cluster.length,
    });
  }

  const clustersKeywords = uniq(flatten(clusters.map((cluster) => cluster.keywords)));
  const volume = items
    .filter((item) => clustersKeywords.includes(item.keyword))
    .map((item) => item.volume)
    .reduce((a, b) => (a || 0) + (b || 0), 0);

  return (
    <div className="border-b border-slate-200">
      <div className={`flex items-center py-2 px-3 ${open ? 'bg-yellow-50' : ''}`}>
        <div className="cursor-pointer text-slate-700" onClick={() => setOpen((prev) => !prev)}>
          <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line ri-lg`} />
        </div>
        <div className="pl-3 flex-grow">
          <div className="text-base text-slate-700 capitalize">
            {name || key}{' '}
            <span title="# of KWs" className="text-xs text-purple-500 pl-2">
              {topic.count}
            </span>
          </div>
        </div>
        <div className="w-[75px] text-right text-sm text-slate-500 select-none">
          <div title="Volume">{formatNumber(volume || 0)}</div>
        </div>
      </div>
      {open && (
        <div className="pb-2">
          {clusters.map((cluster, index) => {
            return (
              <Cluster
                items={items}
                count={cluster.count}
                keyword={cluster.keyword}
                keywords={cluster.keywords}
                key={`${cluster.keyword}-${index}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const Cluster = ({
  count,
  items,
  keyword,
  keywords,
}: {
  count: number;
  keyword: string;
  keywords: string[];
  items: IDiscoveryItemOutput[];
}) => {
  const [open, setOpen] = useState(false);
  const keywordsWithData = sortBy(
    keywords.map((keyword) => items.find((item) => item.keyword === keyword)),
    (item) => -(item?.volume || 0),
  );

  const volume = items
    .filter((item) => keywords.includes(item.keyword))
    .map((item) => item.volume)
    .reduce((a, b) => (a || 0) + (b || 0), 0);

  return (
    <div className="py-1 border-t border-slate-200">
      <div className="flex items-center pl-6 pr-3">
        <div className="cursor-pointer text-slate-500" onClick={() => setOpen((prev) => !prev)}>
          <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line`} />
        </div>
        <div className="text-base text-slate-700 pl-3 flex-grow">
          {keyword} <span className="text-xs text-purple-500 pl-2">{count}</span>
        </div>
        <div className="w-[75px] text-right text-sm text-slate-500 select-none">{formatNumber(volume || 0)}</div>
      </div>
      {open && (
        <div className="mt-1">
          {keywordsWithData.map((item, index) => {
            if (!item) {
              return undefined;
            }
            return (
              <div key={`${item.keyword}-${index}`} className="pl-12 pr-3 py-1 border-t border-slate-200 flex flex-wrap items-center">
                <div className="flex-grow text-slate-800">
                  <div>{item.keyword}</div>
                  {item.serpFeatures && (
                    <div className="w-full text-[10px] flex items-center text-slate-600 uppercase">
                      {item.serpFeatures.map((feature, index) => {
                        return (
                          <div key={`${feature}-${index}`} className="mr-2">
                            {feature.replace(/_/g, ' ')}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="w-[75px] text-right text-sm text-slate-500 select-none">
                  {item.volume ? formatNumber(item.volume) : <span>&mdash;</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopicMap;
