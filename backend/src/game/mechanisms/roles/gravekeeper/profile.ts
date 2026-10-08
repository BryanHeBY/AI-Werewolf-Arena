import { z } from "zod";
import { inspectionLabel, roleName, text } from "@ai-werewolf-arena/game-text";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getGravekeeperState, setGravekeeperState } from "../private_state";
import { GRAVEKEEPER_FEEDBACK_STAGE } from "./feedback";

export const GRAVEKEEPER_ROLE_PROFILE: RoleProfile = {
  role: Role.Gravekeeper, camp: Camp.Good, goodSide: "god",
  label: roleName("gravekeeper"), skillBrief: text("zh-CN", "role.gravekeeper.brief"),
  init: role => { setGravekeeperState(role, { history: [] }); },
  renderPrompt: (role, locale = "zh-CN") => {
    const history = getGravekeeperState(role)?.history, raw = Array.isArray(history) ? history.at(-1) : undefined;
    const report = readGravekeeperReport(raw);
    return text(locale, "role.gravekeeper.state") + " " + (report
      ? text(locale, "role.gravekeeper.latest", { exileDay: report.exileDay, receivedDay: report.receivedDay, target: report.targetId, result: inspectionLabel(report.result, locale) })
      : text(locale, raw === undefined && Array.isArray(history) ? "role.gravekeeper.no_report" : "replay.unknown"));
  },
  configuration: { schema: z.strictObject({}), defaults: {}, apply: config => config },
  nightStages: [GRAVEKEEPER_FEEDBACK_STAGE],
};
