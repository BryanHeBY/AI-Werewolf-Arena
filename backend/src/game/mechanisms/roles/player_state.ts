/**
 * 负责将角色／能力状态裁剪为已授权玩家可见 DTO；公共结构归 game-contract 的玩家视图契约。
 * 输入为现有状态读视图或显式事实字段；输出为独立投影，不泄露内部来源身份、库存写权或授权句柄。
 * 赠枪投影同时供原 transfer 制作安装数据，字段／status 求值顺序保持；本模块不授枪或转移资源。
 * 纯字段校验和复制只作用于数据，不读 World、时钟、RNG、文件或模型服务。
 */
import type { DeathGunReadView } from "@ai-werewolf-arena/game-contract";
import type {
  PlayerGuardState,
  PlayerHunterState,
  PlayerWolfKingState,
  PlayerWhiteWolfKingState,
  PlayerKnightState,
  PlayerIdiotState,
  PlayerDreamerState,
  PlayerWolfBeautyState,
  PlayerBearState,
  PlayerSeerState,
  PlayerWitchState,
  PlayerRoleInspectionState,
  PlayerDeathGun,
} from "@ai-werewolf-arena/game-contract/player-state-views";
import { WitchSelfHealRule } from "../../../core/domain/model";
import { readInspectionResult } from "@ai-werewolf-arena/replay-contract";

/** 只读取声明的自身数据属性，不调用该字段访问器；不承诺对任意 Proxy 零反射 trap。 */
export function playerDataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && Object.hasOwn(field, "value") ? field.value : undefined;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function positiveOrNull(value: unknown): number | null {
  return positiveInteger(value) ? value : null;
}
function stock(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function rows(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (field && Object.hasOwn(field, "value")) result.push(field.value);
  }
  return result;
}
function nullableTarget(value: unknown): value is number | null {
  return value === null || positiveInteger(value);
}
function inspection(value: unknown) {
  const kind = playerDataField(value, "kind");
  return readInspectionResult(
    kind === "camp"
      ? { kind, camp: playerDataField(value, "camp") }
      : kind === "role"
        ? { kind, role: playerDataField(value, "role") }
        : kind === "combined"
          ? { kind, camp: playerDataField(value, "camp"), role: playerDataField(value, "role") }
          : null,
  );
}

export function projectGuardState(state: unknown): PlayerGuardState {
  const policy = playerDataField(state, "repeatPolicy");
  return {
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    ...(policy === "awa_last_action_v1" || policy === "netease_consecutive_nights_v1"
      ? { repeatPolicy: policy }
      : {}),
  };
}
function projectGunState(state: unknown): PlayerHunterState {
  const policy = playerDataField(state, "deathActionPolicy");
  return {
    canShoot: playerDataField(state, "canShoot") === true,
    ...(policy === "awa_qualified_sources_v1" || policy === "awa_knife_or_exile_v1"
      ? { deathActionPolicy: policy }
      : {}),
  };
}
export function projectHunterState(state: unknown): PlayerHunterState {
  return projectGunState(state);
}
export function projectWolfKingState(state: unknown): PlayerWolfKingState {
  return {
    ...projectGunState(state),
    ...(playerDataField(state, "deathActionPolicy") === "awa_day_deaths_v1"
      ? { deathActionPolicy: "awa_day_deaths_v1" as const }
      : {}),
  };
}
export function projectWhiteWolfKingState(state: unknown): PlayerWhiteWolfKingState {
  return { canDetonate: playerDataField(state, "canDetonate") === true };
}
export function projectKnightState(state: unknown): PlayerKnightState {
  return { canDuel: playerDataField(state, "canDuel") === true };
}
export function projectIdiotState(state: unknown): PlayerIdiotState {
  return { revealed: playerDataField(state, "revealed") === true };
}
export function projectDreamerState(state: unknown): PlayerDreamerState {
  const policy = playerDataField(state, "protectionPolicy");
  return {
    ...(policy === "awa_night_damage_v1" || policy === "netease_2026_night_immunity_v1"
      ? { protectionPolicy: policy }
      : {}),
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    lastDay: positiveOrNull(playerDataField(state, "lastDay")),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        targetId = playerDataField(row, "targetId");
      return positiveInteger(day) && positiveInteger(targetId) ? [{ day, targetId }] : [];
    }),
  };
}
export function projectWolfBeautyState(state: unknown): PlayerWolfBeautyState {
  const policy = playerDataField(state, "deathLinkPolicy");
  return {
    ...(policy === "awa_exile_poison_v1" || policy === "heroes_s7_2017_exile_hunter_v1"
      ? { deathLinkPolicy: policy }
      : {}),
    targetId: positiveOrNull(playerDataField(state, "targetId")),
    lastActedDay: positiveOrNull(playerDataField(state, "lastActedDay")),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        targetId = playerDataField(row, "targetId");
      return positiveInteger(day) && nullableTarget(targetId) ? [{ day, targetId }] : [];
    }),
  };
}
export function projectBearState(state: unknown): PlayerBearState {
  return {
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        roared = playerDataField(row, "roared");
      return positiveInteger(day) && typeof roared === "boolean" ? [{ day, roared }] : [];
    }),
  };
}
export function projectSeerState(state: unknown): PlayerSeerState {
  const targetPolicy = playerDataField(state, "targetPolicy"),
    actionPolicy = playerDataField(state, "actionPolicy");
  const lastIsWerewolf = playerDataField(state, "lastIsWerewolf"),
    lastResult = playerDataField(state, "lastResult");
  return {
    ...(targetPolicy === "awa_alive_v1" || targetPolicy === "awa_fresh_others_v1"
      ? { targetPolicy }
      : {}),
    ...(actionPolicy === "awa_optional_v1" || actionPolicy === "awa_required_when_legal_v1"
      ? { actionPolicy }
      : {}),
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    lastIsWerewolf: typeof lastIsWerewolf === "boolean" ? lastIsWerewolf : null,
    ...(lastResult === undefined
      ? {}
      : { lastResult: lastResult === null ? null : inspection(lastResult) }),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const targetId = playerDataField(row, "targetId"),
        isWerewolf = playerDataField(row, "isWerewolf"),
        result = inspection(playerDataField(row, "result"));
      return positiveInteger(targetId) && typeof isWerewolf === "boolean"
        ? [{ targetId, isWerewolf, ...(result ? { result } : {}) }]
        : [];
    }),
  };
}
export function projectWitchState(state: unknown): PlayerWitchState {
  const rule = playerDataField(state, "selfHealRule");
  const knifeVisibility = playerDataField(state, "knifeVisibility"),
    potionPolicy = playerDataField(state, "potionPolicy");
  return {
    ...(knifeVisibility === "awa_with_heal_v1" || knifeVisibility === "awa_always_v1"
      ? { knifeVisibility }
      : {}),
    ...(potionPolicy === "awa_one_native_v1" || potionPolicy === "awa_both_native_experimental_v1"
      ? { potionPolicy }
      : {}),
    heal: stock(playerDataField(state, "heal")),
    poison: stock(playerDataField(state, "poison")),
    selfHealRule:
      rule === WitchSelfHealRule.Always || rule === WitchSelfHealRule.FirstNightOnly
        ? rule
        : WitchSelfHealRule.Disabled,
    canSelfHeal: playerDataField(state, "canSelfHeal") === true,
    healUsedThisNight: playerDataField(state, "healUsedThisNight") === true,
    poisonUsedThisNight: playerDataField(state, "poisonUsedThisNight") === true,
  };
}
export function projectRoleInspectionState(state: unknown): PlayerRoleInspectionState {
  const policy = playerDataField(state, "policy"),
    inspectionPolicy = playerDataField(state, "inspectionPolicy");
  return {
    ...(inspectionPolicy === "awa_unique_required_v1" ||
    inspectionPolicy === "awa_repeat_optional_v1" ||
    inspectionPolicy === "awa_unique_optional_v1"
      ? { inspectionPolicy }
      : {}),
    ...(policy === "gargoyle" ||
    policy === "psychic" ||
    policy === "mirror" ||
    policy === "pure_white" ||
    policy === "wolf_witch"
      ? { policy }
      : {}),
    lastTarget: positiveOrNull(playerDataField(state, "lastTarget")),
    lastDay: positiveOrNull(playerDataField(state, "lastDay")),
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        targetId = playerDataField(row, "targetId"),
        result = inspection(playerDataField(row, "result"));
      return positiveInteger(day) && positiveInteger(targetId) && result?.kind === "role"
        ? [{ day, targetId, result }]
        : [];
    }),
  };
}

export function projectDeathGun(gun: DeathGunReadView): PlayerDeathGun {
  return {
    id: gun.id,
    kind: "gun",
    source: { kind: gun.source.kind },
    sourceDisclosed: false,
    grantedNight: gun.grantedNight,
    armedOnNight: gun.armedOnNight,
    remaining: gun.remaining,
    disabled: gun.disabled,
    deathExpired: gun.deathExpired,
    status:
      gun.disabled || gun.deathExpired
        ? "disabled"
        : gun.remaining === 0
          ? "spent"
          : gun.armedOnNight === null
            ? "pending"
            : "active",
  };
}
