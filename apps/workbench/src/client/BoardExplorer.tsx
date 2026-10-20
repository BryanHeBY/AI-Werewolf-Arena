/**
 * 负责按人数与角色组合组织板子选择，并提供实际支持的常用规则编辑。
 * 输入公开板子目录和原始文档，输出模板选择或局部字段修改；不以角色资料状态推断任意组合可运行。
 */
import { useMemo, useState } from "react";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import {
  ActionWindow,
  KnightDuelWindow,
  WitchSelfHealRule,
} from "@ai-werewolf-arena/game-contract";
import type { BoardCard, Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Translator } from "./types";
import { asObject, readPath, writePath } from "./config-edit";
export function BoardExplorer({
  boards,
  t,
  locale,
  onChoose,
}: {
  boards: BoardCard[];
  t: Translator;
  locale: Locale;
  onChoose: (board: BoardCard) => void;
}) {
  const [size, setSize] = useState(12),
    [search, setSearch] = useState("");
  const groups = useMemo(() => {
    const groups = new Map<string, BoardCard[]>();
    for (const board of boards.filter((b) => b.supported && (!size || b.size === size))) {
      const words =
        `${board.id} ${board.roles.map((r) => roleName(r.role, locale)).join(" ")}`.toLowerCase();
      if (!words.includes(search.toLowerCase())) continue;
      const key = JSON.stringify([...board.roles].sort((a, b) => a.role.localeCompare(b.role)));
      groups.set(key, [...(groups.get(key) ?? []), board]);
    }
    return [...groups.values()].sort((a, b) => a[0].roles.length - b[0].roles.length);
  }, [boards, size, search, locale]);
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("presets")}</span>
          <h2>{t("chooseBoard")}</h2>
        </div>
        <div className="segments">
          {[
            [12, t("twelve")],
            [6, t("six")],
            [0, t("all")],
          ].map(([v, label]) => (
            <button
              key={v}
              className={size === v ? "selected" : ""}
              onClick={() => setSize(Number(v))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">{t("boardHelp")}</p>
      <input
        className="search"
        placeholder={t("search")}
        aria-label={t("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="board-grid">
        {groups.map((group) => (
          <BoardGroup key={group[0].id} group={group} t={t} locale={locale} onChoose={onChoose} />
        ))}
      </div>
    </section>
  );
}
function BoardGroup({
  group,
  t,
  locale,
  onChoose,
}: {
  group: BoardCard[];
  t: Translator;
  locale: Locale;
  onChoose: (board: BoardCard) => void;
}) {
  const ordered = [...group].sort((a, b) => a.id.length - b.id.length),
    [selected, setSelected] = useState(ordered[0].id),
    board = group.find((b) => b.id === selected) ?? ordered[0];
  const special = board.roles.filter((r) => !["wolf", "villager"].includes(r.role));
  return (
    <article className="board-card panel">
      <div className="card-kicker">
        <span className="orb">{board.size}</span>
        <span>{t("boards")}</span>
      </div>
      <h3>
        {special
          .map((r) => roleName(r.role, locale))
          .slice(0, 4)
          .join(" · ") || board.id}
      </h3>
      <div className="role-chips">
        {board.roles.map((r) => (
          <span key={r.role}>
            {roleName(r.role, locale)} <b>×{r.count}</b>
          </span>
        ))}
      </div>
      {group.length > 1 && (
        <label className="variant-label">
          {t("variants")} · {group.length}
          <select value={board.id} onChange={(e) => setSelected(e.target.value)}>
            {ordered.map((b) => (
              <option value={b.id} key={b.id}>
                {b.id.replace(/^twelve_player_|^six_player_|^awa_/g, "").replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="card-bottom">
        <code>{board.id}</code>
        <button onClick={() => onChoose(board)}>{t("choose")} →</button>
      </div>
    </article>
  );
}
export function BoardForm({
  raw,
  change,
  t,
  locale,
}: {
  raw: JsonObject;
  change: (raw: JsonObject) => void;
  t: Translator;
  locale: Locale;
}) {
  const set = (field: string, value: Json) => {
      let next = writePath(raw, field, value);
      if (field === "mechanisms.selfDestruct.enabledWindows" && Array.isArray(value)) {
        const hooks: Record<string, string> = {
          on_daybreak: "onDaybreak",
          on_pre_election: "onPreElection",
          on_pre_vote: "onPreVote",
          on_per_speech_gap: "onPerSpeechGap",
        };
        for (const window of value)
          if (typeof window === "string" && hooks[window])
            next = writePath(next, `rules.hooks.${hooks[window]}`, true);
      }
      change(next);
    },
    board = asObject(raw.board),
    roster = Array.isArray(board.roleSetups) ? board.roleSetups.map(asObject) : [],
    has = (role: string) => roster.some((r) => r.role === role);
  const check = (field: string, label: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={readPath(raw, field) === true}
        onChange={(e) => set(field, e.target.checked)}
      />
      {label}
    </label>
  );
  const multi = (field: string, options: { value: string; label: string }[]) => {
    const values = readPath(raw, field);
    const selected = Array.isArray(values) ? values : [];
    return (
      <div className="checks">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(e) =>
                set(
                  field,
                  e.target.checked
                    ? [...selected, option.value]
                    : selected.filter((v) => v !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  };
  return (
    <div className="form-body">
      <h3>
        {t("roster")} · {String(board.size ?? "")}
      </h3>
      <div className="role-chips large">
        {roster.map((r) => (
          <span key={String(r.role)}>
            {roleName(String(r.role), locale)} <b>×{String(r.count)}</b>
          </span>
        ))}
      </div>
      <p className="muted">{t("policyJson")}</p>
      <section className="field-section">
        <h3>{t("rules")}</h3>
        {check("mechanisms.sheriff.enabled", t("sheriff"))}
        <label>
          {t("voteWeight")}
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={Number(readPath(raw, "mechanisms.sheriff.voteWeight") ?? 1.5)}
            onChange={(e) => set("mechanisms.sheriff.voteWeight", Number(e.target.value))}
          />
        </label>
        {has("witch") && (
          <label>
            {t("witchSelfHeal")}
            <select
              aria-label={t("witchSelfHeal")}
              value={String(readPath(raw, "roles.witch.selfHeal") ?? WitchSelfHealRule.Disabled)}
              onChange={(e) => set("roles.witch.selfHeal", e.target.value)}
            >
              <option value={WitchSelfHealRule.Disabled}>{t("disabled")}</option>
              <option value={WitchSelfHealRule.FirstNightOnly}>{t("firstNight")}</option>
              <option value={WitchSelfHealRule.Always}>{t("always")}</option>
            </select>
          </label>
        )}
        {has("knight") && (
          <div className="field-section">
            <h4>{t("knightWindows")}</h4>
            {multi("roles.knight.enabledWindows", [
              { value: KnightDuelWindow.BeforeSpeeches, label: t("beforeSpeeches") },
              { value: KnightDuelWindow.BetweenSpeeches, label: t("speechGap") },
              { value: KnightDuelWindow.AfterSpeeches, label: t("afterSpeeches") },
            ])}
          </div>
        )}
        <div className="field-section">
          <h4>{t("selfDestruct")}</h4>
          {multi("mechanisms.selfDestruct.enabledWindows", [
            { value: ActionWindow.OnDaybreak, label: t("daybreak") },
            { value: ActionWindow.OnPreElection, label: t("preElection") },
            { value: ActionWindow.OnPreVote, label: t("preVote") },
            { value: ActionWindow.OnPerSpeechGap, label: t("speechGap") },
          ])}
        </div>
      </section>
    </div>
  );
}
