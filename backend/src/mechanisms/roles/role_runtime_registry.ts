import { RoleComponent } from "../../domain/components/role";
import { Role } from "../../domain/model";
import {
  getSeerState,
  getWitchState,
  setGuardState,
  setHunterState,
  setIdiotState,
  setSeerState,
  setWitchState,
} from "./private_state";

type RoleRuntimeInitializer = (roleComp: RoleComponent) => void;
type RolePromptRenderer = (roleComp: RoleComponent) => string;

const INIT: Partial<Record<Role, RoleRuntimeInitializer>> = {
  [Role.Witch]: (roleComp) => {
    setWitchState(roleComp, {
      heal: 1,
      poison: 1,
      canSelfHeal: false,
      healUsedThisNight: false,
      poisonUsedThisNight: false,
    });
  },
  [Role.Guard]: (roleComp) => {
    setGuardState(roleComp, { lastTarget: null });
  },
  [Role.Hunter]: (roleComp) => {
    setHunterState(roleComp, { canShoot: true });
  },
  [Role.Idiot]: (roleComp) => {
    setIdiotState(roleComp, { revealed: false });
  },
  [Role.Seer]: (roleComp) => {
    setSeerState(roleComp, {
      lastTarget: null,
      lastIsWerewolf: null,
      history: [],
    });
  },
};

const PROMPTS: Partial<Record<Role, RolePromptRenderer>> = {
  [Role.Witch]: (roleComp) =>
    `你的底牌是【女巫】。解药:${getWitchState(roleComp)?.heal ?? 0} 毒药:${getWitchState(roleComp)?.poison ?? 0}`,
  [Role.Guard]: () => "你的底牌是【守卫】。你每晚可以守护一名玩家，且不可连续同守。",
  [Role.Seer]: (roleComp) => {
    const seerState = getSeerState(roleComp);
    const latest =
      seerState &&
      seerState.lastTarget !== null &&
      seerState.lastIsWerewolf !== null
        ? ` 你上一条查验结果：${seerState.lastTarget}号是${seerState.lastIsWerewolf ? "狼人" : "好人"}。`
        : "";
    return `你的底牌是【预言家】。你每晚可以查验一名玩家阵营。${latest}`;
  },
  [Role.Hunter]: () => "你的底牌是【猎人】。满足条件时你可以开枪带走一名玩家。",
  [Role.Idiot]: () => "你的底牌是【白痴】。白天被放逐后可翻牌免死并失去投票权。",
  [Role.Wolf]: () => "你的底牌是【狼人】。你可以参与夜间战术交流和刀人投票。",
  [Role.Villager]: () => "你的底牌是【平民】。你没有夜间技能。",
};

export class RoleRuntimeRegistry {
  apply(roleComp: RoleComponent): void {
    const init = INIT[roleComp.role];
    if (init) {
      init(roleComp);
    }
    roleComp.renderPrompt = () => {
      const render = PROMPTS[roleComp.role];
      if (render) {
        return render(roleComp);
      }
      return "你的底牌是【平民】。你没有夜间技能。";
    };
  }
}

let defaultRegistry: RoleRuntimeRegistry | null = null;

export function getDefaultRoleRuntimeRegistry(): RoleRuntimeRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RoleRuntimeRegistry();
  }
  return defaultRegistry;
}
