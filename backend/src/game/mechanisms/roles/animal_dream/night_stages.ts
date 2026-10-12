import { ANIMAL_DREAM_POLICY } from "@ai-werewolf-arena/game-text";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { animalFoxChoiceActor, animalFoxChoiceCandidates, animalFoxEffect } from "./authority";
import {
  openAnimalRequest,
  animalRequestScope,
  readAnimalTool,
  commitAnimalRequest,
  closeAnimalRequest,
} from "./requests";
import { appendAnimalFact, appendAnimalKnifeNotices, appendAnimalBeautyNotice } from "./facts";
export const ANIMAL_FOX_STAGE: NightStageHandler = {
  id: "fox_distract",
  priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = animalFoxChoiceActor(ctx.world, day);
    if (actorId !== null) {
      const request = ctx.makeRequest(actorId, ["fox_distract"], {
          stage: "fox_distract",
          requiresAction: true,
          allow_fallback: false,
          action_failure_policy: "error",
          fox_candidates: animalFoxChoiceCandidates(ctx.world, day),
        }),
        scope = openAnimalRequest(ctx.world, request);
      try {
        const raw = await ctx.actionProvider.getAction(request),
          call = readAnimalTool(raw);
        if (animalRequestScope(ctx.world, request) !== scope || call?.name !== "fox_distract")
          throw Error("animal_required_action_invalid");
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, call, {
          phase: Phase.Night,
          day,
          animalScope: scope,
          deferOperation: true,
        });
        if (!valid.ok || !valid.sanitizedCall) throw Error("animal_required_action_invalid");
        const receipt = commitAnimalRequest(ctx.world, scope, valid.sanitizedCall);
        if (!("targetId" in receipt)) throw Error("animal_receipt_invalid");
        appendAnimalFact(ctx.world, ctx.events, "animal_fox_chosen", {
          policy: ANIMAL_DREAM_POLICY,
          actorId,
          ...receipt,
        });
        const effect = animalFoxEffect(ctx.world);
        if (effect)
          appendAnimalFact(ctx.world, ctx.events, "animal_fox_effect", {
            policy: ANIMAL_DREAM_POLICY,
            actorId,
            ...effect,
          });
      } finally {
        closeAnimalRequest(scope);
      }
    }
    if (!ctx.isCurrent()) throw Error("animal_night_revoked");
    appendAnimalKnifeNotices(ctx.world, ctx.events, day);
    appendAnimalBeautyNotice(ctx.world, ctx.events, day);
  },
};
