/**
 * 负责只读 ANSI 终端的挂载、分页补读及断线续读；输入会话 ID，输出 xterm 画面。
 * 游标只在实际写入后推进，卸载取消请求并释放终端；不将键盘输入发送给游戏进程。
 */
import { useEffect, useRef, useState } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { ConsoleChunk } from "@ai-werewolf-arena/workbench-contract";
import { api } from "./api";
import type { Translator } from "./types";
import "@xterm/xterm/css/xterm.css";
export function TerminalPanel({
  sessionId,
  t,
  theme,
  fontFamily,
}: {
  sessionId: string;
  t: Translator;
  theme: ITheme;
  fontFamily: string;
}) {
  const instance = useRef<Terminal | null>(null);
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let cursor = 0,
      closed = false,
      timer: ReturnType<typeof setTimeout>;
    const terminal = new Terminal({
        disableStdin: true,
        convertEol: true,
        scrollback: 15000,
        fontSize: 13,
        fontFamily,
        theme,
      }),
      fit = new FitAddon();
    terminal.loadAddon(fit);
    instance.current = terminal;
    terminal.open(host.current!);
    fit.fit();
    const resize = new ResizeObserver(() => fit.fit());
    resize.observe(host.current!);
    const poll = async () => {
      let delay = 1000;
      try {
        const result = await api<{ chunks: ConsoleChunk[]; cursor: number }>(
          `runs/${encodeURIComponent(sessionId)}/logs?after=${cursor}`,
          { signal: controller.signal },
        );
        if (closed) return;
        for (const chunk of result.chunks)
          if (chunk.seq > cursor) {
            await new Promise<void>((resolve) => terminal.write(chunk.text, resolve));
            cursor = chunk.seq;
          }
        setError("");
        if (result.chunks.length >= 400) delay = 0;
      } catch (e) {
        if (!closed) setError(t("lost"));
        delay = 2000;
      }
      if (!closed) timer = setTimeout(() => void poll(), delay);
    };
    void poll();
    return () => {
      closed = true;
      controller.abort();
      clearTimeout(timer);
      resize.disconnect();
      terminal.dispose();
      instance.current = null;
    };
  }, [sessionId, t, fontFamily]);
  useEffect(() => {
    if (instance.current && theme) instance.current.options.theme = theme;
  }, [theme]);
  return (
    <section className="terminal-shell">
      <div className="terminal-bar">
        <span className="terminal-dots">● ● ●</span>
        <span>{t("logs")}</span>
        <code>{sessionId}</code>
      </div>
      <div ref={host} className="terminal" role="log" aria-label={t("logs")} />
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
