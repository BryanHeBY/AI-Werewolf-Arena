/**
 * 负责按人数与角色组合组织板子选择，并提供实际支持的常用规则编辑。
 * 输入公开板子目录和原始文档，输出模板选择或局部字段修改；不以角色资料状态推断任意组合可运行。
 */
import { useMemo, useState } from "react";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import type { BoardCard, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Translator } from "./types";
import { asObject } from "./config-edit";
import { BoardRuleFields } from "./BoardRuleFields";
import { variantRuleSummary } from "./board-summary";
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
                {variantRuleSummary(b, group, locale) || b.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {group.length > 1 && <p className="muted">{variantRuleSummary(board, group, locale)}</p>}
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
  const board = asObject(raw.board),
    roster = Array.isArray(board.roleSetups) ? board.roleSetups.map(asObject) : [];
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
      <BoardRuleFields raw={raw} change={change} t={t} locale={locale} />
    </div>
  );
}
