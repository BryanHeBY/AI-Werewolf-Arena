/**
 * 负责工作台板子表单的显式 JSON 编辑联动；输入原文、字段路径和值，输出独立草稿。
 * 这里只协调同一设置的底层表示，不裁定角色组合或开放领域能力；实际合法性仍交唯一板子解析器。
 */
import type { Json, JsonObject } from "./index";

function object(value: Json | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function put(draft: JsonObject, path: string, value: Json | undefined): void {
  const keys = path.split(".");
  let owner = draft;
  for (const key of keys.slice(0, -1)) {
    owner[key] = { ...object(owner[key]) };
    owner = owner[key] as JsonObject;
  }
  const key = keys.at(-1)!;
  if (value === undefined) delete owner[key];
  else owner[key] = value;
}

export function applyBoardRuleEdit(
  raw: JsonObject,
  path: string,
  value: Json | undefined,
): JsonObject {
  const draft = structuredClone(raw);
  put(draft, path, value);
  if (path === "mechanisms.selfDestruct.enabledWindows" && Array.isArray(value)) {
    // 表单只有这一组自爆开关；删除旧窗口也同时关闭它的阶段钩子。
    for (const [window, hook] of Object.entries({
      on_daybreak: "onDaybreak",
      on_pre_election: "onPreElection",
      on_pre_vote: "onPreVote",
      on_per_speech_gap: "onPerSpeechGap",
    }))
      put(draft, `rules.hooks.${hook}`, value.includes(window));
  }
  if (path === "mechanisms.sheriff.enabled" && value === false) {
    // 禁用机制不提交仍有规则效力的从属参数；重新开启时由解析器补标准缺省。
    put(draft, "mechanisms.sheriff", { enabled: false });
  }
  const mechanisms = object(draft.mechanisms);
  if (object(mechanisms.sheriff).electionPolicy === "awa_nomination_offstage_pk_v1")
    put(draft, "mechanisms.sheriff.tieBreaker", "no_elimination");
  if (object(mechanisms.voting).exilePolicy === "awa_one_pk_v1")
    put(draft, "mechanisms.tieBreaker.exileVote", "no_elimination");
  return draft;
}
