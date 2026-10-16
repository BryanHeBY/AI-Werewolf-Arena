/**
 * 负责浏览器私有 Agent 档案的显式导入、显示开关和逐轮详情。输入为用户选择的文件与语言，输出为已转义的 JSX 文本。
 * 分类与终端共用，私有状态独立于游戏事件、席位投影和 Remotion 帧；取消选择或更换回放会撤回迟到读取的展示权。
 * 不上传文件、不发现其它玩家档案，不通过页面状态改变游戏知识或归档事实。
 */
import { useEffect, useRef, useState } from "react";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import {
  agentOutputPresentation,
  isAgentOutputVisible,
  type AgentOutputDisplayOptions,
} from "@ai-werewolf-arena/game-presentation";
import type { CanonicalReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { parsePlayerAgentArchive, playerAgentOutputTurns } from "./agent-output-loader";
import { phaseName } from "./replay-localization";

export function PlayerAgentOutputView({
  view,
  locale,
  display,
}: {
  view: CanonicalReplayPlayerView;
  locale: Locale;
  display: AgentOutputDisplayOptions;
}) {
  const turns = playerAgentOutputTurns(view)
    .map((turn) => ({
      ...turn,
      outputs: turn.outputs.filter((output) => isAgentOutputVisible(output, display)),
    }))
    .filter((turn) => turn.outputs.length);
  return (
    <div className="agent-output-turns">
      <h3>{text(locale, "replay.player", { id: view.player_id })}</h3>
      {turns.length === 0 && <p>{text(locale, "replay.agent_empty")}</p>}
      {turns.map((turn) => (
        <details key={turn.seq}>
          <summary>
            {text(locale, "replay.day_phase", {
              day: turn.day,
              phase: phaseName(turn.phase, locale),
            })}{" "}
            · {turn.requestId}
          </summary>
          {turn.outputs.map((output, index) => {
            const item = agentOutputPresentation(output, locale);
            return (
              <div key={index} className={`agent-output-item agent-output-${item.tone}`}>
                <strong>{item.label}</strong>
                <pre>{item.body}</pre>
                {output.type === "tool" && output.args !== undefined && (
                  <pre>{JSON.stringify(output.args, null, 2)}</pre>
                )}
                {output.type === "tool" && output.result !== undefined && (
                  <pre>
                    {typeof output.result === "string"
                      ? output.result
                      : JSON.stringify(output.result, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </details>
      ))}
    </div>
  );
}

export function PlayerAgentOutput({ locale }: { locale: Locale }) {
  const [view, setView] = useState<CanonicalReplayPlayerView | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [display, setDisplay] = useState({ printThinking: true, printLlmIo: false, trace: false });
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function load(file: File) {
    const current = ++generation.current;
    setView(null);
    setStatus("loading");
    try {
      const archive = parsePlayerAgentArchive(await file.text());
      if (current === generation.current) {
        setView(archive);
        setStatus("idle");
      }
    } catch {
      if (current === generation.current) setStatus("error");
    }
  }
  return (
    <section className="panel agent-output-panel">
      <h2>{text(locale, "replay.agent_output")}</h2>
      <p>{text(locale, "replay.agent_private")}</p>
      <div className="agent-output-controls">
        <label>
          {text(locale, "replay.agent_import")}{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void load(file);
            }}
          />
        </label>
        <button
          onClick={() => {
            generation.current++;
            setView(null);
            setStatus("idle");
          }}
        >
          {text(locale, "replay.agent_clear")}
        </button>
        <label>
          <input
            type="checkbox"
            checked={display.printThinking}
            onChange={(event) => setDisplay({ ...display, printThinking: event.target.checked })}
          />
          {text(locale, "replay.agent_thinking")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={display.printLlmIo}
            onChange={(event) => setDisplay({ ...display, printLlmIo: event.target.checked })}
          />
          {text(locale, "replay.agent_io")}
        </label>
      </div>
      {status === "loading" && <p>{text(locale, "replay.loading")}</p>}
      {status === "error" && <p role="alert">{text(locale, "replay.agent_invalid")}</p>}
      {view && <PlayerAgentOutputView view={view} locale={locale} display={display} />}
    </section>
  );
}
