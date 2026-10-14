/**
 * 负责猎魔人原参与者的私态引用证据、最近同步审计数据及 checkpoint 数据编码。
 * 输入保留原 Participant／checkpoint 字段与已捕获库存；输出为原引用检查、原副本或原异常。
 * 数据仍放在同一参与者对象，不建第二库存或缓存；JSON 影子只描述最近同步提交，不授予行动。
 * World、生命、夜间、资源资格、请求与冻结仍由 authority 在原点复验；委托查询只在原分支晚调用。
 * 编码、字段写入或成功标记失败保留此前前缀，不退款、刷新 live 数据或加强原 schema 接受面。
 */
import { types } from "node:util";
import { Camp } from "../../../../core/domain/identity";
import type { Role } from "../../../../core/domain/identity";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { VictoryComponent } from "../../../../core/domain/components/victory";
import type { VotingRightComponent } from "../../../../core/domain/components/voting_right";
import type { StatusMark } from "@ai-werewolf-arena/game-contract";
import type { StatusMarkSnapshot } from "../../../../core/domain/components/status_marks";
import { demonJson, demonSnapshot, ownDemonData } from "./state-slot";

/** 顶层槽引用与嵌套库存路径分别保留原身份；JSON 相等不能恢复被替换的原引用。 */
export interface DemonParticipantStateData {
  privateState: RoleComponent["privateState"];
  privateRefs: ReadonlyArray<readonly [string, unknown]>;
  inventoryRefs: ReadonlyArray<readonly [readonly string[], object]>;
  victoryJson: string;
  auditPrivateJson: string;
  delegatedKey: "noble" | "secretBody" | null;
}
/** 两串仍存在原 checkpoint 中，物理警徽／票权提交及其权限属于原同步领域流程。 */
export interface DemonCheckpointAuditData {
  badge: object;
  vote: object;
  badgeJson: string;
  voteJson: string;
}
export interface DemonDelegatedPrivateData {
  nobleId: number;
  bodyId: number;
  noble: unknown;
  body: unknown;
}
type PrivateData = Pick<DemonParticipantStateData, "privateState" | "inventoryRefs" | "privateRefs" | "auditPrivateJson" | "delegatedKey">;
type AuditData = Pick<DemonParticipantStateData, "privateState" | "auditPrivateJson">;

/** 原 descriptor 递归先记录父路径再访问子对象；不新增 seen/schema，原捕获方已按原序验证数据。 */
export function inventoryReferences(value: object): Array<readonly [readonly string[], object]> {
  const references: Array<readonly [readonly string[], object]> = [];
  const visit = (item: object, path: string[]): void => {
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
      if ("value" in descriptor && descriptor.value && typeof descriptor.value === "object") {
        const next = [...path, key];
        references.push([next, descriptor.value]);
        visit(descriptor.value, next);
      }
    }
  };
  visit(value, []);
  return references;
}
export function originalInventory(p: Pick<PrivateData, "privateState" | "inventoryRefs">): boolean {
  return p.inventoryRefs.every(([path, original]) => {
    let current: unknown = p.privateState;
    for (const key of path) current = ownDemonData(current, key);
    return current === original && !types.isProxy(original);
  });
}
/** 可选 handoffPolicy 的缺失与 accessor 拒绝仍有区别；原 own-data 和数值接受集合保持。 */
export function demonBadgeJson(badge: unknown): string | null {
  if (!badge || typeof badge !== "object" || types.isProxy(badge)) return null;
  const optional = Object.getOwnPropertyDescriptor(badge, "handoffPolicy");
  if (optional && !("value" in optional)) return null;
  const isSheriff = ownDemonData(badge, "isSheriff"),
    destroyed = ownDemonData(badge, "destroyed"),
    voteWeight = ownDemonData(badge, "voteWeight"),
    handoffPolicy = ownDemonData(badge, "handoffPolicy");
  return typeof isSheriff === "boolean" &&
    typeof destroyed === "boolean" &&
    typeof voteWeight === "number" &&
    Number.isFinite(voteWeight) &&
    voteWeight > 0 &&
    (handoffPolicy === undefined ||
      handoffPolicy === "awa_next_seat_v1" ||
      handoffPolicy === "awa_holder_choice_v1")
    ? JSON.stringify({
        isSheriff,
        destroyed,
        voteWeight,
        ...(handoffPolicy === undefined ? {} : { handoffPolicy }),
      })
    : null;
}
export function demonVoteJson(vote: unknown): string | null {
  const weight = ownDemonData(vote, "weight"),
    canVote = ownDemonData(vote, "canVote");
  return typeof weight === "number" &&
    Number.isFinite(weight) &&
    (weight > 0 || (weight === 0 && canVote === false)) &&
    typeof canVote === "boolean"
    ? JSON.stringify({ weight, canVote })
    : null;
}
/** 私态先安全编码；无委托即比较原串，有委托才复验并逐次 parse／删键／stringify。 */
export function privateAuditCurrent(p: PrivateData, delegatedCurrent: () => boolean): boolean {
  const current = demonJson(p.privateState);
  if (!current) return false;
  if (!p.delegatedKey) return current === p.auditPrivateJson;
  if (!delegatedCurrent()) return false;
  const actual = JSON.parse(current),
    expected = JSON.parse(p.auditPrivateJson);
  delete actual[p.delegatedKey];
  delete expected[p.delegatedKey];
  return JSON.stringify(actual) === JSON.stringify(expected);
}
export function committedPrivate(p: PrivateData & { readonly id: number }, readDelegated: () => DemonDelegatedPrivateData): Record<string, unknown> {
  const cached = JSON.parse(p.auditPrivateJson) as Record<string, unknown>;
  if (p.delegatedKey) {
    const owned = readDelegated();
    if (p.id !== (p.delegatedKey === "noble" ? owned.nobleId : owned.bodyId))
      throw Error("demon_hunter_delegated_actor_invalid");
    cached[p.delegatedKey] = p.delegatedKey === "noble" ? owned.noble : owned.body;
  }
  return cached;
}
/** 原验证与 delegatedKey 选择已经完成；原位置捕获同一容器和路径，不克隆 live 库存。 */
export function captureDemonParticipantPrivateData(
  privateState: object,
  delegatedKey: DemonParticipantStateData["delegatedKey"],
  privateJson: string,
): Omit<DemonParticipantStateData, "victoryJson"> {
  return {
    privateState: privateState as RoleComponent["privateState"],
    privateRefs: Object.entries(privateState),
    inventoryRefs: inventoryReferences(privateState).filter(
      ([path]) => path.length === 1 || path[0] !== delegatedKey,
    ),
    delegatedKey,
    auditPrivateJson: privateJson,
  };
}
/** 原身份前置检查通过后才比较顶层 descriptor；不与先前 World／Camp 查询合并或提前。 */
export function demonPrivateRefsCurrent(p: Pick<PrivateData, "privateRefs">, descriptors: PropertyDescriptorMap): boolean {
  return Object.keys(descriptors).length === p.privateRefs.length &&
    p.privateRefs.every(
      ([key, value]) =>
        descriptors[key] && "value" in descriptors[key]! && descriptors[key]!.value === value,
    );
}
/** 调用方已核原消耗／history 或 frame current；原 JSON 求值后才覆盖最近安全串。 */
export function refreshDemonParticipantAudit(p: AuditData): void {
  p.auditPrivateJson = demonJson(p.privateState)!;
}
/** 原药 frame 资格已经复验，按原顺序复制完整私态并读取原生药四层数据；不重算库存。 */
export function captureDemonWitchAuditData(p: AuditData) {
  const original = demonSnapshot(p.privateState) as Record<string, unknown>,
    abilities = ownDemonData(original, "abilities") as Record<string, unknown>,
    snapshot = ownDemonData(abilities, "native:potion") as Record<string, unknown>,
    state = ownDemonData(snapshot, "state") as Record<string, unknown>;
  return { original, abilities, snapshot, state };
}
/** 已置 witchOpened 后进行原同步 reset：先编码模板，再写三个 live 字段、核整容器，最后更新 audit。 */
export function resetDemonWitchParticipantData(
  p: AuditData, original: Record<string, unknown>, abilities: Record<string, unknown>,
  snapshot: Record<string, unknown>, state: Record<string, unknown>, originalState: Record<string, unknown>,
) {
  const resetState: Record<string, unknown> = {
    ...state,
    healUsedThisNight: false,
    poisonUsedThisNight: false,
    canSelfHeal: false,
  };
  const resetAbility = { ...snapshot, state: resetState };
  const resetJson = JSON.stringify(resetAbility);
  originalState.healUsedThisNight = false;
  originalState.poisonUsedThisNight = false;
  originalState.canSelfHeal = false;
  const resetPrivate = { ...original, abilities: { ...abilities, "native:potion": resetAbility } };
  if (demonJson(p.privateState) !== JSON.stringify(resetPrivate))
    throw new Error("demon_hunter_native_reset_failed");
  p.auditPrivateJson = JSON.stringify(resetPrivate);
  return { resetState, resetAbility, resetJson };
}
/** 原调用方已核 potion/current；先编码／比较完整期望私态，再原成功标记，最后写 audit。 */
export function commitDemonWitchParticipantData(
  p: AuditData, original: Record<string, unknown>, abilities: Record<string, unknown>,
  snapshot: Record<string, unknown>, resetState: Record<string, unknown>, resetAbility: Record<string, unknown>,
  n: { readonly day: number }, potion: "heal" | "poison" | "none", markCommitted: (json: string) => void,
): boolean {
  const expectedState = { ...resetState };
  if (potion !== "none") {
    if ((resetState[potion] as number) < 1) return false;
    expectedState[potion] = (resetState[potion] as number) - 1;
    expectedState[potion === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
  }
  const expectedAbility = {
    ...resetAbility,
    state: expectedState,
    uses: (snapshot.uses as number) + (potion === "none" ? 0 : 1),
    lastUsedDay: n.day,
  };
  const expectedPrivate = {
    ...original,
    abilities: { ...abilities, "native:potion": expectedAbility },
  };
  const json = JSON.stringify(expectedPrivate);
  if (demonJson(p.privateState) !== json) return false;
  markCommitted(json);
  p.auditPrivateJson = json;
  return true;
}
/** 原 native kind/id 已选；保原 optional 参与者串、条件 parse 与后续三层读取。 */
export function captureDemonNativeAuditData(p: AuditData | undefined, id: string) {
  const originalJson = p?.auditPrivateJson;
  const original = originalJson ? (JSON.parse(originalJson) as Record<string, unknown>) : null;
  const abilities = original?.abilities as Record<string, unknown> | undefined;
  const snapshot = abilities?.[id] as Record<string, unknown> | undefined;
  const state = snapshot?.state as Record<string, unknown> | undefined;
  return { originalJson, original, abilities, snapshot, state };
}
/**
 * 资格及目标复验留在调用点。Seer 依原捕获阵营准备行，写历史后才写 uses／lastUsedDay；Guard 保原重复规则。
 * 只有整私态编码核对成功后才调用原 committed 标记，再写 audit；晚 JSON／字段错误不撤销前写。
 * nativeArrayPush 必须是 authority 原模块位置捕获的函数，不在新模块初始化时重捕获。
 */
export function commitDemonNativeParticipantData(
  p: AuditData, original: Record<string, unknown> | null, abilities: Record<string, unknown> | undefined,
  snapshot: Record<string, unknown>, state: Record<string, unknown>, originalState: object,
  ability: object, kind: "seer_check" | "guard", id: string, day: number,
  targetId: number | null, inspection: unknown, readCamp: (id: number) => Camp,
  nativeArrayPush: typeof Array.prototype.push, markCommitted: () => void,
): boolean {
  let nextState: Record<string, unknown>;
  if (kind === "seer_check") {
    if (targetId === null) return false;
    const result = { kind: "camp", camp: readCamp(targetId) };
    if (demonJson(inspection) !== demonJson(result)) return false;
    const row = { targetId, isWerewolf: result.camp === Camp.Wolf, result: { ...result } };
    nextState = {
      ...state,
      lastTarget: targetId,
      lastIsWerewolf: row.isWerewolf,
      lastResult: { ...result },
      history: [...(state.history as unknown[]), row],
    };
    const liveState = originalState as Record<string, unknown>;
    liveState.lastTarget = targetId;
    liveState.lastIsWerewolf = row.isWerewolf;
    liveState.lastResult = { ...result };
    nativeArrayPush.call(ownDemonData(originalState, "history"), row);
  } else {
    if (targetId !== null && snapshot.lastUsedDay === day - 1 && state.lastTarget === targetId)
      return false;
    nextState = { ...state, lastTarget: targetId };
    (originalState as Record<string, unknown>).lastTarget = targetId;
  }
  const nextAbility = {
    ...snapshot,
    state: nextState,
    uses: (snapshot.uses as number) + (targetId === null ? 0 : 1),
    lastUsedDay: day,
  };
  (ability as Record<string, unknown>).uses = nextAbility.uses;
  (ability as Record<string, unknown>).lastUsedDay = day;
  const json = JSON.stringify({ ...original, abilities: { ...abilities, [id]: nextAbility } });
  if (demonJson(p.privateState) !== json)
    throw new Error("demon_hunter_native_night_commit_failed");
  markCommitted();
  p.auditPrivateJson = json;
  return true;
}
export function captureDemonHunterAuditData(p: AuditData) {
  const originalJson = p.auditPrivateJson,
    original = JSON.parse(originalJson),
    hunter = original.hunter;
  return { originalJson, original, hunter };
}
/** 原死亡枪资格已复验；真实 canShoot 写后编码，失败保已耗库存及旧审计串。 */
export function consumeDemonHunterParticipantData(
  p: AuditData, state: object, original: Record<string, unknown>, hunter: Record<string, unknown>,
  markCommitted: () => void,
): void {
  (state as Record<string, unknown>).canShoot = false;
  const json = JSON.stringify({ ...original, hunter: { ...hunter, canShoot: false } });
  if (demonJson(p.privateState) !== json)
    throw new Error("demon_hunter_native_hunter_commit_failed");
  markCommitted();
  p.auditPrivateJson = json;
}
/** 原 complete／metadata检查已执行；各字段逐次解码，生命与委托读取只在原属性位置调用。 */
export function projectDemonParticipantCheckpoint(
  p: DemonParticipantStateData & { readonly id: number; readonly kind: Role; readonly camp: Camp },
  cp: DemonCheckpointAuditData & { readonly seat: number; readonly name: string },
  marks: ReadonlyArray<readonly [StatusMark, StatusMarkSnapshot | null]>,
  readAlive: () => boolean, readDelegated: () => DemonDelegatedPrivateData,
) {
  return {
    id: p.id,
    seat: cp.seat,
    name: cp.name,
    role: p.kind,
    camp: p.camp,
    alive: readAlive(),
    privateState: committedPrivate(p, readDelegated),
    victory: { affiliations: JSON.parse(p.victoryJson) as VictoryComponent["affiliations"] },
    vote: JSON.parse(cp.voteJson) as { weight: number; canVote: boolean },
    badge: JSON.parse(cp.badgeJson) as {
      isSheriff: boolean;
      destroyed: boolean;
      voteWeight: number;
      handoffPolicy?: import("../../../../core/domain/board").SheriffBadgePolicy;
    },
    marks: marks.flatMap(([mark, snapshot]) => (snapshot?.present ? [mark] : [])),
  };
}
/** 真实警徽批次已通过核验并标记 committed；依原 map 顺序逐个先写 badge 串、再 vote 串。 */
export function acceptDemonBadgeAudits(
  before: ReadonlyMap<number, { readonly cp: DemonCheckpointAuditData }>,
  expected: ReadonlyMap<number, { readonly badge: object; readonly vote: object }>,
): void {
  for (const [id, next] of expected) {
    const cp = before.get(id)!.cp;
    cp.badgeJson = JSON.stringify(next.badge);
    cp.voteJson = JSON.stringify(next.vote);
  }
}
/** RedMoon 族的三字段写已发生；整容器核对失败仍保前写，不重做族 schema 或退款。 */
export function acceptDemonRedMoonAudit(p: AuditData, expected: string): void {
  if (demonJson(p.privateState) !== expected) throw new Error("red_moon_state_commit_failed");
  p.auditPrivateJson = expected;
}
/**
 * 原 badge预检完成后才准备两份期望数据；翻牌→canVote→weight 后核内容，再依原顺序更新两引用表及双审计串。
 * 失败不补写余字段、不改变生命，也不能拿最近安全串当成可重新付款的库存。
 */
export function commitDemonIdiotParticipantData(p: PrivateData, cp: DemonCheckpointAuditData): boolean {
  const next = { revealed: true };
  const original = JSON.parse(p.auditPrivateJson) as Record<string, unknown>;
  const expectedPrivate = JSON.stringify({ ...original, idiot: next });
  const expectedVote = JSON.stringify({ ...JSON.parse(cp.voteJson), canVote: false, weight: 0 });
  (p.privateState as { idiot: typeof next }).idiot = next;
  (cp.vote as VotingRightComponent).canVote = false;
  (cp.vote as VotingRightComponent).weight = 0;
  if (demonJson(p.privateState) !== expectedPrivate || demonVoteJson(cp.vote) !== expectedVote)
    throw new Error("demon_hunter_idiot_commit_failed");
  p.privateRefs = p.privateRefs.map(
    ([key, value]) => [key, key === "idiot" ? next : value] as const,
  );
  p.inventoryRefs = p.inventoryRefs.map(
    ([path, value]) => [path, path.length === 1 && path[0] === "idiot" ? next : value] as const,
  );
  p.auditPrivateJson = expectedPrivate;
  cp.voteJson = expectedVote;
  return true;
}
