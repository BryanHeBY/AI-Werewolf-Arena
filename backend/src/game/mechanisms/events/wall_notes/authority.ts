/**
 * 负责持有匿名墙、原作者库存与请求绑定，按窗口和作者身份提交行动及派生别名。
 * 输入为原 World、作者与请求；输出为墙 scope、作者原记录及投影，写权只覆盖墙／作者库存和本地绑定。
 * 请求预算与已观察撤权归独立 RequestLease 实例；本模块仍晚复验墙、原参与者和 note 同引用。
 * 不变量：原墙、参与者、note／source 必须保持捕获关联，投影不授新权限。
 * 关闭先撤 active 权，再尝试标记存储过期；存储损坏不恢复权限，失败保留已发生的写入前缀。
 */
import { RequestLease } from "../../../../core/domain/request-lease";
import { readWallNoteData } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import {
  COMPONENT,
  Role,
  Phase,
  type World,
  type ActionRequest,
  type WallNoteComponent,
} from "../../../../core/domain";
import {
  captureOriginalParticipant as captureDebateParticipant,
  sameOriginalParticipant as sameDebateParticipant,
  type OriginalParticipant as DebateParticipant,
} from "../../../../core/domain/original-participant";
export const WALL_ROLES: readonly Role[] = [
  Role.Wolf,
  Role.Villager,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
  Role.Idiot,
];
export function supportsWallRoles(roles: readonly Role[]): boolean {
  return roles.every((role) => WALL_ROLES.includes(role));
}
/** 捕获原参与者与 note/source 同引用，并另持本地 remaining／closed；投影不会补回作者资格。 */
export interface WallAuthor {
  id: number;
  participant: DebateParticipant;
  note: WallNoteComponent;
  source: WallNoteComponent["source"];
  instanceId: string;
  remaining: 0 | 1;
  closed: boolean;
}
export interface WallAuthority {
  token: string;
  authors: Map<number, WallAuthor>;
  isCurrent: () => boolean;
}
const active = new WeakMap<World, WallAuthority>();
const commits = new WeakSet<World>();
const owned = new WeakMap<World, Map<number, WallAuthor>>();
/** 本实例持有请求及预算／关闭元数据；原 active/author/库存表仍归本 authority，入口不提前核阶段或当前作者。 */
const requestLease = RequestLease.item<World, WallAuthority, WallAuthor>(
  {
    active: (world) => active.get(world),
    authors: (scope) => scope.authors,
    token: (scope) => scope.token,
    instanceId: (author) => author.instanceId,
    phase: () => Phase.Voting,
    stage: () => "wall_notes",
    current: (world, scope, author) => sameWallAuthor(world, scope, author),
  },
  10,
);
export function bindWallRequest(world: World, request: ActionRequest): void {
  requestLease.bind(world, request);
}
export function wallRequestScope(world: World, request: ActionRequest): WallAuthority | undefined {
  return requestLease.scope(world, request);
}
/** 每个作者 request 打开自己的完成身份，不以共享墙 scope 结算其他作者。 */
export function openWallRequestDelivery(world: World, request: ActionRequest) {
  return requestLease.openDelivery(world, request);
}
export function hasActiveWall(world: World): boolean {
  return active.has(world);
}
export function hasWallCommit(world: World): boolean {
  return commits.has(world);
}
export function openWall(world: World, isCurrent: () => boolean): WallAuthority {
  if (hasActiveWall(world)) throw new Error("wall_window_reentry");
  if (hasWallCommit(world)) throw new Error("wall_already_committed");
  commits.add(world);
  const a: WallAuthority = { token: "wall:1", authors: new Map(), isCurrent };
  active.set(world, a);
  return a;
}
export function grantWallNote(world: World, a: WallAuthority, id: number): WallAuthor | null {
  const participant = captureDebateParticipant(world, id);
  if (!participant) return null;
  const source: WallNoteComponent["source"] = {
    kind: "wall_event",
    eventId: "awa_wall_notes_v1",
    day: 1,
  };
  const note: WallNoteComponent = {
    instanceId: `wall:1:${id}`,
    source,
    remaining: 1,
    expired: false,
  };
  const author: WallAuthor = {
    id,
    participant,
    note,
    source,
    instanceId: note.instanceId,
    remaining: 1,
    closed: false,
  };
  world.addComponent(id, COMPONENT.WallNote, note);
  a.authors.set(id, author);
  owned.set(world, a.authors);
  return author;
}
export function sameWallAuthor(world: World, a: WallAuthority, author: WallAuthor): boolean {
  const n = author.note,
    data = readWallNoteData(n),
    source = Object.getOwnPropertyDescriptor(n, "source");
  const writable = ["remaining", "expired"].every((key) => {
    const field = Object.getOwnPropertyDescriptor(n, key);
    return field && Object.hasOwn(field, "value") && field.writable === true;
  });
  return (
    writable &&
    !!data &&
    active.get(world) === a &&
    a.isCurrent() &&
    sameDebateParticipant(world, author.participant) &&
    world.getComponent(author.id, COMPONENT.WallNote) === n &&
    source?.value === author.source &&
    data.instanceId === author.instanceId &&
    data.remaining === author.remaining &&
    data.expired === false
  );
}

export function authorizedWallAuthor(
  world: World,
  id: number,
  token: string | undefined,
  instanceId: string | undefined,
  scope: object | undefined,
): WallAuthor | null {
  const a = active.get(world),
    author = a?.authors.get(id);
  return a &&
    a === scope &&
    author &&
    a.token === token &&
    author.instanceId === instanceId &&
    author.remaining === 1 &&
    sameWallAuthor(world, a, author)
    ? author
    : null;
}
export function closeWall(world: World, a: WallAuthority): void {
  if (active.get(world) !== a) return;
  active.delete(world);
  for (const author of a.authors.values()) {
    author.closed = true;
    const field = Object.getOwnPropertyDescriptor(author.note, "expired");
    if (field && Object.hasOwn(field, "value") && field.writable)
      try {
        Object.defineProperty(author.note, "expired", { ...field, value: true });
      } catch {
        /* active 已先撤回；存储损坏或过期字段无法写入不会恢复运行权限。 */
      }
  }
}
export function projectWallNote(
  world: World,
  id: number,
): (WallNoteComponent & { effectiveRemaining: 0 | 1 }) | undefined {
  const a = active.get(world),
    author = a?.authors.get(id);
  const n = world.getComponent(id, COMPONENT.WallNote);
  const owner = owned.get(world)?.get(id);
  if (!owner || owner.note !== n) return;
  const data = readWallNoteData(n),
    source = n && Object.getOwnPropertyDescriptor(n, "source");
  if (
    !data ||
    source?.value !== owner.source ||
    data.instanceId !== owner.instanceId ||
    data.remaining !== owner.remaining
  )
    return;
  return {
    ...data,
    expired: owned.get(world)!.get(id)!.closed || data.expired,
    effectiveRemaining: a && author && sameWallAuthor(world, a, author) ? author.remaining : 0,
  };
}
