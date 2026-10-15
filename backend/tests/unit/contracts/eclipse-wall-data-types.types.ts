/**
 * 编译期单元负责蚀日侍女／匿名留言纯数据迁移的原形状、可写性和类型入口验证。
 * 输入为独立手写旧字段、union／nullable 与 World 具名入口；输出为精确关系和错误字段反例。
 * 本单元拥有独立预期，不运行 reader、World、吞噬、借用或写信；知识 ID 与有效余量不授予许可。
 */
import type {
  EclipseState,
  EclipseSwallowedRole,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import type {
  WallNoteComponent,
  readWallNoteData,
} from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import type { PlayerObservation } from "../../../src/game/observation/player-observation";
import type { WallNoteComponent as WorldWallNote } from "../../../src/domain/components/wall-note";
import type { projectEclipseState } from "../../../src/game/mechanisms/roles/radiant_eclipse/ports";
import type {
  // @ts-expect-error 原 feature type 出口退休，runtime 规则／投影仍保留。
  EclipseState as RetiredState,
  // @ts-expect-error 纯五角色联合归 GC；原 runtime goodRoles 不迁或开放。
  EclipseSwallowedRole as RetiredRole,
} from "../../../src/game/mechanisms/roles/radiant_eclipse/eclipse-state-slot";
export type RetiredFeatureChecks = [RetiredState, RetiredRole];

type OriginalSwallowedRole = "villager" | "seer" | "witch" | "dreamer" | "radiant_count";
interface OriginalEclipse {
  policy: "awa_radiant_eclipse_v1";
  history: Array<{
    day: number;
    targetId: number | null;
    roleId: OriginalSwallowedRole | null;
    abilityId: string | null;
  }>;
}
interface OriginalWall {
  instanceId: string;
  source: { kind: "wall_event"; eventId: "awa_wall_notes_v1"; day: 1 };
  remaining: 0 | 1;
  expired: boolean;
}
type OriginalPlayerWall = OriginalWall & { effectiveRemaining: 0 | 1 };
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type PublicShapeChecks = [
  Expect<Equal<EclipseSwallowedRole, OriginalSwallowedRole>>,
  Expect<Equal<EclipseState, OriginalEclipse>>,
  Expect<Equal<WallNoteComponent, OriginalWall>>,
  Expect<Equal<WorldWallNote, OriginalWall>>,
  Expect<Equal<ReturnType<typeof projectEclipseState>, OriginalEclipse | undefined>>,
  Expect<Equal<ReturnType<typeof readWallNoteData>, OriginalWall | null>>,
  Expect<Equal<PlayerObservation["ownState"]["eclipse"], OriginalEclipse | undefined>>,
  Expect<Equal<PlayerObservation["ownState"]["wallNote"], OriginalPlayerWall | undefined>>,
  Expect<EclipseState extends OriginalEclipse ? true : false>,
  Expect<OriginalEclipse extends EclipseState ? true : false>,
  Expect<WallNoteComponent extends OriginalWall ? true : false>,
  Expect<OriginalWall extends WallNoteComponent ? true : false>,
];

/** 仅编译原 nested 可写／null／literal；不写实际原体或对局库存。 */
export function originalWritableData(
  eclipse: EclipseState,
  wall: WallNoteComponent,
  playerWall: OriginalPlayerWall,
): void {
  eclipse.history = [{ day: 2, targetId: null, roleId: null, abilityId: null }];
  eclipse.history.push({ day: 3, targetId: 4, roleId: "seer", abilityId: "copy:eclipse:night:3" });
  eclipse.history[0]!.targetId = 2;
  eclipse.history[0]!.roleId = "villager";
  eclipse.history[0]!.abilityId = null;
  wall.instanceId = "wall:1:2";
  wall.source = { kind: "wall_event", eventId: "awa_wall_notes_v1", day: 1 };
  wall.source.day = 1;
  wall.remaining = 0;
  wall.expired = true;
  playerWall.effectiveRemaining = 1;
  // @ts-expect-error 公开history无live ability payload或租约。
  eclipse.lease;
  // @ts-expect-error 有限角色联合不包括普通狼人。
  eclipse.history[0]!.roleId = "wolf";
  // @ts-expect-error 原source严格首日literal，不扩为任意日次。
  wall.source.day = 2;
  // @ts-expect-error 原库存类型是0或1。
  wall.remaining = 2;
  // @ts-expect-error 玩家有效余量仍有原字段与0或1边界。
  playerWall.effectiveRemaining = 2;
}
