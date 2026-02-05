/**
 * 套餐模板数据访问层
 *
 * @file plan-template.repository.ts
 * @description 封装套餐模板表的增删改查数据库操作
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db';
import { planTemplates, type PlanTemplate, type NewPlanTemplate } from '../../db/schema/planTemplates';

/**
 * 查询套餐模板列表
 */
export async function findAll(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<{ list: PlanTemplate[]; total: number }> {
  const { page = 1, pageSize = 10, keyword } = params || {};

  const conditions = [];
  if (keyword) {
    conditions.push(sql`${planTemplates.name} ILIKE ${`%${keyword}%`}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(planTemplates)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  const list = await db
    .select()
    .from(planTemplates)
    .where(whereClause)
    .orderBy(desc(planTemplates.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { list, total };
}

/**
 * 根据ID查询套餐模板
 */
export async function findById(id: number): Promise<PlanTemplate | undefined> {
  const result = await db.select().from(planTemplates).where(eq(planTemplates.id, id)).limit(1);
  return result[0];
}

/**
 * 创建套餐模板
 */
export async function create(data: NewPlanTemplate): Promise<PlanTemplate> {
  const result = await db.insert(planTemplates).values(data).returning();
  return result[0];
}

/**
 * 更新套餐模板
 */
export async function update(
  id: number,
  data: Partial<NewPlanTemplate>,
): Promise<PlanTemplate | undefined> {
  const result = await db.update(planTemplates).set(data).where(eq(planTemplates.id, id)).returning();
  return result[0];
}

/**
 * 删除套餐模板
 */
export async function remove(id: number): Promise<boolean> {
  const result = await db.delete(planTemplates).where(eq(planTemplates.id, id)).returning();
  return result.length > 0;
}
