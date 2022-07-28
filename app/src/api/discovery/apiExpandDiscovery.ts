import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Context } from '../../shared/context';
import { sendToQueue } from '../../shared/queue';
import { IDiscoveryExpandMessage } from '../../types/IDiscoveryExpandMessage';
import { inputExpandDiscovery, outputExpandDiscovery } from './input/inputExpandDiscovery';
import { dbAddOrUpdateDiscoveryTask, dbGetDiscovery } from '../../db/discovery';
import { ObjectId } from 'mongodb';
import { IDiscovery } from '../../types/IDiscovery';
import { REPORT_STATUS_QUEUED } from '../../types/IReportStatus';

export const apiExpandDiscovery = async ({
  input,
}: {
  ctx: Context;
  input: z.input<typeof inputExpandDiscovery>;
}): Promise<z.output<typeof outputExpandDiscovery>> => {
  const reportId = new ObjectId(input.reportId);
  const report = await dbGetDiscovery<
    Pick<IDiscovery, 'serpLocation' | 'searchEngine' | 'language' | 'location' | 'easyWinsPatterns' | 'easyWinsDefaults'>
  >(reportId, {
    serpLocation: 1,
    searchEngine: 1,
    language: 1,
    location: 1,
    easyWinsPatterns: 1,
    easyWinsDefaults: 1,
  });

  if (!report) {
    return {
      success: false,
    };
  }

  const taskUuid = uuid();
  await dbAddOrUpdateDiscoveryTask(reportId, taskUuid, 'discovery-expand', REPORT_STATUS_QUEUED);
  await sendToQueue<IDiscoveryExpandMessage>('discovery-expand', {
    taskUuid,
    isNew: false,
    url: input.url,
    seed: input.seed,
    keywords: input.keywords,
    reportId: input.reportId,
    language: report.language,
    location: report.location,
    searchType: input.searchType,
    serpLocation: report.serpLocation,
    searchEngine: report.searchEngine,
    easyWinsDefaults: report.easyWinsDefaults,
    easyWinsPatterns: report.easyWinsPatterns,
  });

  return {
    success: true,
  };
};
