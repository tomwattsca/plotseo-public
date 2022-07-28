import { z } from 'zod';
import { uniq } from 'lodash';
import { ObjectId } from 'mongodb';
import { Context } from '../../shared/context';
import { dbGetDiscovery } from '../../db/discovery';
import { DEFAULT_EW_PATTERNS } from '../../shared/ewScore';
import { dbCheckTopicMapExists } from '../../db/topic-map';
import { IDiscoveryBase } from '../../types/IDiscoveryBase';
import { inputGetDiscoveryBase, outputGetDiscoveryBase } from './input/inputGetDiscoveryBase';

const EMPTY_RESPONSE: z.output<typeof outputGetDiscoveryBase> = {
  id: undefined,
  success: false,
  report: undefined,
};

export const apiGetDiscoveryBase = async ({
  input,
}: {
  ctx: Context;
  input: z.input<typeof inputGetDiscoveryBase>;
}): Promise<z.output<typeof outputGetDiscoveryBase>> => {
  const report = await dbGetDiscovery<IDiscoveryBase>(new ObjectId(input.reportId), {
    _id: 1,
    name: 1,
    seed: 1,
    verbs: 1,
    terms: 1,
    status: 1,
    groups: 1,
    language: 1,
    easyWinsDefaults: 1,
    easyWinsPatterns: 1,
    competitorPatterns: 1,
  });
  if (!report) {
    console.error(`Report ${input.reportId} not found`);
    return EMPTY_RESPONSE;
  }

  const patterns: string[] = [];
  if (report.easyWinsPatterns && report.easyWinsPatterns.length > 0) {
    patterns.push(...report.easyWinsPatterns);
  }
  if (report.easyWinsDefaults) {
    patterns.push(...DEFAULT_EW_PATTERNS);
  }

  const hasTopicMap = await dbCheckTopicMapExists(new ObjectId(input.reportId));

  return {
    success: true,
    id: input.reportId,
    report: {
      hasTopicMap,
      name: report.name,
      terms: report.terms,
      groups: report.groups,
      status: report.status,
      verbs: report.verbs || [],
      language: report.language,
      _id: report._id.toString(),
      seed: report.seed || undefined,
      easyWinsPatterns: uniq(patterns),
      easyWinsDefaults: report.easyWinsDefaults,
      competitorPatterns: report.competitorPatterns || [],
      easyWinsPatternsUser: uniq(report.easyWinsPatterns || []),
    },
  };
};
