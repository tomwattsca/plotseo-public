import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { Context } from '../../shared/context';
import { sendToQueue } from '../../shared/queue';
import { IDiscovery } from '../../types/IDiscovery';
import { dbCreateDiscovery } from '../../db/discovery';
import { REPORT_TYPE_DISCOVERY } from '../../types/IReportType';
import { REPORT_STATUS_QUEUED } from '../../types/IReportStatus';
import { SEARCH_TYPE_CUSTOM } from '../../types/IDiscoverySearchType';
import { IDiscoveryExpandMessage } from '../../types/IDiscoveryExpandMessage';
import { inputCreateDiscovery, outputCreateDiscovery } from './input/inputCreateDiscovery';
import { getCurrentDate, getCurrentDay, getCurrentMonth, getCurrentYear } from '../../shared/ymd';

export const apiCreateDiscovery = async ({
  input,
}: {
  ctx: Context;
  input: z.input<typeof inputCreateDiscovery>;
}): Promise<z.output<typeof outputCreateDiscovery>> => {
  const {
    name,
    competitorPatterns,
    easyWinsDefaults,
    easyWinsPatterns,
    seed,
    location,
    language,
    keywords,
    searchType,
    searchEngine,
    serpLocation,
  } = input;

  const report: Omit<IDiscovery, '_id'> = {
    name,
    seed,
    location,
    language,
    tasks: [],
    searchType,
    serpLocation,
    searchEngine,
    easyWinsDefaults,
    easyWinsPatterns,
    competitorPatterns,
    day: getCurrentDay(),
    date: getCurrentDate(),
    year: getCurrentYear(),
    month: getCurrentMonth(),
    status: REPORT_STATUS_QUEUED,
    reportType: REPORT_TYPE_DISCOVERY,
  };

  let id: ObjectId | undefined;

  if (searchType === SEARCH_TYPE_CUSTOM && (!Array.isArray(keywords) || keywords.length === 0)) {
    console.error(`[apiCreateDiscovery]: Invalid keywords: ${JSON.stringify(keywords)}`);
    return { success: false };
  }

  try {
    id = await dbCreateDiscovery(report);
  } catch (error) {
    console.error(error);
  }

  if (id) {
    await sendToQueue<IDiscoveryExpandMessage>('discovery-start', {
      isNew: true,
      url: input.url,
      seed: input.seed,
      reportId: id.toString(),
      keywords: input.keywords,
      language: report.language,
      location: report.location,
      searchType: input.searchType,
      serpLocation: report.serpLocation,
      searchEngine: report.searchEngine,
      easyWinsDefaults: report.easyWinsDefaults,
      easyWinsPatterns: report.easyWinsPatterns,
    });
  }

  return {
    success: !!id,
    id: id?.toString(),
  };
};
