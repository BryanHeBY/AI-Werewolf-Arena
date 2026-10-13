/**
 * 负责从单个 sidecar 任务环境读取语言。输入为传入环境表，输出为严格支持的语言，缺席使用原中文默认值、未知值抛原错。
 * 副作用边界仅为按原位置同步读取输入，不写宿主全局语言；语言契约唯一归 game-contract。
 * 本查询没有异步任务，不持有取消状态或截止时间；进程／任务取消与期限仍归 sidecar 调用方。
 */
import { isLocale, type Locale } from "@ai-werewolf-arena/game-contract";

/** 注入的 sidecar 只读取本任务语言，不使用可变的宿主全局语言。 */
export function taskLocale(environment: Readonly<Record<string, string | undefined>>): Locale {
  const locale = environment.AWA_TASK_LOCALE ?? "zh-CN";
  if (!isLocale(locale)) throw new Error("acp_task_locale_invalid");
  return locale;
}
