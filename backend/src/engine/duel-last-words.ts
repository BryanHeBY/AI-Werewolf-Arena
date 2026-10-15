/**
 * 负责具名连续决斗的延期遗言运行身份与真实死亡entitlement。输入为原DR所有者、执行日次与真实提交凭证，
 * 输出有序一次性原生命发言许可；只保存提交凭证的原引用，不复制Alive或建立资源库存。
 * 时点是每次真实mark返回之后入队、完整决斗链正常终止后由DR逐人授词；错误关闭不会伪造正常flush。
 * 权限只属于开窗DR，JSON／他局／同号新身体不可借scope或event获得授权；授词和发言的已发布前缀不回滚。
 */
import { types } from "node:util";
import { Phase, type DeathCause } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../domain/components/names";
import { aliveLifeDescriptor, aliveLifeVersion } from "../domain/components/alive";
import type { RoleComponent } from "../domain/components/role";
import type { CampComponent } from "../domain/components/camp";
import type { World } from "../domain/world";
import { readWorldComponentAtCommit } from "../domain/world";
import type { DeathCommitReceipt, DeathCommitEntry } from "./death-wave";
export interface DuelLastWordsScope {
  readonly kind: "duel_last_words_scope";
}
export interface DuelLastWordsEntitlement {
  readonly kind: "duel_last_words_entitlement";
}
interface Scope {
  readonly owner: object;
  readonly world: World;
  readonly day: number;
  readonly phase: Phase;
  readonly current: () => boolean;
  readonly entries: DuelLastWordsEntitlement[];
  open: boolean;
  flushing: boolean;
}
interface Entitlement {
  readonly scope: Scope;
  readonly entry: DeathCommitEntry;
  readonly role: RoleComponent;
  readonly roleId: unknown;
  readonly camp: CampComponent;
  readonly campValue: unknown;
  readonly deathPhase: Phase;
  readonly causes: readonly DeathCause[];
  granted: boolean;
  spoken: boolean;
}
const scopes = new WeakMap<DuelLastWordsScope, Scope>(),
  entitlements = new WeakMap<DuelLastWordsEntitlement, Entitlement>(),
  active = new WeakMap<object, DuelLastWordsScope>();
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
export function openDuelLastWordsScope(
  owner: object,
  world: World,
  day: number,
  phase: Phase,
  current: () => boolean,
): DuelLastWordsScope {
  if (
    active.has(owner) ||
    !Number.isSafeInteger(day) ||
    day < 1 ||
    (phase !== Phase.Day && phase !== Phase.Voting) ||
    !current()
  )
    throw new Error("duel_last_words_scope_invalid");
  const token = Object.freeze({ kind: "duel_last_words_scope" as const });
  scopes.set(token, {
    owner,
    world,
    day,
    phase,
    current,
    entries: [],
    open: true,
    flushing: false,
  });
  active.set(owner, token);
  return token;
}
/** 新metadata只接受自身数据字段；旧getter／Proxy输入不因新增能力多执行一次。 */
export function duelLastWordsMetadata(input: object | undefined): DuelLastWordsScope | undefined {
  return own(input, "duelLastWords") as DuelLastWordsScope | undefined;
}
export function assertDuelLastWordsScope(
  token: DuelLastWordsScope,
  owner: object,
  day: number,
  phase: Phase,
): void {
  const s = scopes.get(token);
  if (
    !s ||
    s.owner !== owner ||
    active.get(owner) !== token ||
    s.day !== day ||
    s.phase !== phase ||
    !s.open ||
    s.flushing ||
    !s.current()
  )
    throw new Error("duel_last_words_scope_invalid");
}
/** 只由拥有者在实际提交返回点传入；重访凭证不重复入队，顺序沿真实mark的entries保留。 */
export function appendDuelWordCommit(
  token: DuelLastWordsScope,
  owner: object,
  receipt: DeathCommitReceipt,
  sources: Readonly<Record<number, readonly DeathCause[]>>,
  fallbackPhase: Phase,
): void {
  const s = scopes.get(token);
  if (!s || s.owner !== owner || !s.open || s.flushing || !s.current())
    throw new Error("duel_last_words_scope_invalid");
  for (const entry of receipt.entries) {
    if (
      !entry.firstSettlement ||
      s.entries.some((t) => {
        const e = entitlements.get(t)!.entry;
        return (
          e.id === entry.id &&
          e.settled.component === entry.settled.component &&
          e.settled.version === entry.settled.version
        );
      })
    )
      continue;
    const role = readWorldComponentAtCommit(s.world, entry.id, COMPONENT.Role),
      camp = readWorldComponentAtCommit(s.world, entry.id, COMPONENT.Camp);
    if (!role || !camp) throw new Error("duel_last_words_original_missing");
    const token = Object.freeze({ kind: "duel_last_words_entitlement" as const });
    entitlements.set(token, {
      scope: s,
      entry,
      role,
      roleId: own(role, "role"),
      camp,
      campValue: own(camp, "camp"),
      deathPhase: entry.originPhase ?? fallbackPhase,
      causes: Object.freeze([...(sources[entry.id] ?? [])]),
      granted: false,
      spoken: false,
    });
    s.entries.push(token);
  }
}
export function beginDuelWordsFlush(
  token: DuelLastWordsScope,
  owner: object,
): readonly DuelLastWordsEntitlement[] {
  const s = scopes.get(token);
  if (
    !s ||
    s.owner !== owner ||
    active.get(owner) !== token ||
    !s.open ||
    s.flushing ||
    !s.current()
  )
    throw new Error("duel_last_words_scope_invalid");
  s.open = false;
  s.flushing = true;
  return s.entries;
}
export function readDuelWordEntitlement(token: DuelLastWordsEntitlement) {
  const e = entitlements.get(token);
  if (!e) throw new Error("duel_last_words_entitlement_invalid");
  return {
    id: e.entry.id,
    day: e.scope.day,
    phase: e.scope.phase,
    deathPhase: e.deathPhase,
    causes: e.causes,
  };
}
/** 末端只读真实ECS与已提交原生命；死亡许可另由World开放，token不是外部ID授权。 */
export function duelWordEntitlementCurrent(token: DuelLastWordsEntitlement): boolean {
  const e = entitlements.get(token);
  if (!e || !e.scope.flushing || e.spoken || !e.scope.current()) return false;
  const s = e.scope,
    life = e.entry.settled.component,
    factory = aliveLifeDescriptor(life),
    descriptor = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    readWorldComponentAtCommit(s.world, e.entry.id, COMPONENT.Alive) === life &&
    !!factory &&
    !!descriptor &&
    descriptor.get === factory.get &&
    descriptor.set === factory.set &&
    aliveLifeVersion(life) === e.entry.settled.version &&
    !life.alive &&
    readWorldComponentAtCommit(s.world, e.entry.id, COMPONENT.Role) === e.role &&
    own(e.role, "role") === e.roleId &&
    readWorldComponentAtCommit(s.world, e.entry.id, COMPONENT.Camp) === e.camp &&
    own(e.camp, "camp") === e.campValue
  );
}
export function markDuelWordGranted(token: DuelLastWordsEntitlement): void {
  const e = entitlements.get(token);
  if (!e || e.granted || e.spoken || !e.scope.flushing)
    throw new Error("duel_last_words_entitlement_invalid");
  e.granted = true;
}
export function markDuelWordSpoken(token: DuelLastWordsEntitlement): void {
  const e = entitlements.get(token);
  if (!e || !e.granted || e.spoken || !e.scope.flushing)
    throw new Error("duel_last_words_entitlement_invalid");
  e.spoken = true;
}
export function duelWordSpoken(token: DuelLastWordsEntitlement): boolean {
  return entitlements.get(token)?.spoken === true;
}
/** 发表窗口必须已有真实授词事实；尚未授词的原始entitlement只允许DR做授词前末核。 */
export function grantedDuelWordCurrent(token: DuelLastWordsEntitlement): boolean {
  return entitlements.get(token)?.granted === true && duelWordEntitlementCurrent(token);
}
/** 关闭不调用外部查询，错误／阶段撤销也可收回能力；不删真实已授词或发言事实。 */
export function closeDuelLastWordsScope(token: DuelLastWordsScope, owner: object): void {
  const s = scopes.get(token);
  if (!s || s.owner !== owner) throw new Error("duel_last_words_scope_invalid");
  s.open = false;
  s.flushing = false;
  if (active.get(owner) === token) active.delete(owner);
}
