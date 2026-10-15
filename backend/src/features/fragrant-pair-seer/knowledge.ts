/**
 * 维护香对预言家的玩家已知日志与纯知识更新。输入为已发表通知、已知狼／选择／死亡及 pair ID；输出按原序校验复制和更新，不推导隐藏触发凭据或授予阵容／行动权限。
 */

import { snapshotPlainData } from "../../domain/plain-data";
import { normalizePair } from "./state";
/** 此日志只保存 owner 授权的已知信息，不保存真实触发凭据。 */
export type { FragrantKnowledge } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import {
  readFragrantKnownState,
  type FragrantKnowledge,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
const id = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1;
export function freshFragrantKnowledge(): FragrantKnowledge {
  return {
    knownWolfId: null,
    lastOpenedNight: 0,
    lastChoice: null,
    activeBinding: null,
    used: false,
    knifeNotices: [],
  };
}
export function readFragrantKnowledge(value: unknown): FragrantKnowledge | null {
  try {
    return readFragrantKnownState(snapshotPlainData(value, new Set(), 0, 65536));
  } catch {
    return null;
  }
}
/** 资格由真实夜 owner 冻结，历史本身不授予 live 权限。 */
export function knowFragrantKnife(
  value: FragrantKnowledge,
  day: number,
  eligible: boolean,
): FragrantKnowledge {
  const s = valid(value);
  if (
    day !== s.lastOpenedNight ||
    !id(day) ||
    typeof eligible !== "boolean" ||
    (day === 1 && eligible) ||
    s.knownWolfId === null ||
    (s.knifeNotices.at(-1)?.day ?? 0) >= day ||
    (s.knifeNotices.some((n) => n.eligible) && !eligible)
  )
    throw Error("fragrant_knife_notice_invalid");
  return { ...s, knifeNotices: [...s.knifeNotices, { day, eligible }] };
}
function valid(v: FragrantKnowledge) {
  const s = readFragrantKnowledge(v);
  if (!s) throw Error("fragrant_knowledge_invalid");
  return s;
}
export function knowFragrantWolf(value: FragrantKnowledge, targetId: number): FragrantKnowledge {
  const s = valid(value);
  if (!id(targetId) || s.knownWolfId !== null || s.lastOpenedNight !== 1)
    throw Error("fragrant_known_wolf_duplicate");
  return { ...s, knownWolfId: targetId };
}
/** 仅实际提交夜开启的 owner 可调用；单独阶段标签不触发此更新。 */
export function knowFragrantNightOpen(value: FragrantKnowledge, day: number): FragrantKnowledge {
  const s = valid(value);
  if (!id(day) || day <= s.lastOpenedNight) throw Error("fragrant_known_night_invalid");
  return { ...s, lastOpenedNight: day, activeBinding: null };
}
export function knowFragrantChoice(
  value: FragrantKnowledge,
  day: number,
  targets: unknown,
): FragrantKnowledge {
  const s = valid(value);
  if (
    !id(day) ||
    day !== s.lastOpenedNight ||
    s.lastChoice?.day === day ||
    s.knownWolfId === null ||
    s.used
  )
    throw Error("fragrant_known_choice_unavailable");
  const pairIds = targets === null ? null : normalizePair(targets);
  return {
    ...s,
    lastChoice: { day, pairIds },
    activeBinding: pairIds === null ? null : { createdNight: day, expiresNight: day + 1, pairIds },
  };
}
/** 输入来自授权事件前缀中已发表的真实死亡，不是拟议伤害。 */
export function knowFragrantPublishedDeaths(
  value: FragrantKnowledge,
  day: number,
  publishedIds: unknown,
): FragrantKnowledge {
  const s = valid(value),
    ids = snapshotPlainData(publishedIds);
  if (
    !id(day) ||
    !Array.isArray(ids) ||
    ids.some((v) => !id(v)) ||
    new Set(ids).size !== ids.length
  )
    throw Error("fragrant_public_deaths_invalid");
  if (
    !s.activeBinding ||
    s.activeBinding.createdNight !== day ||
    !s.activeBinding.pairIds.some((v) => ids.includes(v))
  )
    return s;
  return { ...s, activeBinding: null, used: true };
}
