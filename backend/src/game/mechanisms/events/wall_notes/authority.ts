/**
 * Owns the active wall, original author stock and request bindings. Reads the World and
 * original request context; writes accepted wall actions and aliases only for the same
 * author/window. A closed wall and replaced participants revoke its local authority; alias
 * routing never bypasses these checks.
 */
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { readWallNoteData } from "@ai-werewolf-arena/game-text";
import {
  COMPONENT,
  Role,
  Phase,
  type World,
  type ActionRequest,
  type WallNoteComponent,
} from "../../../../core/domain";
import {
  captureDebateParticipant,
  sameDebateParticipant,
  type DebateParticipant,
} from "../../roles/debater/authority";
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
const requestScopes = new WeakMap<
  ActionRequest,
  {
    scope: WallAuthority;
    world: World;
    actorId: number;
    instanceId: string;
    context: ActionRequest["context"];
  }
>();
export function bindWallRequest(world: World, request: ActionRequest): void {
  const a = active.get(world),
    author = a?.authors.get(request.actorId);
  if (
    a &&
    author &&
    request.context.wall_id === a.token &&
    request.context.item_instance_id === author.instanceId
  ) {
    requestScopes.set(request, {
      scope: a,
      world,
      actorId: request.actorId,
      instanceId: author.instanceId,
      context: request.context,
    });
    registerRequestAliasPropagation(request, 10, inheritWallDeadlineRequest);
  }
}
export function wallRequestScope(world: World, request: ActionRequest): WallAuthority | undefined {
  const binding = requestScopes.get(request);
  return binding &&
    active.get(world) === binding.scope &&
    request.actorId === binding.actorId &&
    request.context === binding.context &&
    request.context.wall_id === binding.scope.token &&
    request.context.item_instance_id === binding.instanceId &&
    request.phase === Phase.Voting &&
    request.context.day === 1 &&
    request.context.stage === "wall_notes"
    ? binding.scope
    : undefined;
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
        /* Runtime revocation is independent of a corrupted storage object. */
      }
  }
}
export function projectWallNote(
  world: World,
  id: number,
): (WallNoteComponent & { effectiveRemaining: 0 | 1 }) | undefined {
  const a = active.get(world),
    author = a?.authors.get(id);
  const n = world.getComponent<WallNoteComponent>(id, COMPONENT.WallNote);
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

/** Only the runtime deadline wrapper may derive an otherwise identical request. */
export function inheritWallDeadlineRequest(source: ActionRequest, target: ActionRequest): void {
  const binding = requestScopes.get(source);
  if (!binding || !wallRequestScope(binding.world, source)) return;
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    targetKeys = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  if (
    keys.length !== targetKeys.length ||
    keys.some((k) => !targetKeys.includes(k) || (source as any)[k] !== (target as any)[k])
  )
    return;
  requestScopes.set(target, binding);
  registerRequestAliasPropagation(target, 10, inheritWallDeadlineRequest);
}
