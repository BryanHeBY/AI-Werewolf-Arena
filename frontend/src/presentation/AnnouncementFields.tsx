/**
 * 负责开局身份网格和普通名单／警徽公告的紧凑双语排版。输入为已校验语义块、裁剪展示名单与主题色，输出可复用的无时钟DOM。
 * 开局仅展示座次、记录角色和明确阵营，不重复昵称／模型；普通公告仅强调对象，不把候选、查验或退水当身份和生命事实。
 */
import { Fragment } from "react";
import { playerLabel, type NamedPlayer } from "@ai-werewolf-arena/game-presentation";
import {
  dictionaries,
  roleName,
  term,
  text,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import { RoleCrest } from "./RoleCrest";
import { roleColorVariable } from "../themes/role-colors";
import type { AnnouncementContent } from "./announcement-content";
import { announcementCampColor, semanticColors, type SemanticColors } from "./semantic-colors";

export function AnnouncementFields({
  announcement,
  locale,
  players,
  colors: supplied,
  iconSize = 24,
}: {
  announcement: AnnouncementContent;
  locale: Locale;
  players: readonly NamedPlayer[];
  colors?: Partial<SemanticColors>;
  iconSize?: number;
}) {
  const colors = semanticColors(supplied);
  const seat = (id: number, fallback?: number) =>
    playerLabel({ id, seat: players.find((player) => player.id === id)?.seat ?? fallback }, locale);
  const token = (id: number) => (
    <span
      data-content-player={id}
      style={{ color: colors.accent, whiteSpace: "normal", overflowWrap: "anywhere" }}
    >
      <strong style={{ whiteSpace: "nowrap" }}>{seat(id)}</strong>
      {players.find((player) => player.id === id)?.name && (
        <> · {players.find((player) => player.id === id)!.name}</>
      )}
    </span>
  );
  // 能力、操作或方向的未知标识保留原记录；不按字面猜测技能效果、可用状态或真实阵营。
  const knownTerm = (key: string, recorded: string) =>
    Object.hasOwn(dictionaries[locale], key) ? text(locale, key as MessageKey) : recorded;
  if (announcement.kind === "notice") {
    const keys = {
      "charm-link": "replay.stage.charm_death",
      "poisoned-shot": "replay.stage.hunter_silent_due_to_poison",
      "idiot-reveal": "replay.stage.idiot_revealed",
    } as const;
    return (
      <div data-announcement-kind="notice" data-notice-purpose={announcement.purpose}>
        <div style={{ color: colors.muted, fontSize: ".75em", marginBottom: ".35em" }}>
          {text(locale, keys[announcement.purpose])}
        </div>
        {token(announcement.playerId)}
        {announcement.targetId !== undefined && (
          <>
            {" "}
            <span aria-hidden="true">→</span> {token(announcement.targetId)}
          </>
        )}
      </div>
    );
  }
  if (
    announcement.kind === "last-words" ||
    announcement.kind === "direction" ||
    announcement.kind === "ability"
  )
    return (
      <div
        data-announcement-kind={announcement.kind}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: ".35em .7em" }}
      >
        <span style={{ color: colors.muted, fontSize: ".75em" }}>
          {text(
            locale,
            announcement.kind === "last-words"
              ? "replay.stage.last_words_granted"
              : announcement.kind === "direction"
                ? "replay.stage.sheriff_direction_chosen"
                : "replay.stage.ability_changed",
          )}
        </span>
        {token(announcement.playerId)}
        {announcement.kind === "direction" && (
          <strong style={{ color: colors.accent }}>
            {knownTerm(`console.direction.${announcement.direction}`, announcement.direction)}
          </strong>
        )}
        {announcement.kind === "ability" && (
          <>
            <strong>
              {knownTerm(`ability.kind.${announcement.abilityKind}`, announcement.abilityKind)}
            </strong>
            <span
              style={{
                color: ["disabled", "transferred_out"].includes(announcement.operation)
                  ? colors.muted
                  : colors.accent,
              }}
            >
              {knownTerm(`ability.operation.${announcement.operation}`, announcement.operation)}
            </span>
          </>
        )}
      </div>
    );
  if (announcement.kind === "lineup") {
    const ordered = [...announcement.players].sort(
      (left, right) =>
        (players.find((player) => player.id === left.playerId)?.seat ??
          left.seat ??
          left.playerId) -
        (players.find((player) => player.id === right.playerId)?.seat ??
          right.seat ??
          right.playerId),
    );
    return (
      <div
        data-announcement-kind="lineup"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9em), 1fr))",
          gap: ".5em",
        }}
      >
        {ordered.map((entry, index) => {
          const color = announcementCampColor(entry.camp, colors);
          const roleColor = roleColorVariable(entry.roleId, color);
          return (
            <div
              key={`${entry.playerId}:${index}`}
              data-lineup-player={entry.playerId}
              data-lineup-camp={entry.camp}
              style={{
                minWidth: 0,
                padding: ".35em .5em",
                borderLeft: `.12em solid ${roleColor}`,
                background: "transparent",
                display: "grid",
                gap: ".12em",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: ".3em" }}>
                <strong style={{ whiteSpace: "nowrap" }}>{seat(entry.playerId, entry.seat)}</strong>
                <span
                  data-lineup-camp-label
                  style={{ color, fontSize: ".64em", lineHeight: 1.25, overflowWrap: "normal" }}
                >
                  {entry.camp === "unknown"
                    ? text(locale, "common.unknown")
                    : term("camp", entry.camp, locale)}
                </span>
              </div>
              <div
                data-lineup-role={entry.roleId}
                style={{
                  color: roleColor,
                  display: "flex",
                  alignItems: "center",
                  gap: ".25em",
                  fontSize: ".94em",
                  lineHeight: 1.3,
                  minWidth: 0,
                }}
              >
                <RoleCrest role={entry.roleId} size={iconSize} color={roleColor} />
                <span style={{ minWidth: 0, wordBreak: "normal", overflowWrap: "anywhere" }}>
                  {entry.roleId === "unknown"
                    ? text(locale, "common.unknown")
                    : roleName(entry.roleId, locale)}
                </span>
              </div>
            </div>
          );
        })}
        {!ordered.length && <span>{text(locale, "common.none")}</span>}
      </div>
    );
  }
  if (announcement.kind === "phase")
    return (
      <strong data-announcement-kind="phase">
        {text(locale, "replay.day_phase", {
          day: announcement.day,
          phase: term("phase", announcement.phase, locale),
        })}
      </strong>
    );
  if (announcement.kind === "roster") {
    const withdrawn = announcement.purpose === "withdrawal";
    const keys: Record<typeof announcement.purpose, MessageKey> = {
      "wolf-order": "replay.stage.wolf_tactical_order",
      nomination: "replay.stage.sheriff_nomination_summary",
      withdrawal: "replay.stage.sheriff_withdraw_summary",
      candidates: "replay.stage.sheriff_candidates_finalized",
      "sheriff-pk": "replay.stage.sheriff_pk_started",
      "exile-pk": "replay.stage.exile_pk_started",
    };
    return (
      <div data-announcement-kind="roster" data-roster-purpose={announcement.purpose}>
        <div style={{ color: colors.muted, fontSize: ".75em", marginBottom: ".35em" }}>
          {text(locale, keys[announcement.purpose])}
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: ".35em .65em", alignItems: "baseline" }}
        >
          {announcement.playerIds.map((id, index) => (
            <Fragment key={`${id}:${index}`}>
              {announcement.ordered && index > 0 && (
                <span aria-hidden="true" style={{ color: colors.muted }}>
                  →
                </span>
              )}
              <span
                style={{
                  color: withdrawn ? colors.muted : colors.accent,
                  borderBottom: withdrawn ? "1px dashed currentColor" : undefined,
                }}
              >
                {withdrawn ? <span data-content-player={id}>{seat(id)}</span> : token(id)}
              </span>
            </Fragment>
          ))}
          {!announcement.playerIds.length && <span>{text(locale, "common.none")}</span>}
        </div>
      </div>
    );
  }
  const badgeKeys = {
    elected: "replay.stage.sheriff_elected",
    transferred: "replay.stage.sheriff_badge_transferred",
    destroyed: "replay.stage.sheriff_badge_destroyed",
  } as const;
  return (
    <div data-announcement-kind="badge" data-badge-operation={announcement.operation}>
      <div style={{ color: colors.muted, fontSize: ".75em", marginBottom: ".35em" }}>
        {text(locale, badgeKeys[announcement.operation])}
      </div>
      {announcement.fromId !== undefined && (
        <>
          {token(announcement.fromId)} <span aria-hidden="true">→</span>{" "}
        </>
      )}
      {token(announcement.playerId)}
    </div>
  );
}
