/**
 * 负责按会话加载回放；输入 session ID、语言与共用主题控制器，输出原视频前端的播放器。
 * 页面仅拥有当前加载结果，切换会话取消旧请求，不复制投影、主题状态或运行进程。
 */
import { lazy, Suspense, useEffect, useState } from "react";
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { WebAppearanceController, ThemeTone } from "@ai-werewolf-arena/game-media/appearance";
import { readReplayDocument, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { api } from "../api";
import type { Translator } from "../types";
const Replay = lazy(() =>
  import("@ai-werewolf-arena/game-media/replay").then((module) => ({
    default: module.WorkbenchReplay,
  })),
);
export function ReplayPage({
  sessionId,
  t,
  locale,
  appearance,
  tone,
}: {
  sessionId: string;
  t: Translator;
  locale: Locale;
  appearance: WebAppearanceController;
  tone: ThemeTone;
}) {
  const [document, setDocument] = useState<ReplayDocument | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setDocument(null);
    setError("");
    void api<unknown>(`runs/${encodeURIComponent(sessionId)}/replay`, { signal: controller.signal })
      .then((raw) => {
        if (!controller.signal.aborted) setDocument(readReplayDocument(raw));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [sessionId]);
  return error ? (
    <p className="notice error" role="alert">
      {t("noReplay")}
      <code>{error}</code>
    </p>
  ) : document ? (
    <Suspense fallback={<p>…</p>}>
      <Replay
        key={sessionId}
        replay={document}
        locale={locale}
        appearance={appearance}
        tone={tone}
      />
    </Suspense>
  ) : (
    <p role="status">…</p>
  );
}
