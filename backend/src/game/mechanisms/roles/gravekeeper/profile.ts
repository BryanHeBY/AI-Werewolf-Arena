/**
 * Assembles gravekeeper native exile-report history, prompt formatting and the feedback-stage contribution.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { z } from "zod";
import { inspectionLabel, roleName, text } from "@ai-werewolf-arena/game-text";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getGravekeeperState, setGravekeeperState } from "./state";
import { GRAVEKEEPER_FEEDBACK_STAGE } from "./feedback";

export const GRAVEKEEPER_ROLE_PROFILE: RoleProfile = {
  role: Role.Gravekeeper,
  camp: Camp.Good,
  goodSide: "god",
  label: roleName("gravekeeper"),
  skillBrief: text("zh-CN", "role.gravekeeper.brief"),
  init: (role) => {
    setGravekeeperState(role, { history: [] });
  },
  renderPrompt: (role, locale = "zh-CN") => {
    const history = getGravekeeperState(role)?.history,
      raw = Array.isArray(history) ? history.at(-1) : undefined;
    const report = readGravekeeperReport(raw);
    return (
      text(locale, "role.gravekeeper.state") +
      " " +
      (report
        ? text(locale, "role.gravekeeper.latest", {
            exileDay: report.exileDay,
            receivedDay: report.receivedDay,
            target: report.targetId,
            result: inspectionLabel(report.result, locale),
          })
        : text(
            locale,
            raw === undefined && Array.isArray(history)
              ? "role.gravekeeper.no_report"
              : "replay.unknown",
          ))
    );
  },
  configuration: {
    schema: z.strictObject({}),
    defaults: {},
    apply: (config) => config,
    serialize: () => ({}),
  },
  nightStages: [GRAVEKEEPER_FEEDBACK_STAGE],
};
