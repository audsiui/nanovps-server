/**
 * 优惠码数据访问层
 *
 * @file promo-code.repository.ts
 * @description 优惠码相关的数据库操作
 */
import { db } from '../../db';
import { promoCodes, promoCodeUsages, type PromoCode, type NewPromoCode, type NewPromoCodeUsage } from '../../db/schema';
import { eq, and, like, desc, sql, count, gte, lte } from 'drizzle-orm';

/**
 * 根据ID查找优惠码
 */
export async function findById(id: number): Promise<PromoCode | null> {
  const result = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  return result[0] || null;
}

/**
 * 根据优惠码字符串查找
 */
export async function findByCode(code: string): Promise<PromoCode | null> {
  const result = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);
  return result[0] || null;
}

/**
 * 分页查询优惠码列表
 */
export async function findMany(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  isActive?: boolean;
}) {
  const { page, pageSize, keyword, isActive } = params;
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions = [];
  if (keyword) {
    conditions.push(like(promoCodes.code, `%${keyword}%`));
  }
  if (isActive !== undefined) {
    conditions.push(eq(promoCodes.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询数据
  const data = await db
    .select()
    .from(promoCodes)
    .where(whereClause)
    .orderBy(desc(promoCodes.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 查询总数
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(promoCodes)
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
 * 创建优惠码
 */
export async function create(data: NewPromoCode): Promise<PromoCode> {
  const [result] = await db.insert(promoCodes).values(data).returning();
  return result;
}

/**
 * 更新优惠码
 */
export async function update(id: number, data: Partial<NewPromoCode>): Promise<PromoCode> {
  const [result] = await db
    .update(promoCodes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(promoCodes.id, id))
    .returning();
  return result;
}

/**
 * 删除优惠码
 */
export async function remove(id: number): Promise<void> {
  await db.delete(promoCodes).where(eq(promoCodes.id, id));
}

/**
 * 增加使用次数
 */
export async function incrementUsageCount(id: number): Promise<void> {
  await db
    .update(promoCodes)
    .set({
      usageCount: sql`${promoCodes.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promoCodes.id, id));
}

/**
 * 查询用户使用次数
 */
export async function getUserUsageCount(promoCodeId: number, userId: number): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(promoCodeUsages)
    .where(
      and(
        eq(promoCodeUsages.promoCodeId, promoCodeId),
        eq(promoCodeUsages.userId, userId)
      )
    );
  return value;
}

/**
 * 创建使用记录
 */
export async function createUsageRecord(data: NewPromoCodeUsage) {
  const [result] = await db.insert(promoCodeUsages).values(data).returning();
  return result;
}

/**
 * 查询优惠码使用记录
 */
export async function findUsageRecords(params: {
  promoCodeId?: number;
  userId?: number;
  page: number;
  pageSize: number;
}) {
  const { promoCodeId, userId, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (promoCodeId) {
    conditions.push(eq(promoCodeUsages.promoCodeId, promoCodeId));
  }
  if (userId) {
    conditions.push(eq(promoCodeUsages.userId, userId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select()
    .from(promoCodeUsages)
    .where(whereClause)
    .orderBy(desc(promoCodeUsages.usedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(promoCodeUsages)
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
