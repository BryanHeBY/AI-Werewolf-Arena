import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { getSeerState, setSeerState } from "../private_state";

export const SEER_ROLE_PROFILE: RoleProfile = {
  role: Role.Seer,
  label: "预言家",
  skillBrief: "每晚可查验一名玩家阵营",
  init: (roleComp) => {
    setSeerState(roleComp, {
      lastTarget: null,
      lastIsWerewolf: null,
      history: [],
    });
  },
  renderPrompt: (roleComp) => {
    const seerState = getSeerState(roleComp);
    const latest =
      seerState &&
      seerState.lastTarget !== null &&
      seerState.lastIsWerewolf !== null
        ? ` 你上一条查验结果：${seerState.lastTarget}号是${seerState.lastIsWerewolf ? "狼人" : "好人"}。`
        : "";
    return `你的底牌是【预言家】。你每晚可以查验一名玩家阵营。${latest}`;
  },
};
