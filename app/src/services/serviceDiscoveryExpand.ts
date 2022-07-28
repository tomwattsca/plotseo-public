import { uniq } from 'lodash';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { getDatetime } from '../shared/ymd';
import { sendToQueue } from '../shared/queue';
import calculateTerms from '../helpers/calculateTerms';
import { getNgrams } from './utils/getNgramsAndSimilar';
import { generateSuggestions } from './utils/generateSuggestions';
import { cleanKeyword, updateKeywordYear } from '../shared/keyword';
import { IDiscoverySerpsMessage } from '../types/IDiscoverySerpsMessage';
import { IDiscoveryVerbsMessage } from '../types/IDiscoveryVerbsMessage';
import { dbAddOrUpdateDiscoveryTask, dbUpdateDiscovery } from '../db/discovery';
import { createOrUpdateDiscoveryItem } from './utils/createOrUpdateDiscoveryItem';
import { SEARCH_TYPE_CUSTOM, SEARCH_TYPE_QUESTIONS, SEARCH_TYPE_URL, SEARCH_TYPE_WILDCARD } from '../types/IDiscoverySearchType';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING, REPORT_STATUS_QUEUED } from '../types/IReportStatus';
import { IDiscoveryExpandMessage } from '../types/IDiscoveryExpandMessage';
import { dbGetDiscoveryItemsForReport } from '../db/discovery-item';
import { IDiscoveryItem } from '../types/IDiscoveryItem';
import { getKeywordsForUrl } from './utils/getKeywordsForUrl';
import { IDiscoverySerpSimilarityMessage } from '../types/IDiscoverySerpSimilarityMessage';

type Req = Request<Record<string, unknown>, Record<string, unknown>, { message: IDiscoveryExpandMessage }>;

export const serviceDiscoveryExpand = async (req: Req, res: Response) => {
  const startTime = Date.now();
  console.log(`[discovery-expand]: Starting at ${getDatetime(new Date(startTime))}`);

  const data = req.body.message;

  if (!data.reportId) {
    console.error(`[discovery-expand]: Missing report ID`);
    return res.status(404).json({ success: false });
  }

  const seed = data.seed;
  const isNew = data.isNew;
  const reportId = new ObjectId(data.reportId);

  let newSuggestions: string[] = [];

  const reportData = {
    _id: reportId,
    language: data.language,
    location: data.location,
    searchType: data.searchType,
    searchEngine: data.searchEngine,
  };

  if (!isNew && !data.taskUuid) {
    console.error(`[discovery-expand]: Missing task UUID for ${data.reportId}`);
    return res.status(404).json({ success: false });
  }

  if (isNew) {
    await dbUpdateDiscovery(reportId, { status: REPORT_STATUS_PROCESSING });
  }

  if (data.searchType === 'custom' && (!data.keywords || data.keywords.length <= 0)) {
    console.error(`[discovery-expand]: Custom expand should include list of keywords on ${data.reportId}`);
    if (isNew) {
      await dbUpdateDiscovery(reportId, { status: REPORT_STATUS_ERROR });
    } else {
      await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-expand', REPORT_STATUS_ERROR);
    }
    return res.status(404).json({ success: false });
  }

  if (data.searchType === SEARCH_TYPE_CUSTOM && data.keywords && data.keywords.length > 0) {
    newSuggestions = data.keywords;
  }

  if (data.searchType === SEARCH_TYPE_QUESTIONS || data.searchType === SEARCH_TYPE_WILDCARD) {
    if (!seed) {
      console.error(`[discovery-expand]: No seed provided for ${data.reportId}`);
      return res.json({ success: false });
    }

    try {
      newSuggestions = await generateSuggestions(seed, reportData);
    } catch (err) {
      console.error(err);
      console.error(`Error generating suggestions on ${data.reportId}`);
      if (isNew) {
        await dbUpdateDiscovery(reportId, { status: REPORT_STATUS_ERROR });
      } else {
        await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-expand', REPORT_STATUS_ERROR);
      }
      return res.json({ success: false });
    }
  }

  if (data.searchType === SEARCH_TYPE_URL) {
    if (!data.url) {
      console.error(`[discovery-suggest]: No URL provided for ${data.reportId}`);
      return res.json({ success: false });
    }

    const urlKeywords = await getKeywordsForUrl(data.url, data.language, data.location, data.searchEngine);
    if (urlKeywords) {
      newSuggestions = urlKeywords;
    } else {
      console.error(`[discovery-suggest]: No keywords found for ${data.url} on ${data.reportId}`);
      return res.json({ success: false });
    }
  }

  const suggestions = uniq(newSuggestions.map((sug) => cleanKeyword(updateKeywordYear(sug))));
  const currentKeywords = await dbGetDiscoveryItemsForReport<Pick<IDiscoveryItem, 'keyword'>>(reportId, { keyword: 1 });
  const allKeywords = uniq([...(currentKeywords || []).map((kw) => kw.keyword), ...suggestions]);

  if (data.searchType === SEARCH_TYPE_CUSTOM) {
    console.log(`[discovery-expand]: Added ${suggestions.length} custom keywords`);
  } else {
    console.log(`[discovery-expand]: Generated ${suggestions.length} keywords`);
  }

  let ngrams;
  try {
    const { ngrams: tmpNgrams } = await getNgrams(allKeywords);
    ngrams = tmpNgrams;
  } catch (err) {
    console.error(`[discovery-expand]: Error getting ngrams for ${data.seed} on ${data.reportId}`);
    if (isNew) {
      await dbUpdateDiscovery(reportId, { status: REPORT_STATUS_ERROR });
    } else {
      await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-expand', REPORT_STATUS_ERROR);
    }
    return res.json({ success: false });
  }

  for (const kw of suggestions) {
    await createOrUpdateDiscoveryItem(reportData, kw, ngrams);
  }

  try {
    const terms = await calculateTerms(reportId);
    await dbUpdateDiscovery(reportId, { terms });
  } catch (err) {
    console.error(`[discovery-suggest]: Error getting terms for ${data.reportId}`);
    console.error(err);
  }

  if (isNew) {
    await dbUpdateDiscovery(reportId, { status: REPORT_STATUS_COMPLETED });
  } else {
    await dbAddOrUpdateDiscoveryTask(reportId, data.taskUuid, 'discovery-expand', REPORT_STATUS_COMPLETED);
  }

  console.log(`[discovery-expand]: Starting queue for keywords data`);

  const taskKwsUuid = uuid();
  await dbAddOrUpdateDiscoveryTask(reportId, taskKwsUuid, 'discovery-keywords', REPORT_STATUS_QUEUED);
  await sendToQueue<IDiscoverySerpsMessage>('discovery-keywords', {
    seed,
    reportId,
    keywords: suggestions,
    taskUuid: taskKwsUuid,
    location: data.location,
    language: data.language,
    searchEngine: data.searchEngine,
    serpLocation: data.serpLocation,
    easyWinsPatterns: data.easyWinsPatterns,
  });

  if (data.language === 'en') {
    const taskVerbsUuid = uuid();
    await dbAddOrUpdateDiscoveryTask(reportId, taskVerbsUuid, 'discovery-verbs', REPORT_STATUS_QUEUED);
    await sendToQueue<IDiscoveryVerbsMessage>('discovery-verbs', {
      taskUuid: taskVerbsUuid,
      reportId: data.reportId,
    });
  }

  const taskSerpSimilarityUuid = uuid();
  await dbAddOrUpdateDiscoveryTask(reportId, taskSerpSimilarityUuid, 'discovery-serps-similarity', REPORT_STATUS_QUEUED);
  await sendToQueue<IDiscoverySerpSimilarityMessage>('discovery-serps-similarity', {
    seed,
    reportId: data.reportId,
    taskUuid: taskSerpSimilarityUuid,
  });

  const endTime = Date.now();
  const minutes = (endTime - startTime) / 1000 / 60;
  console.log(`[discovery-expand]: Finished, took ${minutes} minutes`);

  return res.json({ success: true });
};
