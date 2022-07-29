import { chunk } from 'lodash';
import { Request, Response } from 'express';
import { sleep } from '../shared/time';
import { getKEKeyword } from '../shared/ke';
import { getCurrentMonth, getCurrentYear, getDatetime } from '../shared/ymd';
import { IDiscoverySerpsMessage } from '../types/IDiscoverySerpsMessage';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING } from '../types/IReportStatus';
import { dbAddOrUpdateDiscoveryTask } from '../db/discovery';
import { dbGetDiscoveryItemsForReport, dbUpdateDiscoveryItem } from '../db/discovery-item';
import { IDiscoveryItem } from '../types/IDiscoveryItem';
import { ObjectId } from 'mongodb';

type Req = Request<Record<string, unknown>, Record<string, unknown>, { message: IDiscoverySerpsMessage }>;

export const serviceDiscoveryKeywords = async (req: Req, res: Response) => {
  const startTime = Date.now();
  console.log(`[discovery-keywords]: Starting at ${getDatetime(new Date(startTime))}`);

  let data: IDiscoverySerpsMessage = req.body.message;
  if (
    !data.reportId ||
    !data.keywords ||
    !data.taskUuid ||
    !data.language ||
    !data.location ||
    !data.serpLocation ||
    !data.searchEngine ||
    data.keywords.length === 0
  ) {
    if (data.keywords.length === 0) {
      console.error(`[discovery-keywords]: Invalid message received: ${JSON.stringify(req.body)}, no keywords sent`);
    } else {
      console.error(`[discovery-keywords]: Invalid message received: ${JSON.stringify(req.body)}`);
    }

    if (data.reportId) {
      await dbAddOrUpdateDiscoveryTask(new ObjectId(data.reportId), data.taskUuid, 'discovery-keywords', REPORT_STATUS_ERROR);
    }
    return res.status(404).json({ message: 'Invalid message' });
  }

  data = {
    ...data,
    reportId: new ObjectId(data.reportId.toString() || ''),
  };

  // TODO: Get keyword from any report with up-to-date data

  const keywordsToUpdate: string[] = [];
  const reportKeywords = await dbGetDiscoveryItemsForReport<Pick<IDiscoveryItem, 'keyword' | 'volume' | 'year' | 'month'>>(
    data.reportId,
    {
      keyword: 1,
      volume: 1,
      year: 1,
      month: 1,
    },
    data.keywords,
  );

  for (const keyword of reportKeywords || []) {
    if (
      keyword &&
      keyword.volume !== undefined &&
      keyword.year === getCurrentYear() &&
      parseInt(keyword.month, 10) >= parseInt(getCurrentMonth(), 10) - 3
    ) {
      continue;
    }

    keywordsToUpdate.push(keyword.keyword);
  }

  if (keywordsToUpdate.length === 0) {
    console.log(`[discovery-keywords]: No keywords to update for report: ${data.reportId}`);
    await dbAddOrUpdateDiscoveryTask(data.reportId, data.taskUuid, 'discovery-keywords', REPORT_STATUS_COMPLETED);
    return res.status(200).json({ message: 'No keywords to update' });
  }

  await dbAddOrUpdateDiscoveryTask(data.reportId, data.taskUuid, 'discovery-keywords', REPORT_STATUS_PROCESSING);

  // KE API only accepts 100 per request
  const chunks = chunk(keywordsToUpdate, 100);

  for (const chunk of chunks) {
    const keKeywords = await getKEKeyword(chunk, 'usd', data.location, 'cli');
    if (keKeywords) {
      console.log(`[discovery-keywords]: Updating ${chunk.length} keywords, KE credits left ${keKeywords.credits}`);

      for (const kw of keKeywords.data) {
        const keyword = reportKeywords?.find((item) => item.keyword === kw.keyword);
        if (keyword) {
          if (kw.vol === undefined) {
            console.log(`[discovery-keywords]: Keyword had no volume: ${kw.keyword}`);
          }

          const year = getCurrentYear();
          const month = getCurrentMonth();
          await dbUpdateDiscoveryItem(data.reportId, keyword.keyword, {
            year,
            month,
            volume: kw.vol,
            cpc: kw.cpc.value,
            competition: kw.competition,
            volumeHistory: kw.trend.map((item) => ({
              year: item.year,
              month: item.month,
              volume: item.value,
            })),
          });
        }
      }

      await sleep(500);
    }
  }

  await dbAddOrUpdateDiscoveryTask(data.reportId, data.taskUuid, 'discovery-keywords', REPORT_STATUS_COMPLETED);

  const endTime = Date.now();
  const minutes = (endTime - startTime) / 1000 / 60;
  console.log(`[discovery-keywords]: Finished, took ${minutes} minutes`);

  return res.json({ success: true });
};
