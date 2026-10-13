/**
 * Owns Awakened Hidden Wolf's captured activated-gun death-shot contribution.
 * Inputs are original learned state, activation metadata and death contexts;
 * outputs preserve the original pointer/metadata rechecks and shot publication.
 * Read views carry no write permission; consumption stays in the existing shared
 * death-shot owner and this hook never reactivates or refunds a learned template.
 * After an actual death wave, the resolver rechecks currentness before and after
 * selecting a shot; stale or terminal windows never reopen a consumed learned gun.
 */

import type {
  AwakenedReadState as AwakenedState,
  AwakenedReadLearning as AwakenedLearning,
  AwakenedReadSkill as AwakenedSkill,
} from "@ai-werewolf-arena/game-contract";
import { Camp, Role, permitsDeathShot } from "../../../../core/domain/model";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DeathHook } from "../../hooks/hook_registry";
import { resolveDeathShots } from "../death_shot";
import { getAwakenedState } from "./state";

export const awakenedDeathHook: DeathHook = (world, ids, sources, choose, events, context) => {
  const owners = new Map<
    RoleComponent,
    {
      state: AwakenedState;
      learned: AwakenedLearning;
      gun: Extract<AwakenedSkill, { kind: "hunter" }>;
      targetId: number;
      role: AwakenedLearning["role"];
      day: number;
      activationNight: number;
      activeFromNight: number;
    }
  >();
  return resolveDeathShots(
    world,
    ids,
    sources,
    choose,
    events,
    {
      role: Role.AwakenedHiddenWolf,
      state: (role) => {
        const state = getAwakenedState(role),
          learned = state?.learned,
          gun = learned?.skill;
        if (
          role.camp !== Camp.Wolf ||
          !state ||
          !learned ||
          learned.role !== Role.Hunter ||
          learned.activationNight === null ||
          learned.activeFromNight === null ||
          gun?.kind !== "hunter" ||
          !gun.armed
        )
          return undefined;
        const prior = owners.get(role);
        if (
          prior &&
          (state !== prior.state ||
            learned !== prior.learned ||
            gun !== prior.gun ||
            learned.targetId !== prior.targetId ||
            learned.role !== prior.role ||
            learned.day !== prior.day ||
            learned.activationNight !== prior.activationNight ||
            learned.activeFromNight !== prior.activeFromNight)
        )
          return undefined;
        if (!prior)
          owners.set(role, {
            state,
            learned,
            gun,
            targetId: learned.targetId,
            role: learned.role,
            day: learned.day,
            activationNight: learned.activationNight,
            activeFromNight: learned.activeFromNight,
          });
        return gun;
      },
      permits: permitsDeathShot,
      shotEvent: (actorId, targetId) => ({
        timestamp: Date.now(),
        type: "player_shot",
        payload: { actorId, targetId },
      }),
    },
    context,
  );
};
