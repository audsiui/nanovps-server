/**
 * 区域数据访问层
 *
 * @file region.repository.ts
 * @description 封装区域表的增删改查数据库操作
 */
import { eq, asc, desc, and, sql } from 'drizzle-orm';
import { db } from '../../db';
import { regions, type Region, type NewRegion } from '../../db/schema/regions';

/**
 * 查询区域列表（支持筛选、排序和分页）
 * 不传分页参数则返回所有数据
 */
export async function findAll(options?: {
  isActive?: boolean;
  orderBy?: 'sortOrder' | 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<{ list: Region[]; total: number }> {
  const { isActive, orderBy = 'sortOrder', order = 'asc', page, pageSize } = options || {};

  const conditions = [];
  if (isActive !== undefined) {
    conditions.push(eq(regions.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(regions)
    .where(whereClause)
    .limit(1);
  const total = countResult[0]?.count || 0;

  // 构建排序
  const orderByColumn = orderBy === 'sortOrder' ? regions.sortOrder : regions.id;
  const orderFn = order === 'asc' ? asc : desc;

  // 构建查询
  let query = db
    .select()
    .from(regions)
    .where(whereClause)
    .orderBy(orderFn(orderByColumn));

  // 如果传了分页参数，则添加分页
  if (page !== undefined && pageSize !== undefined) {
    const offset = (page - 1) * pageSize;
    query = query.limit(pageSize).offset(offset);
  }

  const list = await query;

  return { list, total };
}

/**
 * 根据ID查询区域
 */
export async function findById(id: number): Promise<Region | undefined> {
  const result = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  return result[0];
}

/**
 * 根据代码查询区域
 */
export async function findByCode(code: string): Promise<Region | undefined> {
  const result = await db
    .select()
    .from(regions)
    .where(eq(regions.code, code))
    .limit(1);
  return result[0];
}

/**
 * 创建区域
 */
export async function create(data: NewRegion): Promise<Region> {
  const result = await db.insert(regions).values(data).returning();
  return result[0];
}

/**
 * 更新区域
 */
export async function update(
  id: number,
  data: Partial<NewRegion>,
): Promise<Region | undefined> {
  const result = await db
    .update(regions)
    .set(data)
    .where(eq(regions.id, id))
    .returning();
  return result[0];
}

/**
 * 删除区域
 */
export async function remove(id: number): Promise<boolean> {
  const result = await db.delete(regions).where(eq(regions.id, id)).returning();
  return result.length > 0;
}

/**
 * 检查代码是否已存在
 */
export async function existsByCode(code: string, excludeId?: number): Promise<boolean> {
  const conditions = [eq(regions.code, code)];
  if (excludeId) {
    conditions.push(sql`${regions.id} != ${excludeId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(regions)
    .where(and(...conditions))
    .limit(1);

  return result[0]?.count > 0;
}
