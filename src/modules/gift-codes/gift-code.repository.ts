/**
 * 赠金码数据访问层
 *
 * @file gift-code.repository.ts
 * @description 赠金码相关的数据库操作
 */
import { db } from '../../db';
import { giftCodes, giftCodeUsages, type GiftCode, type NewGiftCode, type NewGiftCodeUsage } from '../../db/schema';
import { eq, and, like, desc, sql, count } from 'drizzle-orm';

/**
 * 根据ID查找赠金码
 */
export async function findById(id: number): Promise<GiftCode | null> {
  const result = await db.select().from(giftCodes).where(eq(giftCodes.id, id)).limit(1);
  return result[0] || null;
}

/**
 * 根据赠金码字符串查找
 */
export async function findByCode(code: string): Promise<GiftCode | null> {
  const result = await db
    .select()
    .from(giftCodes)
    .where(eq(giftCodes.code, code))
    .limit(1);
  return result[0] || null;
}

/**
 * 分页查询赠金码列表
 */
export async function findMany(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  isActive?: boolean;
}) {
  const { page, pageSize, keyword, isActive } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (keyword) {
    conditions.push(like(giftCodes.code, `%${keyword}%`));
  }
  if (isActive !== undefined) {
    conditions.push(eq(giftCodes.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select()
    .from(giftCodes)
    .where(whereClause)
    .orderBy(desc(giftCodes.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(giftCodes)
    .where(whereClause);

  return {
    list: data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 创建赠金码
 */
export async function create(data: NewGiftCode): Promise<GiftCode> {
  const [result] = await db.insert(giftCodes).values(data).returning();
  return result;
}

/**
 * 更新赠金码
 */
export async function update(id: number, data: Partial<NewGiftCode>): Promise<GiftCode> {
  const [result] = await db
    .update(giftCodes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(giftCodes.id, id))
    .returning();
  return result;
}

/**
 * 删除赠金码
 */
export async function remove(id: number): Promise<void> {
  await db.delete(giftCodes).where(eq(giftCodes.id, id));
}

/**
 * 增加使用次数
 */
export async function incrementUsageCount(id: number): Promise<void> {
  await db
    .update(giftCodes)
    .set({
      usageCount: sql`${giftCodes.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(giftCodes.id, id));
}

/**
 * 查询用户使用次数
 */
export async function getUserUsageCount(giftCodeId: number, userId: number): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(giftCodeUsages)
    .where(
      and(
        eq(giftCodeUsages.giftCodeId, giftCodeId),
        eq(giftCodeUsages.userId, userId)
      )
    );
  return value;
}

/**
 * 创建使用记录
 */
export async function createUsageRecord(data: NewGiftCodeUsage) {
  const [result] = await db.insert(giftCodeUsages).values(data).returning();
  return result;
}

/**
 * 查询赠金码使用记录
 */
export async function findUsageRecords(params: {
  giftCodeId?: number;
  userId?: number;
  page: number;
  pageSize: number;
}) {
  const { giftCodeId, userId, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (giftCodeId) {
    conditions.push(eq(giftCodeUsages.giftCodeId, giftCodeId));
  }
  if (userId) {
    conditions.push(eq(giftCodeUsages.userId, userId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select()
    .from(giftCodeUsages)
    .where(whereClause)
    .orderBy(desc(giftCodeUsages.usedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(giftCodeUsages)
    .where(whereClause);

  return {
    list: data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
