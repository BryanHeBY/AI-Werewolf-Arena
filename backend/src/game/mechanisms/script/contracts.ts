/**
 * 负责定义脚本回放与终端渲染贡献的事件专属数据结构。输入为 GameEvent 联合、可选语言及私有输出选项；
 * 输出约束聊天／裁判／阶段行和分类文本。类型按注册事件收窄 payload，不运行分派、校验事实真实性或授予受众。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
/** 文件说明：脚本回放与终端渲染相关契约。 */
import type { GameEvent } from "../../../core/domain/model";

/** 终端 live 输出类型。 */
export type ScriptLiveKind = "chat" | "action" | "private" | "god" | "system" | "end";

/** 终端 live 渲染结果结构。 */
export interface ScriptLiveRender {
  kind: ScriptLiveKind;
  text: string;
}

/** 每个 handler 的事件实参按它所注册的 type 收窄，不把别族 payload 混作同一结构。 */
type ScriptEventHandlers<T> = {
  [K in GameEvent["type"]]?: (event: Extract<GameEvent, { type: K }>, locale?: Locale) => T;
};

export type ScriptChatLineHandlers = ScriptEventHandlers<string | null>;
export type ScriptJudgeLineHandlers = ScriptEventHandlers<string | null>;
export type ScriptReplayStageHandlers = ScriptEventHandlers<string | null>;
export type ScriptLiveRenderHandlers = {
  [K in GameEvent["type"]]?: (
    event: Extract<GameEvent, { type: K }>,
    printPrivateEvents: boolean,
    locale?: Locale,
  ) => ScriptLiveRender[] | null;
};
