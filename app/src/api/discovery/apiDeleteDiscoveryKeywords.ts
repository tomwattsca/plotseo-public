import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { Context } from '../../shared/context';
import { dbDeleteDiscoveryItemsForReport } from '../../db/discovery-item';
import { inputDeleteDiscoveryKeywords, outputDeleteDiscoveryKeywords } from './input/inputDeleteDiscoveryKeywords';
import { dbAddOrUpdateDiscoveryTask, dbGetDiscovery, dbUpdateDiscovery } from '../../db/discovery';
import { IDiscovery } from 'src/types/IDiscovery';
import { IKeywordGroup } from '../../types/IKeywordGroup';
import { v4 as uuid } from 'uuid';
import { REPORT_STATUS_QUEUED } from '../../types/IReportStatus';
import { sendToQueue } from '../../shared/queue';
import { IDiscoverySerpSimilarityMessage } from '../../types/IDiscoverySerpSimilarityMessage';

export const apiDeleteDiscoveryKeywords = async ({
  input,
}: {
  ctx: Context;
  input: z.input<typeof inputDeleteDiscoveryKeywords>;
}): Promise<z.output<typeof outputDeleteDiscoveryKeywords>> => {
  const { reportId, keywords } = input;

  if (!reportId) {
    return {
      success: false,
    };
  }

  const report = await dbGetDiscovery<Pick<IDiscovery, '_id' | 'groups' | 'seed'>>(new ObjectId(reportId), {
    _id: 1,
    seed: 1,
    groups: 1,
  });
  if (!report) {
    return { success: false };
  }

  // Remove items
  const done = await dbDeleteDiscoveryItemsForReport(new ObjectId(reportId), keywords);

  if (done) {
    // Update groups
    const newGroups: IKeywordGroup[] = [];
    for (const group of report.groups || []) {
      const newKeywords = group.keywords.filter((keyword) => !keywords.includes(keyword));
      newGroups.push({ ...group, count: newKeywords.length, keywords: newKeywords });
    }
    await dbUpdateDiscovery(new ObjectId(reportId), { groups: newGroups });

    // Re-calculate serpSimilarity and clusters
    const serpSimilarityTaskUuid = uuid();
    await dbAddOrUpdateDiscoveryTask(new ObjectId(reportId), serpSimilarityTaskUuid, 'discovery-serps-similarity', REPORT_STATUS_QUEUED);
    await sendToQueue<IDiscoverySerpSimilarityMessage>('discovery-serps-similarity', {
      seed: report.seed,
      reportId: reportId.toString(),
      taskUuid: serpSimilarityTaskUuid,
    });
  }

  return {
    success: done,
  };
};
