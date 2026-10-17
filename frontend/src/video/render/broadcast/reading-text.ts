/**
 * 负责确定性阅读词组与标点的换行保护。输入为原文及已裁剪资料名称，输出保持原UTF16区间的文字run。
 * 角色／座次／模型只用于排版，不高亮目标、不识别发言意图，也不在原话中插入不可见字符。
 */
import { Role } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";

export interface ReadingTextRun {
  text: string;
  start: number;
  end: number;
  keep: boolean;
}
const roles = Object.values(Role).flatMap((role) => [
  roleName(role, "zh-CN"),
  roleName(role, "en"),
]);
const vocabulary = [
  ...roles,
  text("zh-CN", "reason.wolves_reach_half"),
  text("en", "reason.wolves_reach_half"),
];
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
const opening = /^[\[({\uFF08\u3008\u300A\u300C\u300E\u3010\u201C\u2018]$/u;
const closing =
  /^[\])},.!?:;\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1B\uFF1A\uFF09\u3009\u300B\u300D\u300F\u3011\u201D\u2019]$/u;

export function readingTextRuns(
  value: string,
  protectedTerms: readonly string[] = [],
): ReadingTextRun[] {
  const terms = [...new Set([...vocabulary, ...protectedTerms])]
    .filter((term) => term.length > 1 && !/[\r\n]/.test(term) && [...term].length <= 16)
    .sort((a, b) => b.length - a.length);
  const byFirst = new Map<string, string[]>();
  for (const term of terms) {
    const key = term[0]!;
    byFirst.set(key, [...(byFirst.get(key) ?? []), term]);
  }
  const units: ReadingTextRun[] = [];
  const segments = new Map(
    [...graphemes.segment(value)].map((segment) => [segment.index, segment.segment]),
  );
  let cursor = 0;
  while (cursor < value.length) {
    const rest = value.slice(cursor);
    const literal = byFirst
      .get(value[cursor]!)
      ?.find(
        (term) =>
          rest.startsWith(term) &&
          (cursor + term.length === value.length || segments.has(cursor + term.length)),
      );
    const seat = /^(?:Player\s+\d+|\d+\s*\u53F7(?:\u73A9\u5BB6)?)/u.exec(rest)?.[0];
    const word =
      /^[\p{Script=Latin}0-9][\p{Script=Latin}\p{Mark}0-9._+#@/\-]*(?:['\u2019][\p{Script=Latin}\p{Mark}0-9]+)*/u.exec(
        rest,
      )?.[0];
    const token =
      literal ??
      seat ??
      word ??
      segments.get(cursor) ??
      String.fromCodePoint(value.codePointAt(cursor)!);
    const end = cursor + token.length;
    if ([...token].length > 16) {
      // 超宽模型／URL先按grapheme降级，标点只能粘住邻近字符，不能把整条长串重新包成nowrap。
      for (const part of graphemes.segment(token))
        units.push({
          text: part.segment,
          start: cursor + part.index,
          end: cursor + part.index + part.segment.length,
          keep: false,
        });
    } else units.push({ text: token, start: cursor, end, keep: token.length > 1 });
    cursor = end;
  }
  const runs: ReadingTextRun[] = [];
  for (let index = 0; index < units.length; index++) {
    const unit = { ...units[index]! };
    // 左标点随下一个完整词组，右标点随前一个词组；始终只合并原连续切片。
    while (
      opening.test(unit.text.at(-1) ?? "") &&
      units[index + 1] &&
      !/[\r\n]/.test(units[index + 1]!.text) &&
      [...unit.text, ...units[index + 1]!.text].length <= 16
    ) {
      const next = units[++index]!;
      unit.text += next.text;
      unit.end = next.end;
      unit.keep = true;
    }
    if (closing.test(unit.text) && runs.length && !/[\r\n]/.test(runs.at(-1)!.text)) {
      const previous = runs.at(-1)!;
      previous.text += unit.text;
      previous.end = unit.end;
      previous.keep = [...previous.text].length <= 16;
    } else runs.push(unit);
  }
  return runs;
}
