import { ObjectId } from 'mongodb';
import { callPy } from '../shared/py';
import { getDatetime } from '../shared/ymd';
import { Request, Response } from 'express';
import { IDiscoveryItem } from '../types/IDiscoveryItem';
import { calculateClusters } from '../helpers/calculateClusters';
import { dbGetDiscoveryItemsForReport } from '../db/discovery-item';
import { IDiscoverySerpSimilarity } from '../types/IDiscoverySerpSimilarity';
import { dbAddOrUpdateDiscoveryTask, dbUpdateDiscovery } from '../db/discovery';
import { IDiscoverySerpSimilarityMessage } from '../types/IDiscoverySerpSimilarityMessage';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING } from '../types/IReportStatus';

type Req = Request<Record<string, unknown>, Record<string, unknown>, { message: IDiscoverySerpSimilarityMessage }>;

export const serviceDiscoverySerpsSimilarity = async (req: Req, res: Response) => {
  const startTime = Date.now();
  console.log(`[discovery-serps-similarity]: Starting at ${getDatetime(new Date(startTime))}`);

  const data: IDiscoverySerpSimilarityMessage = req.body.message;
  if (!data.reportId) {
    console.error(`[discovery-serps-similarity]: Invalid message received: ${data.toString()}`);
    return res.status(404).json({ message: 'Invalid message' });
  }

  const reportId = new ObjectId(data.reportId);
  await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-serps-similarity', REPORT_STATUS_PROCESSING);

  const urls: string[] = [];
  const serpUrls: Record<string, number[]> = {};
  const allKeywords = await dbGetDiscoveryItemsForReport<Pick<IDiscoveryItem, 'keyword' | 'urlsTop' | 'volume' | 'ewScore'>>(reportId, {
    keyword: 1,
    urlsTop: 1,
    volume: 1,
    ewScore: 1,
  });

  for (const item of allKeywords || []) {
    if (item.keyword && item.urlsTop) {
      serpUrls[item.keyword] = [];

      for (const pos of item.urlsTop) {
        if (pos.url) {
          if (urls.indexOf(pos.url) === -1) {
            urls.push(pos.url);
          }

          serpUrls[item.keyword].push(urls.indexOf(pos.url));
        }
      }
    }
  }

  let serpSimilarity: Record<string, IDiscoverySerpSimilarity> | undefined;
  if (Object.keys(serpUrls).length > 0) {
    try {
      const similarities = await callPy<{ similarity: Record<string, IDiscoverySerpSimilarity> }, Record<string, number[]>>(
        'serp-similarity.py',
        {
          data: serpUrls,
        },
      );
      if (similarities) {
        serpSimilarity = similarities.similarity;
      }
    } catch (err) {
      console.error(`[discovery-serps-similarity]: Error getting serp similarity for ${data.seed}: ${data.reportId}`);
      await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-serps-similarity', REPORT_STATUS_ERROR);
      return res.status(500).json({ message: 'Error getting serp similarity' });
    }
  }

  if (serpSimilarity) {
    console.log(
      `[discovery-serps-similarity]: Updating ${data.reportId}, found ${Object.keys(serpSimilarity).length} with similar keywords`,
    );
    await dbUpdateDiscovery(reportId, { serpSimilarity });
  }

  if (serpSimilarity) {
    const { clusters, topics } = await calculateClusters(reportId.toString(), data.seed, allKeywords || [], {
      serpSimilarity,
    });
    await dbUpdateDiscovery(reportId, { tags: topics, clusters });
  }

  let semanticClusters: Record<string, string[]> | undefined;
  try {
    const clusters = await callPy<{ clusters: Record<string, string[]> }, { keywords: string[]; dist: 'super' | 'normal' }>(
      'semantic-clustering.py',
      {
        data: {
          dist: 'normal',
          keywords: (allKeywords || []).map((item) => item.keyword),
        },
      },
    );
    if (clusters) {
      semanticClusters = clusters.clusters;
    }
  } catch (err) {
    console.error(`[discovery-serps-similarity]: Error getting semantic clusters for ${data.seed}: ${data.reportId}`);
    await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-serps-similarity', REPORT_STATUS_ERROR);
    return res.status(500).json({ message: 'Error getting semantic clusters' });
  }

  await dbUpdateDiscovery(reportId, { semanticClusters });
  await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-serps-similarity', REPORT_STATUS_COMPLETED);

  const endTime = Date.now();
  const minutes = (endTime - startTime) / 1000 / 60;
  console.log(`[discovery-serps-similarity]: Finished, took ${minutes} minutes`);

  return res.json({ success: true });
};
