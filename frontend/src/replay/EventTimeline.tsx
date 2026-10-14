/**
 * 负责渲染调用方提供的事件时间线。输入为已筛选事件、源 seq、焦点及显示语言，输出标签和跳转回调。
 * 回调索引属于当前传入数组，不是源事件 seq；组件不重排归档、计算游戏状态或执行权限过滤。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "./event-labels";
import { phaseName, eventStageName } from "./replay-localization";

/** activeEventSeq 用源序号高亮，onJumpTo 用当前列表下标；筛选后的映射归工作台。 */
interface EventTimelineProps {
  events: ReplayEvent[];
  locale: Locale;
  playerIds: readonly number[];
  activeEventSeq: number | null;
  focusedPlayerId: number | null;
  onJumpTo: (index: number) => void;
  onClearFocus: () => void;
}

export function EventTimeline({
  events,
  locale,
  playerIds,
  activeEventSeq,
  focusedPlayerId,
  onJumpTo,
  onClearFocus,
}: EventTimelineProps) {
  return (
    <section className="panel timeline">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">{text(locale, "replay.kicker.timeline")}</p>
          <h2>
            {focusedPlayerId === null
              ? text(locale, "replay.timeline")
              : text(locale, "replay.player_timeline", { id: focusedPlayerId })}
          </h2>
        </div>
        {focusedPlayerId !== null && (
          <button type="button" className="text-button" onClick={onClearFocus}>
            {text(locale, "replay.clear_focus")}
          </button>
        )}
      </div>
      <div className="timeline-list">
        {events.map((event, index) => (
          <button
            type="button"
            className={`event ${event.seq === activeEventSeq ? "active" : ""}`}
            key={event.seq}
            onClick={() => onJumpTo(index)}
          >
            <span className="event-marker">D{event.day}</span>
            <div>
              <div className="event-head">
                <span>
                  #{event.seq} · {phaseName(event.phase, locale)}
                </span>
                <span>{eventStageName(event, locale, playerIds)}</span>
              </div>
              <p>{eventLabel(event, locale, playerIds)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
