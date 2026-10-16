/**
 * 负责事件时间线的搜索、日／阶段导航与可暂停跟随。输入为已筛选事件和源 seq，输出文案及当前数组下标的跳转回调。
 * 文案在事件／语言变化时缓存；跟随只滚动列表内部，不抢页面滚动位置，不以源 seq 推算视频帧或更改归档事实。
 */
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { createPlayerText, type NamedPlayer } from "@ai-werewolf-arena/game-presentation";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "./event-labels";
import { phaseName, eventStageName } from "./replay-localization";

/** activeEventSeq 用源序号高亮，onJumpTo 用当前列表下标；筛选后的映射归工作台。 */
interface EventTimelineProps {
  events: ReplayEvent[];
  players?: readonly NamedPlayer[];
  locale: Locale;
  playerIds: readonly number[];
  activeEventSeq: number | null;
  focusedPlayerId: number | null;
  onJumpTo: (index: number) => void;
  onClearFocus: () => void;
  isVisible?: boolean;
}
const EMPTY_PLAYERS: readonly NamedPlayer[] = [];

export const EventTimeline = memo(function EventTimeline({
  events,
  players = EMPTY_PLAYERS,
  locale,
  playerIds,
  activeEventSeq,
  focusedPlayerId,
  onJumpTo,
  onClearFocus,
  isVisible = true,
}: EventTimelineProps) {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const entries = useMemo(
    () =>
      events.map((event, index) => {
        const label = eventLabel(event, locale, playerIds, players);
        const phase = phaseName(event.phase, locale);
        const stage = eventStageName(event, locale, playerIds);
        return {
          event,
          index,
          label,
          phase,
          stage,
          searchText: `${event.seq} ${phase} ${stage} ${label}`.toLocaleLowerCase(locale),
        };
      }),
    [events, locale, playerIds, players],
  );
  const chapters = useMemo(
    () =>
      entries.filter((entry, index) => {
        const previous = entries[index - 1]?.event;
        return (
          !previous || previous.day !== entry.event.day || previous.phase !== entry.event.phase
        );
      }),
    [entries],
  );
  const activeChapter = [...chapters]
    .reverse()
    .find((entry) => activeEventSeq !== null && entry.event.seq <= activeEventSeq);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visible = useMemo(
    () =>
      normalizedQuery
        ? entries.filter((entry) => entry.searchText.includes(normalizedQuery))
        : entries,
    [entries, normalizedQuery],
  );

  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!isVisible || !following || !list || !active) return;
    // 不用 scrollIntoView，避免播放时把整个页面拉回时间线。
    const listBox = list.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    if (activeBox.top < listBox.top) list.scrollTop -= listBox.top - activeBox.top;
    else if (activeBox.bottom > listBox.bottom) list.scrollTop += activeBox.bottom - listBox.bottom;
  }, [activeEventSeq, following, visible, isVisible]);

  return (
    <section className="panel timeline">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">{text(locale, "replay.kicker.timeline")}</p>
          <h2>
            {focusedPlayerId === null
              ? text(locale, "replay.timeline")
              : createPlayerText(players)(locale, "replay.player_timeline", {
                  id: focusedPlayerId,
                })}
          </h2>
        </div>
        {focusedPlayerId !== null && (
          <button type="button" className="text-button" onClick={onClearFocus}>
            {text(locale, "replay.clear_focus")}
          </button>
        )}
      </div>
      <div className="timeline-controls">
        <label className="timeline-search">
          {text(locale, "replay.search_events")}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          {text(locale, "replay.jump_chapter")}
          <select
            aria-label={text(locale, "replay.jump_chapter")}
            value={activeChapter?.index ?? ""}
            onChange={(event) => {
              setQuery("");
              onJumpTo(Number(event.target.value));
            }}
          >
            <option value="" disabled>
              {text(locale, "replay.choose_chapter")}
            </option>
            {chapters.map((entry) => (
              <option key={entry.event.seq} value={entry.index}>
                {text(locale, "replay.day_phase", { day: entry.event.day, phase: entry.phase })} · #
                {entry.event.seq}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-button"
          aria-pressed={following}
          onClick={() => setFollowing((value) => !value)}
        >
          {text(locale, following ? "replay.following" : "replay.resume_follow")}
        </button>
        <span className="timeline-count">
          {text(locale, "replay.visible_events", { count: visible.length, total: events.length })}
        </span>
      </div>
      <div
        className="timeline-list"
        ref={listRef}
        tabIndex={0}
        aria-label={text(locale, "replay.timeline")}
        onWheel={() => setFollowing(false)}
        onTouchStart={() => setFollowing(false)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setFollowing(false);
        }}
        onKeyDown={(event) => {
          if (
            ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)
          )
            setFollowing(false);
        }}
      >
        {visible.length === 0 && (
          <p className="timeline-empty">{text(locale, "replay.no_matching_events")}</p>
        )}
        {visible.map(({ event, index, label, phase, stage }, visibleIndex) => (
          <Fragment key={event.seq}>
            {(visibleIndex === 0 ||
              visible[visibleIndex - 1]!.event.day !== event.day ||
              visible[visibleIndex - 1]!.event.phase !== event.phase) && (
              <h3
                className="timeline-group-heading"
                data-tone={event.phase === "night" ? "night" : "day"}
              >
                <span aria-hidden="true">{event.phase === "night" ? "☾" : "☼"}</span>
                {text(locale, "replay.day_phase", { day: event.day, phase })}
              </h3>
            )}
            <button
              type="button"
              className={`event ${event.seq === activeEventSeq ? "active" : ""}`}
              data-event-seq={event.seq}
              ref={event.seq === activeEventSeq ? activeRef : undefined}
              aria-current={event.seq === activeEventSeq ? "step" : undefined}
              onClick={() => onJumpTo(index)}
            >
              <span className="event-marker">D{event.day}</span>
              <div>
                <div className="event-head">
                  <span>
                    #{event.seq} · {phase}
                  </span>
                  <span>{stage}</span>
                </div>
                <p>{label}</p>
              </div>
            </button>
          </Fragment>
        ))}
      </div>
    </section>
  );
});
