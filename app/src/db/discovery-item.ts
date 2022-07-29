import { db } from '../shared/db';
import { Filter, ObjectId } from 'mongodb';
import { IDiscoveryItem } from '../types/IDiscoveryItem';

const COLLECTION = 'discoveryItem';

export const dbGetDiscoveryItem = async <TObj>(
  report: ObjectId,
  keyword: string,
  projection: Record<keyof TObj, 1>,
): Promise<TObj | undefined> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  if (!report || !keyword) {
    return undefined;
  }

  const collection = db.collection(COLLECTION);
  const result = await collection.findOne<TObj>({ report, keyword }, { projection });
  return result ? result : undefined;
};

export const dbGetDiscoveryItemsForReport = async <TObj>(
  report: ObjectId,
  projection: Record<keyof TObj, 1>,
  keywords?: string[],
): Promise<TObj[] | undefined> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);

  let filter: Filter<Partial<IDiscoveryItem>> = { report };
  if (keywords && keywords.length > 0) {
    filter = { ...filter, keyword: { $in: keywords } };
  }

  const result = await collection.find<TObj>(filter, { projection }).toArray();

  if (!result) {
    return undefined;
  }

  return result;
};

export const dbCreateDiscoveryItem = async (item: Omit<IDiscoveryItem, '_id'>): Promise<ObjectId | undefined> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.insertOne(item);
  return result.insertedId;
};

export const dbUpdateDiscoveryItem = async (
  reportId: ObjectId,
  keyword: string,
  item: Partial<Omit<IDiscoveryItem, '_id' | 'report' | 'keyword'>>,
): Promise<boolean> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.updateOne({ report: reportId, keyword }, { $set: item });
  return result.modifiedCount > 0;
};

export const dbDeleteDiscoveryAllItemsForReport = async (report: ObjectId): Promise<boolean> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.deleteMany({ report });
  return result.deletedCount > 0;
};

export const dbDeleteDiscoveryItemsForReport = async (report: ObjectId, keywords?: string[]): Promise<boolean> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.deleteMany({ report, keyword: { $in: keywords } });
  return result.deletedCount > 0;
};
