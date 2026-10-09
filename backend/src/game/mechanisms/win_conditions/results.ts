import type { GameOutcome, VictoryClaim, VictoryTarget } from "@ai-werewolf-arena/game-catalog";
import { COMPONENT, type WinDecision, type World } from "../../../core/domain";
import type { VictoryComponent } from "../../../core/domain/components/victory";
import { readGameOutcome } from "@ai-werewolf-arena/replay-contract";

/** Membership comes from the explicit win component, never an inferred role/camp. */
export function victoryDecision(
  world: World,
  primary: VictoryTarget,
  reason: string,
  additional: readonly VictoryTarget[] = [],
): WinDecision {
  const claim = (target: VictoryTarget): VictoryClaim => {
    const winningPlayerIds = world.entityIds().filter((id) => {
      if (target.kind === "individual" && id !== target.playerId) return false;
      return (
        world
          .getComponent<VictoryComponent>(id, COMPONENT.Victory)
          ?.affiliations.some(
            (member) =>
              (target.kind === "faction" &&
                member.kind === "faction" &&
                target.faction === member.faction) ||
              (target.kind === "individual" &&
                member.kind === "individual" &&
                target.goalId === member.goalId) ||
              (target.kind === "relationship" &&
                member.kind === "relationship" &&
                target.groupId === member.groupId),
          ) === true
      );
    });
    if (target.kind !== "faction" && winningPlayerIds.length === 0)
      throw new Error("victory_target_has_no_members");
    return { ...target, winningPlayerIds };
  };
  const first = claim(primary),
    others = additional.map(claim);
  const outcome: GameOutcome = {
    kind: "victory",
    primary: first,
    additional: others,
    winningPlayerIds: [
      ...new Set([first, ...others].flatMap((item) => item.winningPlayerIds)),
    ].sort((a, b) => a - b),
  };
  if (typeof reason !== "string" || reason.length === 0) throw new Error("victory_reason_invalid");
  return {
    winner: primary.kind === "faction" ? (primary.faction as WinDecision["winner"]) : null,
    reason,
    outcome: readGameOutcome(outcome, world.entityIds()),
  };
}
