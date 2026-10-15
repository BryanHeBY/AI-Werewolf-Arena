/**
 * 负责夜间阶段的显式同引用兼容与鬼魂新娘替换登记。输入为已收集的 handler 引用和编译器婚约 handler，
 * 输出为登记 Map、替换引用记录或具名冲突；登记不查询 World，actor／库存资格仍由完整 owner 复验。
 * 同一已观察 ID 只允许原 handler 同引用共享，不读取 priority／execute 做额外等价推断。
 * 婚约替换按原四步顺序执行；克隆引用在原参数位置捕获，set 成功后才加入变更记录。
 */
import type { NightStageDefinition as NightStageHandler } from "../engine/night/contracts";
import type { GhostStageRegistrationChange } from "./night-stage-plan-contracts";

export const NIGHT_STAGE_SHARING = Object.freeze({
  compatibility: "same-original-handler-reference",
  sources: Object.freeze(["role-profile", "compiler-reservation"] as const),
  conflictCode: "night_stage_handler_conflict",
} as const);

/** 固定的四个现有操作按数组顺序执行，不构造通用替换图或扩展可替换 ID。 */
export const GHOST_BRIDE_STAGE_OPERATIONS = Object.freeze([
  Object.freeze({ kind: "remove", id: "wolf_kill_vote" } as const),
  Object.freeze({ kind: "install", source: "wedding-chat" } as const),
  Object.freeze({ kind: "install", source: "wedding-knife" } as const),
  Object.freeze({ kind: "reprioritize-if-present", id: "wolf_discussion", priority: 350 } as const),
] as const);

export function registerNightStages(
  collected: readonly NightStageHandler[],
): Map<string, NightStageHandler> {
  const registered = new Map<string, NightStageHandler>();
  for (const stage of collected) {
    const observedId = stage.id;
    if (!registered.has(observedId)) {
      // 新登记获选者仍第二次读取原 id；访问器变化或抛错的前缀不能由缓存首值替代。
      const registeredId = stage.id,
        existing = registered.get(registeredId);
      if (existing !== undefined && existing !== stage) conflict(registeredId);
      registered.set(registeredId, stage);
    } else if (registered.get(observedId) !== stage) {
      conflict(observedId);
    }
  }
  return registered;
}

function conflict(observedId: string): never {
  const suffix = typeof observedId === "string" ? `:${observedId}` : "";
  throw new Error(NIGHT_STAGE_SHARING.conflictCode + suffix);
}

export function applyGhostBrideStageRegistration(
  registered: Map<string, NightStageHandler>,
  weddingChat: NightStageHandler,
  weddingKnife: NightStageHandler,
): readonly GhostStageRegistrationChange[] {
  const changes: GhostStageRegistrationChange[] = [];
  for (const operation of GHOST_BRIDE_STAGE_OPERATIONS) {
    switch (operation.kind) {
      case "remove":
        registered.delete(operation.id);
        break;
      case "install": {
        const stage = operation.source === "wedding-chat" ? weddingChat : weddingKnife;
        // Map 写入成功后才记录引用；若 set 抛错，之前的删除／安装保持，不回滚已执行操作。
        registered.set(stage.id, stage);
        changes.push(Object.freeze({ handler: stage, operation: operation.source }));
        break;
      }
      case "reprioritize-if-present": {
        const chat = registered.get(operation.id);
        if (chat) {
          let replacement: NightStageHandler = chat;
          registered.set(chat.id, (replacement = { ...chat, priority: operation.priority }));
          bindNightStageAlias(replacement, chat);
          changes.push(
            Object.freeze({
              handler: replacement,
              original: chat,
              operation: "ordinary-chat-priority",
            }),
          );
        }
        break;
      }
    }
  }
  return Object.freeze(changes);
}

// 替换的来源关系只持 handler 引用；成功登记之后才关联，不缓存 World 或 actor 许可。
const stageAliases = new WeakMap<object, object>();
/** 可信组合明确关联 wrapper 与原完整程序；不按 id、priority 或函数形状继承能力。 */
export function bindNightStageAlias<T extends object>(handler: T, source: object): T {
  stageAliases.set(handler, source);
  return handler;
}
/** 仅组合根查来源；没有公开 runtime／World 的反查出口。 */
export function sourceNightStageHandler(handler: object): object {
  const seen = new Set<object>();
  let source = handler;
  while (stageAliases.has(source)) {
    if (seen.has(source)) throw new Error("night_stage_binding_cycle");
    seen.add(source);
    source = stageAliases.get(source)!;
  }
  return source;
}
