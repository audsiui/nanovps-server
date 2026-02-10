/**
 * 充值记录数据访问层
 *
 * @file recharge.repository.ts
 * @description 充值记录相关的数据库操作
 */
import { db } from '../../db';
import { recharges, type Recharge, type NewRecharge } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * 生成充值单号
 * 格式: REC + 年月日 + 6位随机数
 */
export function generateRechargeNo(): string {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const randomStr = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `REC${dateStr}${randomStr}`;
}

/**
 * 根据ID查找充值记录
 */
export async function findById(id: number): Promise<Recharge | null> {
  const result = await db.select().from(recharges).where(eq(recharges.id, id)).limit(1);
  return result[0] || null;
}

/**
 * 根据充值单号查找
 */
export async function findByRechargeNo(rechargeNo: string): Promise<Recharge | null> {
  const result = await db
    .select()
    .from(recharges)
    .where(eq(recharges.rechargeNo, rechargeNo))
    .limit(1);
  return result[0] || null;
}

/**
 * 创建充值记录
 */
export async function create(data: NewRecharge): Promise<Recharge> {
  const [result] = await db.insert(recharges).values(data).returning();
  return result;
}

/**
 * 更新充值记录
 */
export async function update(id: number, data: Partial<NewRecharge>): Promise<Recharge> {
  const [result] = await db
    .update(recharges)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(recharges.id, id))
    .returning();
  return result;
}

/**
 * 查询用户充值记录
 */
export async function findByUserId(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: string;
}) {
  const { userId, page, pageSize, status } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(recharges.userId, userId)];
  if (status) {
    conditions.push(eq(recharges.status, status as any));
  }

  const data = await db
    .select()
    .from(recharges)
    .where(and(...conditions))
    .orderBy(desc(recharges.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: sql`count(*)`.mapWith(Number) })
    .from(recharges)
    .where(and(...conditions));

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
