/** 负责工作台真实 CLI 的混合传输集成测试；输入为已保存配置及手写本机行动，独立预期核对两夜自然终局、胜者、三种 Agent 来源与完整发布。不调用外部服务或依赖期限结束。 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readReplayDocument, unwrapRecordingEnvelope } from "@ai-werewolf-arena/replay-contract";
import { offlineWorkspace, eventually } from "../support/offline-workspace";
import { installNaturalGame } from "../support/natural-game";
test("saved mixed LLM/Pi/ACP game ends naturally and publishes a replay with no fallback", async () => {
  const workspace = await offlineWorkspace(),
    natural = await installNaturalGame(workspace);
  try {
    const document = await workspace.application.documents.read("games", "natural_mixed");
    const id = await workspace.application.runs.start("natural_mixed", document.revision!);
    const run = await eventually(
      async () => (await workspace.application.sessions.list()).find((row) => row.sessionId === id),
      (row) => !!row && ["completed", "failed", "cancelled"].includes(row.state),
      45000,
    );
    expect(natural.failures).toEqual([]);
    expect(run).toMatchObject({
      state: "completed",
      game: "decided",
      recording: "complete",
      winner: "good",
      canReplay: true,
    });
    const directory = path.join(workspace.records, id),
      reproduction = unwrapRecordingEnvelope(
        JSON.parse(await fs.readFile(path.join(directory, "reproduction.json"), "utf8")),
        "strict_reproduction",
      ).payload as {
        metadata: { players: { agent: { kind: string } }[] };
        decisions: { outcome: { kind: string } }[];
      },
      replay = readReplayDocument(
        JSON.parse(await fs.readFile(path.join(directory, "replay.json"), "utf8")),
      );
    expect(replay.result.decision).toMatchObject({
      winner: "good",
      reason: "all_wolves_eliminated",
    });
    expect(
      reproduction.metadata.players.map((player: { agent: { kind: string } }) => player.agent.kind),
    ).toEqual(["llm", "pi", "acp", "llm", "pi", "acp"]);
    expect(
      reproduction.decisions.filter(
        (decision: { outcome: { kind: string } }) => decision.outcome.kind !== "action",
      ),
    ).toEqual([]);
    expect(
      replay.events
        .filter((event: { type: string }) => event.type === "night_resolved")
        .map((event) => event.payload.deaths),
    ).toEqual([[3], [5]]);
    const log = await fs.readFile(path.join(directory, "console.jsonl"), "utf8");
    expect(log).not.toContain("FALLBACK");
    expect(log).not.toContain("deadline_skip");
  } finally {
    await natural.close();
    await workspace.close();
  }
}, 60000);
