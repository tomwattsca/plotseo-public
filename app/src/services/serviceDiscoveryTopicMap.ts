import { uniq } from 'lodash';
import { ObjectId } from 'mongodb';
import { callPy } from '../shared/py';
import { Request, Response } from 'express';
import { getDatetime } from '../shared/ymd';
import { dbGetDiscovery } from '../db/discovery';
import { IDiscovery } from '../types/IDiscovery';
import { dbUpdateTopicMap } from '../db/topic-map';
import { IDiscoveryItem } from '../types/IDiscoveryItem';
import { openaiGetClusterCategory, openaiGetClusterName } from '../shared/open-ai';
import { ITopicMapItem, ITopicMapEntity, ITopicCategory } from '../types/IDiscoveryTopicMap';
import { dbGetDiscoveryItemsForReport } from '../db/discovery-item';
import { IDiscoveryTopicMapMessage } from '../types/IDiscoveryTopicMapMessage';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR } from '../types/IReportStatus';

type Req = Request<Record<string, unknown>, Record<string, unknown>, { message: IDiscoveryTopicMapMessage }>;

interface ICluster {
  name: string;
  count: number;
  topics?: string[];
  keywords: string[];
  clusterName?: string;
  sub?: Record<string, string[]>;
}

export const serviceDiscoveryTopicMap = async (req: Req, res: Response) => {
  const startTime = Date.now();
  console.log(`[discovery-topic-map]: Starting at ${getDatetime(new Date(startTime))}`);

  const data = {
    ...req.body.message,
    reportId: new ObjectId(req.body.message.reportId || ''),
    topicMapId: new ObjectId(req.body.message.topicMapId || ''),
  };

  if (!data.topicMapId) {
    console.error(`[discovery-topic-map]: Invalid message received: ${JSON.stringify(data)}`);
    return res.status(404).json({ message: 'Missing topicMapId' });
  }

  if (!data.reportId) {
    console.error(`[discovery-topic-map]: Invalid message received: ${JSON.stringify(data)}`);
    await dbUpdateTopicMap(data.topicMapId, { status: REPORT_STATUS_ERROR });
    return res.status(404).json({ message: 'Missing reportId or userId' });
  }

  const report = await dbGetDiscovery<Pick<IDiscovery, '_id'>>(data.reportId, { _id: 1 });
  if (!report) {
    console.error(`[discovery-topic-map]: No report found: ${data.reportId.toString()}`);
    await dbUpdateTopicMap(data.topicMapId, { status: REPORT_STATUS_ERROR });
    return res.status(404).json({ message: 'Report does not exists' });
  }

  const items = await dbGetDiscoveryItemsForReport<Pick<IDiscoveryItem, 'keyword'>>(data.reportId, { keyword: 1 });
  if (!items || items.length === 0) {
    console.error(`[discovery-topic-map]: No items found for report: ${data.reportId.toString()}`);
    await dbUpdateTopicMap(data.topicMapId, { status: REPORT_STATUS_ERROR });
    return res.status(404).json({ message: 'No items found for report' });
  }

  const baseClusters = await getClusters(
    items.map((item) => item.keyword),
    'sub',
  );

  const finalMap: ITopicMapItem[] = [];
  if (baseClusters && baseClusters.clusters) {
    const baseClusterKeywords = Object.keys(baseClusters.clusters);
    const superClusters = await getClusters(baseClusterKeywords, 'super');
    if (superClusters && superClusters.clusters) {
      for (const key of Object.keys(superClusters?.clusters)) {
        const cluster = superClusters.clusters[key];
        const newKeywords = [...cluster.keywords];
        for (const keyword of [cluster.name, ...cluster.keywords]) {
          if (baseClusters.clusters[keyword]) {
            newKeywords.push(...baseClusters.clusters[keyword].keywords);
          }
        }
        const finalKeywords = uniq([...cluster.keywords, ...newKeywords]);

        const subDict: Record<string, string[]> = {};
        for (const keyword of cluster.keywords) {
          if (baseClusters.clusters[keyword]) {
            subDict[keyword] = baseClusters.clusters[keyword].keywords;
          }
        }

        let sample: string[] = [];
        if (cluster.keywords.length > 5) {
          sample = cluster.keywords;
        } else {
          for (const keyword of cluster.keywords) {
            if (baseClusters.clusters[keyword]) {
              sample.push(...baseClusters.clusters[keyword].keywords.slice(0, 5));
            }
          }
        }

        const clusterName = await openaiGetClusterName(sample);

        finalMap.push({
          key: cluster.name,
          clusters: subDict,
          name: clusterName || '',
          count: finalKeywords.length,
          entities: await getEntities(sample.slice(0, 3)),
        });
      }
    }
  }

  const foundCategories: string[] = [];
  const categories: ITopicCategory[] = [];
  const finalMapNames = finalMap.map((item) => item.name);
  const categoryClusters = await getClusters(finalMapNames, 'cat');
  if (categoryClusters && categoryClusters.clusters) {
    for (const key of Object.keys(categoryClusters.clusters)) {
      const cluster = categoryClusters.clusters[key];
      const category = await openaiGetClusterCategory(cluster.keywords);
      foundCategories.push(...cluster.keywords);
      categories.push({
        key,
        name: category || key,
        keywords: cluster.keywords,
      });
    }
  }

  const missingCategories = uniq(finalMapNames.filter((keyword) => !foundCategories.includes(keyword)));
  categories.push({
    key: 'others',
    name: 'Others',
    keywords: missingCategories,
  });

  await dbUpdateTopicMap(data.topicMapId, {
    categories,
    map: finalMap,
    status: REPORT_STATUS_COMPLETED,
  });

  const endTime = Date.now();
  const minutes = (endTime - startTime) / 1000 / 60;
  console.log(`[discovery-suggest]: Finished, took ${minutes} minutes`);

  return res.json({ success: true, message: 'Topic Map' });
};

const getEntities = async (keywords: string[]): Promise<ITopicMapEntity[]> => {
  try {
    const results = await callPy<{ entities: ITopicMapEntity[] }, { keywords: string[]; key: string }>('cluster-entities.py', {
      data: {
        keywords,
        key: process.env.GOOGLE_API_KEY || '',
      },
    });

    if (results) {
      return results.entities;
    }
  } catch (err) {
    console.error('Error getting topic entities');
  }

  return [];
};

const getClusters = async (keywords: string[], dist: 'super' | 'normal' | 'sub' | 'cat') => {
  let broadSemanticClusters: Record<string, ICluster> | undefined;
  try {
    const clusters = await callPy<{ clusters: Record<string, string[]> }, { keywords: string[]; dist: 'super' | 'normal' | 'sub' | 'cat' }>(
      'semantic-clustering.py',
      {
        data: {
          dist,
          keywords,
        },
      },
    );
    if (clusters) {
      broadSemanticClusters = {};
      for (const cluster of Object.keys(clusters.clusters)) {
        if (broadSemanticClusters) {
          const kws = clusters.clusters[cluster];
          broadSemanticClusters[cluster] = {
            name: cluster,
            keywords: kws,
            count: kws.length,
          };
        }
      }
    }
  } catch (err) {
    console.error('Error getting semantic super clusters');
    return undefined;
  }

  return {
    clusters: broadSemanticClusters,
  };
};
