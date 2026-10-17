/**
 * 负责镜头双语内容与导演正文优先级。输入为已选出处、共享记录解释和显式覆盖，输出场景基底、两语正文及独立结果文本。
 * 不安排帧、不从字幕推断结果；原始视觉语义与作者标注分别保留。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { NamedPlayer } from "@ai-werewolf-arena/game-presentation";
import { eventLabelFromRecord } from "../../replay/event-labels";
import { eventScene, factScene } from "../semantic-scenes";
import type { ShotOptions, VideoLayoutId } from "../types";
import type { VideoRecordReader } from "./records";
import type { VideoShotSource } from "./source-index";
import { fail } from "./validation";

export function prepareVideoShotContent(
  selected: VideoShotSource,
  edit: ShotOptions,
  options: {
    locale: Locale;
    layout: VideoLayoutId;
    playerIds: number[];
    names: readonly NamedPlayer[];
    readRecord: VideoRecordReader;
  },
) {
  const { event, committedFact, committedFacts, sourceEvents, view, primaryView, resolutionEvent } =
    selected;
  const { locale, layout, playerIds, names, readRecord } = options;
  const label = (value: NonNullable<typeof event>, language: Locale) =>
    eventLabelFromRecord(readRecord(value).record, language, playerIds, names);
  const base = committedFact
    ? factScene(committedFact, locale, names)
    : eventScene(
        event,
        sourceEvents,
        primaryView.label,
        primaryView.stage,
        playerIds,
        locale,
        readRecord(event),
      );
  if (committedFacts.length > 1) {
    base.body = committedFacts.map((fact) => factScene(fact, locale, names).body).join("\n");
    base.targetIds = committedFacts.flatMap((fact) =>
      fact.kind === "life_committed" ? [fact.playerId] : [],
    );
  }
  if (edit.caption !== undefined && typeof edit.caption !== "string") fail("caption_invalid");
  if (edit.caption !== undefined && edit.scene?.body === undefined) base.body = edit.caption;
  const body =
    edit.scene?.body ??
    edit.caption ??
    (layout === "broadcast-v1" || committedFact ? base.body : view.label);
  const otherLocale = locale === "en" ? "zh-CN" : "en";
  const otherScene = committedFact
    ? factScene(committedFact, otherLocale, names)
    : eventScene(
        event,
        sourceEvents,
        event ? label(event, otherLocale) : view.label,
        view.stage,
        playerIds,
        otherLocale,
        readRecord(event),
      );
  if (committedFacts.length > 1)
    otherScene.body = committedFacts
      .map((fact) => factScene(fact, otherLocale, names).body)
      .join("\n");
  const otherBody =
    edit.scene?.body ??
    edit.caption ??
    (layout === "broadcast-v1" || committedFact
      ? otherScene.body
      : event
        ? label(event, otherLocale)
        : view.label);
  const resolution = resolutionEvent
    ? {
        text: label(resolutionEvent, locale),
        otherText: label(resolutionEvent, otherLocale),
        targetId: Number(resolutionEvent.payload.target),
      }
    : undefined;
  return { base, body, otherBody, resolution };
}
export type VideoShotContent = ReturnType<typeof prepareVideoShotContent>;
