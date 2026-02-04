/**
 * 镜像数据访问层
 *
 * @file image.repository.ts
 * @description 封装镜像表的增删改查数据库操作
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db';
import { images, type Image, type NewImage } from '../../db/schema/images';

/**
 * 查询镜像列表（支持筛选和分页）
 * 不传分页参数则返回所有数据
 */
export async function findAll(options?: {
  isActive?: boolean;
  family?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: Image[]; total: number }> {
  const { isActive, family, page, pageSize } = options || {};

  const conditions = [];
  if (isActive !== undefined) {
    conditions.push(eq(images.isActive, isActive));
  }
  if (family) {
    conditions.push(eq(images.family, family));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(whereClause)
    .limit(1);
  const total = countResult[0]?.count || 0;

  // 构建查询（默认按 id 排序）
  let query = db
    .select()
    .from(images)
    .where(whereClause)
    .orderBy(images.id);

  // 如果传了分页参数，则添加分页
  if (page !== undefined && pageSize !== undefined) {
    const offset = (page - 1) * pageSize;
    query = query.limit(pageSize).offset(offset);
  }

  const list = await query;

  return { list, total };
}

/**
 * 根据ID查询镜像
 */
export async function findById(id: number): Promise<Image | undefined> {
  const result = await db.select().from(images).where(eq(images.id, id)).limit(1);
  return result[0];
}

/**
 * 根据镜像地址查询
 */
export async function findByImageRef(imageRef: string): Promise<Image | undefined> {
  const result = await db
    .select()
    .from(images)
    .where(eq(images.imageRef, imageRef))
    .limit(1);
  return result[0];
}

/**
 * 创建镜像
 */
export async function create(data: NewImage): Promise<Image> {
  const result = await db.insert(images).values(data).returning();
  return result[0];
}

/**
 * 更新镜像
 */
export async function update(
  id: number,
  data: Partial<NewImage>,
): Promise<Image | undefined> {
  const result = await db
    .update(images)
    .set(data)
    .where(eq(images.id, id))
    .returning();
  return result[0];
}

/**
 * 删除镜像
 */
export async function remove(id: number): Promise<boolean> {
  const result = await db.delete(images).where(eq(images.id, id)).returning();
  return result.length > 0;
}

/**
 * 检查镜像地址是否已存在
 */
export async function existsByImageRef(imageRef: string, excludeId?: number): Promise<boolean> {
  const conditions = [eq(images.imageRef, imageRef)];
  if (excludeId) {
    conditions.push(sql`${images.id} != ${excludeId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(and(...conditions))
    .limit(1);

  return result[0]?.count > 0;
}
