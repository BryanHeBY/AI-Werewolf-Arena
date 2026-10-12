import { z } from "zod";
import { roleName, text, BEAR_SIGNAL_POLICIES } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getBearState, setBearState } from "../private_state";
import { isAnimalDreamBoard } from "../animal_dream/authority";
import { animalBearKnowledge } from "../animal_dream/facts";
const parameters = z.strictObject({ signalPolicy: z.enum(BEAR_SIGNAL_POLICIES).optional() });

export const BEAR_ROLE_PROFILE: RoleProfile = {
  role: Role.Bear,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  label: roleName("bear"),
  skillBrief: text("zh-CN", "role.bear.brief"),
  init: (role) => {
    setBearState(role, { history: [] });
  },
  renderPrompt: (role, locale = "zh-CN", world) => {
    const animal = world && isAnimalDreamBoard(world),
      report = animal
        ? animalBearKnowledge(world).history.at(-1)
        : getBearState(role)?.history.at(-1);
    return (
      text(locale, animal ? "role.bear.dawn_brief" : "role.bear.state") +
      " " +
      (report
        ? text(locale, "role.bear.latest", {
            day: report.day,
            result: text(locale, report.roared ? "bear.roar" : "bear.quiet"),
          })
        : text(locale, "role.bear.no_report"))
    );
  },
  configuration: {
    schema: parameters,
    defaults: {},
    apply: (config, value) => {
      const p = parameters.parse(value);
      return p.signalPolicy ? { ...config, bear: { signalPolicy: p.signalPolicy } } : config;
    },
    serialize: (config) => parameters.parse(config.bear ?? {}),
  },
};
