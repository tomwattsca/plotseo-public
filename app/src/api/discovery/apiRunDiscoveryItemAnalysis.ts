import { v4 as uuid } from 'uuid';
import { Context } from '../../shared/context';
import { z } from 'zod';
import { inputRunDiscoveryItemAnalysis, outputRunDiscoveryItemAnalysis } from './input/inputRunDiscoveryItemAnalysis';
import { dbGetDiscoveryItem } from '../../db/discovery-item';
import { ObjectId } from 'mongodb';
import { IDiscoveryItem } from '../../types/IDiscoveryItem';
import { dbAddOrUpdateDiscoveryTask } from '../../db/discovery';
import { REPORT_STATUS_QUEUED } from '../../types/IReportStatus';
import { sendToQueue } from '../../shared/queue';
import { IDiscoveryItemAnalysisMessage } from '../../types/IDiscoveryItemAnalysisMessage';

export const apiRunDiscoveryItemAnalysis = async ({
  input,
}: {
  ctx: Context;
  input: z.input<typeof inputRunDiscoveryItemAnalysis>;
}): Promise<z.output<typeof outputRunDiscoveryItemAnalysis>> => {
  const reportId = new ObjectId(input.reportId);
  const item = await dbGetDiscoveryItem<Pick<IDiscoveryItem, '_id'>>(reportId, input.keyword, { _id: 1 });

  if (!item || !input.keyword) {
    return {
      success: false,
    };
  }

  try {
    const taskUuid = uuid();
    await dbAddOrUpdateDiscoveryTask(reportId, taskUuid, 'discovery-item-analysis', REPORT_STATUS_QUEUED);
    await sendToQueue<IDiscoveryItemAnalysisMessage>('discovery-item-analysis', {
      taskUuid: taskUuid,
      keyword: input.keyword,
      reportId: input.reportId,
    });
  } catch (err) {
    console.log(`[apiRunDiscoveryItemAnalysis]: Error sending to queue: ${err}`);
    return { success: false };
  }

  return {
    success: true,
  };
};
