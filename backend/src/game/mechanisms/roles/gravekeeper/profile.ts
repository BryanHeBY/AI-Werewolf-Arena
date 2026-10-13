/**
 * 负责装配守墓人的初始化、报告历史展示和放逐反馈阶段贡献。
 * 输入为初始化组件、原报告历史与语言；输出为既有 RoleProfile、反馈提示和阶段贡献。
 * 状态写入委托原 state，反馈产生委托 feedback，不建立第二仓库、授权 lease 或编码归档。
 */
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
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
