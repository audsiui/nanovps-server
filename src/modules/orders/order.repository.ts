/**
 * 订单数据访问层
 *
 * @file order.repository.ts
 * @description 订单相关的数据库操作
 */
import { db } from '../../db';
import { orders, type Order, type NewOrder } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * 生成订单号
 * 格式: ORD + 年月日 + 6位随机数
 */
export function generateOrderNo(): string {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const randomStr = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD${dateStr}${randomStr}`;
}

/**
 * 根据ID查找订单
 */
export async function findById(id: number): Promise<Order | null> {
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0] || null;
}

/**
 * 根据订单号查找订单
 */
export async function findByOrderNo(orderNo: string): Promise<Order | null> {
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNo, orderNo))
    .limit(1);
  return result[0] || null;
}

/**
 * 创建订单
 */
export async function create(data: NewOrder): Promise<Order> {
  const [result] = await db.insert(orders).values(data).returning();
  return result;
}

/**
 * 更新订单
 */
export async function update(id: number, data: Partial<NewOrder>): Promise<Order> {
  const [result] = await db
    .update(orders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  return result;
}

/**
 * 查询用户订单列表
 */
export async function findByUserId(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: string;
}) {
  const { userId, page, pageSize, status } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(orders.userId, userId)];
  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  const data = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: sql`count(*)`.mapWith(Number) })
    .from(orders)
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
