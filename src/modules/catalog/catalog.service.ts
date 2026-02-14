/**
 * 产品目录服务层
 *
 * @file catalog.service.ts
 * @description 为前端应用端提供区域-节点-套餐的层级数据聚合查询
 */
import { db } from '../../db';
import { regions } from '../../db/schema/regions';
import { nodes } from '../../db/schema/nodes';
import { nodePlans } from '../../db/schema/nodePlans';
import { planTemplates } from '../../db/schema/planTemplates';
import { eq, and, asc, desc } from 'drizzle-orm';
import { isNodeConnected } from '../agent-channel/command.service';

/**
 * 套餐信息（包含模板详情）
 */
export interface CatalogPlan {
  id: number;
  stock: number;
  soldCount: number;
  billingCycles: {
    cycle: string;
    name: string;
    months: number;
    price: number;
    enabled: boolean;
    sortOrder: number;
  }[];
  sortOrder: number;
  template: {
    id: number;
    name: string;
    cpu: number;
    ramMb: number;
    diskGb: number;
    trafficGb: number | null;
    bandwidthMbps: number | null;
    portCount: number | null;
  };
}

/**
 * 节点信息（包含套餐列表）
 */
export interface CatalogNode {
  id: number;
  name: string;
  ipv4: string | null;
  status: number;
  plans: CatalogPlan[];
}

/**
 * 区域信息（包含节点列表）
 */
export interface CatalogRegion {
  id: number;
  name: string;
  code: string;
  nodes: CatalogNode[];
}

/**
 * 获取完整的产品目录
 * 返回启用的区域 -> 在线的节点 -> 上架的套餐（含模板信息）
 */
export async function getCatalog(): Promise<CatalogRegion[]> {
  // 1. 获取所有启用的区域，按 sortOrder 排序
  const enabledRegions = await db
    .select()
    .from(regions)
    .where(eq(regions.isActive, true))
    .orderBy(asc(regions.sortOrder), asc(regions.id));

  const result: CatalogRegion[] = [];

  for (const region of enabledRegions) {
    // 2. 获取该区域下在线的节点（status = 1），按 id 排序
    const onlineNodes = await db
      .select({
        id: nodes.id,
        name: nodes.name,
        ipv4: nodes.ipv4,
        status: nodes.status,
      })
      .from(nodes)
      .where(and(eq(nodes.regionId, region.id), eq(nodes.status, 1)))
      .orderBy(asc(nodes.id));

    const catalogNodes: CatalogNode[] = [];

    for (const node of onlineNodes) {
      // 3. 获取该节点上在售的套餐（status = 1），按 sortOrder 排序
      const availablePlans = await db
        .select({
          plan: nodePlans,
          template: planTemplates,
        })
        .from(nodePlans)
        .innerJoin(planTemplates, eq(nodePlans.planTemplateId, planTemplates.id))
        .where(and(eq(nodePlans.nodeId, node.id), eq(nodePlans.status, 1)))
        .orderBy(asc(nodePlans.sortOrder), asc(nodePlans.id));

      const catalogPlans: CatalogPlan[] = availablePlans.map(({ plan, template }) => ({
        id: plan.id,
        stock: plan.stock,
        soldCount: plan.soldCount,
        billingCycles: plan.billingCycles,
        sortOrder: plan.sortOrder,
        template: {
          id: template.id,
          name: template.name,
          cpu: template.cpu,
          ramMb: template.ramMb,
          diskGb: template.diskGb,
          trafficGb: template.trafficGb,
          bandwidthMbps: template.bandwidthMbps,
          portCount: template.portCount,
        },
      }));

      // 只添加有套餐的节点
      if (catalogPlans.length > 0) {
        catalogNodes.push({
          id: node.id,
          name: node.name,
          ipv4: node.ipv4,
          status: node.status,
          plans: catalogPlans,
        });
      }
    }

    // 只添加有节点的区域
    if (catalogNodes.length > 0) {
      result.push({
        id: region.id,
        name: region.name,
        code: region.code,
        nodes: catalogNodes,
      });
    }
  }

  return result;
}

/**
 * 获取指定区域的产品目录
 */
export async function getCatalogByRegionId(regionId: number): Promise<CatalogRegion | null> {
  // 获取区域信息
  const [region] = await db
    .select()
    .from(regions)
    .where(and(eq(regions.id, regionId), eq(regions.isActive, true)))
    .limit(1);

  if (!region) {
    return null;
  }

  // 获取在线节点
  const onlineNodes = await db
    .select({
      id: nodes.id,
      name: nodes.name,
      ipv4: nodes.ipv4,
      status: nodes.status,
    })
    .from(nodes)
    .where(and(eq(nodes.regionId, region.id), eq(nodes.status, 1)))
    .orderBy(asc(nodes.id));

  const catalogNodes: CatalogNode[] = [];

  for (const node of onlineNodes) {
    const availablePlans = await db
      .select({
        plan: nodePlans,
        template: planTemplates,
      })
      .from(nodePlans)
      .innerJoin(planTemplates, eq(nodePlans.planTemplateId, planTemplates.id))
      .where(and(eq(nodePlans.nodeId, node.id), eq(nodePlans.status, 1)))
      .orderBy(asc(nodePlans.sortOrder), asc(nodePlans.id));

    const catalogPlans: CatalogPlan[] = availablePlans.map(({ plan, template }) => ({
      id: plan.id,
      stock: plan.stock,
      soldCount: plan.soldCount,
      billingCycles: plan.billingCycles,
      sortOrder: plan.sortOrder,
      template: {
        id: template.id,
        name: template.name,
        cpu: template.cpu,
        ramMb: template.ramMb,
        diskGb: template.diskGb,
        trafficGb: template.trafficGb,
        bandwidthMbps: template.bandwidthMbps,
        portCount: template.portCount,
      },
    }));

    if (catalogPlans.length > 0) {
      catalogNodes.push({
        id: node.id,
        name: node.name,
        ipv4: node.ipv4,
        status: node.status,
        plans: catalogPlans,
      });
    }
  }

  return {
    id: region.id,
    name: region.name,
    code: region.code,
    nodes: catalogNodes,
  };
}

/**
 * 获取套餐详情（用于下单页面）
 */
export async function getPlanDetail(nodePlanId: number) {
  const result = await db
    .select({
      nodePlan: nodePlans,
      template: planTemplates,
      node: {
        id: nodes.id,
        name: nodes.name,
        ipv4: nodes.ipv4,
        regionId: nodes.regionId,
      },
    })
    .from(nodePlans)
    .innerJoin(planTemplates, eq(nodePlans.planTemplateId, planTemplates.id))
    .innerJoin(nodes, eq(nodePlans.nodeId, nodes.id))
    .where(
      and(
        eq(nodePlans.id, nodePlanId),
        eq(nodePlans.status, 1),
        eq(nodes.status, 1)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const { nodePlan, template, node } = result[0];

  // 获取区域信息
  const [region] = await db
    .select({
      id: regions.id,
      name: regions.name,
      code: regions.code,
    })
    .from(regions)
    .where(and(eq(regions.id, node.regionId!), eq(regions.isActive, true)))
    .limit(1);

  if (!region) {
    return null;
  }

  return {
    id: nodePlan.id,
    stock: nodePlan.stock,
    soldCount: nodePlan.soldCount,
    billingCycles: nodePlan.billingCycles,
    template: {
      id: template.id,
      name: template.name,
      cpu: template.cpu,
      ramMb: template.ramMb,
      diskGb: template.diskGb,
      trafficGb: template.trafficGb,
      bandwidthMbps: template.bandwidthMbps,
      portCount: template.portCount,
    },
    node: {
      id: node.id,
      name: node.name,
      ipv4: node.ipv4,
    },
    region: {
      id: region.id,
      name: region.name,
      code: region.code,
    },
  };
}


/**
 * 获取套餐节点的在线状态
 * 用于购买前检查节点是否在线
 */
export async function getNodePlanStatus(nodePlanId: number): Promise<{
  online: boolean;
  nodeId: number;
  nodeName: string;
  message?: string;
}> {
  const result = await db
    .select({
      nodeId: nodes.id,
      nodeName: nodes.name,
      nodeStatus: nodes.status,
    })
    .from(nodePlans)
    .innerJoin(nodes, eq(nodePlans.nodeId, nodes.id))
    .where(eq(nodePlans.id, nodePlanId))
    .limit(1);

  if (result.length === 0) {
    return {
      online: false,
      nodeId: 0,
      nodeName: '',
      message: '套餐不存在',
    };
  }

  const { nodeId, nodeName, nodeStatus } = result[0];

  // 检查节点是否被禁用
  if (nodeStatus !== 1) {
    return {
      online: false,
      nodeId,
      nodeName,
      message: '节点已禁用',
    };
  }

  // 检查 WebSocket 连接状态
  const online = isNodeConnected(nodeId);

  return {
    online,
    nodeId,
    nodeName,
    message: online ? undefined : '节点离线，容器将在节点上线后自动创建',
  };
}
