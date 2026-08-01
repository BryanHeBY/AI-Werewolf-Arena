/** 文件说明：将板子配置渲染为初始系统提示中的“本局规则配置”文本。 */
import {
  ActionWindow,
  BoardConfig,
  WinCondition,
  WitchSelfHealRule,
} from "../../../core/domain/model";

/** 配置渲染注册器契约。 */
export interface ConfigRenderRegistry {
  renderBoardConfigPrompt(config: BoardConfig): string;
}

const WIN_CONDITION_TEXT: Record<WinCondition, string> = {
  [WinCondition.SlaughterSide]: "屠边：神民任一边全灭则狼人胜，狼人全灭则好人胜",
  [WinCondition.SlaughterCity]: "屠城：好人全灭则狼人胜，狼人全灭则好人胜",
  [WinCondition.WolfReachHalf]:
    "狼人达半：存活狼人数量大于等于存活好人数量时，狼人立即获胜",
};

const WINDOW_TEXT: Record<ActionWindow, string> = {
  [ActionWindow.OnDaybreak]: "天亮后",
  [ActionWindow.OnPreElection]: "上警前",
  [ActionWindow.OnPreVote]: "放逐投票前",
  [ActionWindow.OnPerSpeechGap]: "发言间隙",
};

const TIE_BREAKER_TEXT: Record<string, string> = {
  min_id: "最低编号者",
  min_seat: "最小座位者",
  no_elimination: "无人出局",
  no_kill: "无人死亡",
};

/** 默认配置渲染实现。 */
export class DefaultConfigRenderRegistry implements ConfigRenderRegistry {
  /** 把归一化后的配置渲染为可直接注入 system prompt 的文本。 */
  renderBoardConfigPrompt(config: BoardConfig): string {
    const winConditions = this.resolveWinConditions(config)
      .map((item) => WIN_CONDITION_TEXT[item] ?? item)
      .join("；");
    const sheriffEnabled = config.enableSheriff === true;
    const sheriffWeight = config.sheriff?.voteWeight ?? 1.5;
    const sheriffText = sheriffEnabled
      ? `启用（包含上警、竞选发言、退水、警下投票；警长决定发言方向；警长票权=${sheriffWeight}）`
      : "未启用";
    const sheriffFlowText = sheriffEnabled
      ? "首日特殊时序：夜间行动结束后先进行上警报名、警上发言、退水和警下投票；警长投票结束后，才由 night_resolved 公布昨夜死亡或平安夜，再处理首夜遗言、警长定序和常规白天发言。昨夜实际死亡的玩家在公开结算前仍会参与上警流程。"
      : undefined;
    const selfDestructWindows = config.selfDestruct?.enabledWindows ?? [];
    const selfDestructText =
      selfDestructWindows.length > 0
        ? `启用（窗口：${selfDestructWindows.map((item) => WINDOW_TEXT[item] ?? item).join("、")}）`
        : "未启用";
    const witchSelfHealRule =
      config.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled;
    const witchSelfHeal =
      witchSelfHealRule === WitchSelfHealRule.Always
        ? "一直允许"
        : witchSelfHealRule === WitchSelfHealRule.FirstNightOnly
          ? "仅首夜允许"
          : "不允许";
    const exileTie = config.tieBreaker?.exileVote ?? "min_id";
    const wolfTie = config.tieBreaker?.wolfKillVote ?? "min_id";
    const promptLines = [
      "本局规则配置：",
      `胜利条件：${winConditions}`,
      `警长机制：${sheriffText}`,
      ...(sheriffFlowText ? [sheriffFlowText] : []),
      `自爆机制：${selfDestructText}`,
      ...(config.witch ? [`女巫自救：${witchSelfHeal}`] : []),
      "公开裁定：普通夜间死亡和放逐出局均不公开底牌；仅以 idiot_revealed 等引擎事件明确公开的身份，以及个人收到的私有身份/查验事件为事实。玩家在发言或遗言中自报身份不属于引擎认证。",
      "遗言规则：仅首夜死亡者和真正被放逐出局者获得遗言；第二夜起的夜间死亡、自爆、白痴翻牌免死以及猎人带走的目标均无遗言。",
      ...(sheriffEnabled
        ? ["警徽流转：警长死亡或以白痴身份翻牌时，由引擎自动移交或销毁警徽，不提供原警长自行选择移交目标的行动。"]
        : []),
      `平票处理：放逐=${TIE_BREAKER_TEXT[exileTie] ?? exileTie}，狼刀=${TIE_BREAKER_TEXT[wolfTie] ?? wolfTie}${config.tieBreaker?.sheriffVote ? `，警长投票=${TIE_BREAKER_TEXT[config.tieBreaker.sheriffVote] ?? config.tieBreaker.sheriffVote}` : ""}`,
    ];

    return promptLines.join("\n");
  }

  /** 兼容旧字段 `winCondition`，统一生成胜利条件数组。 */
  private resolveWinConditions(config: BoardConfig): WinCondition[] {
    if (Array.isArray(config.winConditions) && config.winConditions.length > 0) {
      return config.winConditions;
    }
    if (config.winCondition) {
      return [config.winCondition];
    }
    return [WinCondition.SlaughterCity];
  }
}

let defaultRegistry: ConfigRenderRegistry | null = null;

/** 获取默认配置渲染注册器。 */
export function getDefaultConfigRenderRegistry(): ConfigRenderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new DefaultConfigRenderRegistry();
  }
  return defaultRegistry;
}
