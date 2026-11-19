import { Prisma } from '@prisma/client';

/**
 * 让 MySQL DATETIME 列按 UTC+8（北京时间）墙钟存储：
 * - 写入：所有 Date 参数统一 +8h；未显式传入的 createdAt/updatedAt 注入 +8h 当前时间，
 *   覆盖 Prisma 默认的 @default(now()) / @updatedAt（它们按 UTC 生成）。
 * - 读取：晚于切换时间点（CUTOFF）的 Date -8h 还原成真实 UTC 时刻，
 *   保证 API 返回值与改动前完全一致；早于 CUTOFF 的历史数据保持原样读写。
 * 净效果：仅 Adminer / 数据库里看到的时间变为北京时间，应用行为不变。
 */

const OFFSET_MS = 8 * 60 * 60 * 1000;
// 切换部署时间点（UTC）。新数据的存储值 >= CUTOFF + 8h，历史数据 <= CUTOFF，
// 读取时用中点 +4h 作为判别阈值，两侧各留 4 小时余量。
const CUTOFF_MS = Date.UTC(2026, 10, 19, 2, 0, 0); // 2026-11-19 02:00:00 UTC
const UNSHIFT_THRESHOLD_MS = CUTOFF_MS + OFFSET_MS / 2;

function dbNow(): Date {
  return new Date(Date.now() + OFFSET_MS);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !(value instanceof Date);
}

/** 就地遍历 args 树，把作为参数传入的 Date 平移 offsetMs */
function shiftDateArgs(value: unknown, offsetMs: number): void {
  if (Array.isArray(value)) {
    for (const item of value) shiftDateArgs(item, offsetMs);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (v instanceof Date) {
      value[key] = new Date(v.getTime() + offsetMs);
    } else {
      shiftDateArgs(v, offsetMs);
    }
  }
}

/** 就地遍历查询结果，把新数据（晚于阈值）的 Date 还原回真实 UTC 时刻 */
function unshiftDateResults(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) unshiftDateResults(item);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (v instanceof Date) {
      if (v.getTime() > UNSHIFT_THRESHOLD_MS) {
        value[key] = new Date(v.getTime() - OFFSET_MS);
      }
    } else {
      unshiftDateResults(v);
    }
  }
}

// 各模型是否拥有 createdAt / updatedAt 字段（注入默认值前先做存在性判断）
const timeFieldMeta = new Map<string, { createdAt: boolean; updatedAt: boolean }>();
for (const model of Prisma.dmmf.datamodel.models) {
  const names = new Set(model.fields.map((f) => f.name));
  timeFieldMeta.set(model.name, {
    createdAt: names.has('createdAt'),
    updatedAt: names.has('updatedAt'),
  });
}

function injectDefaults(
  meta: { createdAt: boolean; updatedAt: boolean },
  data: Record<string, unknown>,
  includeCreatedAt: boolean,
): void {
  if (includeCreatedAt && meta.createdAt && data.createdAt === undefined) {
    data.createdAt = dbNow();
  }
  if (meta.updatedAt && data.updatedAt === undefined) {
    data.updatedAt = dbNow();
  }
}

/** 对 create / update / upsert / createMany / updateMany 注入 +8h 的时间默认值 */
function injectTimestampDefaults(model: string, operation: string, args: unknown): void {
  const meta = timeFieldMeta.get(model);
  if (!meta || !isPlainObject(args)) return;
  const data = args.data;
  if (!data) return;

  switch (operation) {
    case 'create':
      if (isPlainObject(data)) injectDefaults(meta, data, true);
      break;
    case 'upsert':
      if (isPlainObject(data)) {
        if (isPlainObject(data.create)) injectDefaults(meta, data.create, true);
        if (isPlainObject(data.update)) injectDefaults(meta, data.update, false);
      }
      break;
    case 'update':
    case 'updateMany':
      if (isPlainObject(data)) injectDefaults(meta, data, false);
      break;
    case 'createMany':
      if (Array.isArray(data)) {
        for (const item of data) {
          if (isPlainObject(item)) injectDefaults(meta, item, true);
        }
      } else if (isPlainObject(data)) {
        injectDefaults(meta, data, true);
      }
      break;
  }
}

export async function dbTimeOperation(ctx: {
  model: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}): Promise<unknown> {
  shiftDateArgs(ctx.args, OFFSET_MS);
  injectTimestampDefaults(ctx.model, ctx.operation, ctx.args);
  const result = await ctx.query(ctx.args);
  unshiftDateResults(result);
  return result;
}

export const dbTimeExtension = Prisma.defineExtension({
  name: 'dbTimeUtc8',
  query: {
    $allModels: {
      $allOperations: dbTimeOperation,
    },
  },
});
