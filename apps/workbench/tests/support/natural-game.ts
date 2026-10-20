/** 负责集成／浏览器测试的三后端本机脚本；输入为隔离工作区与手写六人两夜行动，输出真实 LLM、Pi、ACP 传输和自然终局样本。不调用外部服务，预期胜者由测试独立断言，不通过期限或回退制造终局。 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { offlineWorkspace } from "./offline-workspace";
interface Action {
  name: string;
  args: Record<string, unknown>;
}
interface Turn {
  day: number;
  stage: string;
  action: Action;
}
function plan() {
  const turns = new Map<number, Turn[]>(Array.from({ length: 6 }, (_, i) => [i + 1, []]));
  const add = (
    day: number,
    actors: number[],
    stage: string,
    name: string,
    args: Record<string, unknown>,
  ) => {
    for (const actor of actors) turns.get(actor)!.push({ day, stage, action: { name, args } });
  };
  for (const [day, wolves, target] of [
    [1, [1, 4], 3],
    [2, [4], 5],
  ] as const) {
    add(day, [...wolves], "wolf_discussion", "speak_to_wolves", {
      text: "End discussion",
      end_chat: true,
    });
    add(day, [...wolves], "wolf_vote", "kill_vote", { target_id: target, abstain: false });
  }
  add(1, [5], "guard", "guard", { target_id: 6, abstain: false });
  add(2, [5], "guard", "guard", { target_id: null, abstain: true });
  add(1, [2], "seer", "check_identity", { target_id: 1 });
  add(2, [2], "seer", "check_identity", { target_id: 4 });
  add(1, [3], "last_words", "speak", { text: "Last words 3" });
  for (const [day, actors, target] of [
    [1, [1, 2, 4, 5, 6], 1],
    [2, [2, 4, 6], 4],
  ] as const) {
    for (const actor of actors)
      add(day, [actor], "day_speech", "speak", { text: `Day ${day}, seat ${actor}` });
    add(day, [...actors], "voting", "vote", { target_id: target, abstain: false });
    add(day, [target], "last_words", "speak", { text: `Last words ${target}` });
  }
  // 同一玩家的回合按真实阶段顺序排列，不能按全局append顺序将第二夜排在第一天之前。
  const stageOrder = [
    "wolf_discussion",
    "wolf_vote",
    "guard",
    "seer",
    "last_words",
    "day_speech",
    "voting",
  ];
  for (const [actor, rows] of turns)
    rows.sort(
      (a, b) =>
        a.day - b.day ||
        (a.stage === "last_words" && actor !== 3 ? 10 : stageOrder.indexOf(a.stage)) -
          (b.stage === "last_words" && actor !== 3 ? 10 : stageOrder.indexOf(b.stage)),
    );
  return turns;
}
function response(actor: number, ordinal: number, args: unknown, stream: boolean) {
  const call = {
    id: `natural-${actor}-${ordinal}`,
    type: "function",
    function: { name: "submit_action", arguments: JSON.stringify(args) },
  };
  if (!stream)
    return Response.json({
      id: call.id,
      object: "chat.completion",
      created: 0,
      model: `seat-${actor}`,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: null, tool_calls: [call] },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  const chunks = [
    { reasoning_content: `Natural thought ${actor}` },
    { tool_calls: [{ index: 0, ...call }] },
  ].map((delta) => ({
    id: call.id,
    object: "chat.completion.chunk",
    created: 0,
    model: `seat-${actor}`,
    choices: [{ index: 0, delta, finish_reason: null }],
  }));
  return new Response(
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") +
      `data: ${JSON.stringify({ id: call.id, object: "chat.completion.chunk", created: 0, model: `seat-${actor}`, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
}
export async function installNaturalGame(workspace: Awaited<ReturnType<typeof offlineWorkspace>>) {
  const turns = plan(),
    failures: string[] = [],
    counts = new Map<number, number>();
  const model = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      try {
        const body = (await request.json()) as {
          model: string;
          stream?: boolean;
          messages: { role: string; content: unknown }[];
        };
        const actor = Number(body.model.replace("seat-", ""));
        const prompt = [...body.messages].reverse().find((message) => message.role === "user");
        const text =
          typeof prompt?.content === "string" ? prompt.content : JSON.stringify(prompt?.content);
        const turnId = /turn_id (?:必须为|must be) ([pt]\d+)/.exec(text)?.[1];
        if (!turnId) throw new Error("natural_turn_missing");
        if (/^[pt]1$/.test(turnId)) counts.set(actor, 0);
        const ordinal = (counts.get(actor) ?? 0) + 1,
          turn = turns.get(actor)?.[ordinal - 1];
        if (!turn) throw new Error(`natural_extra_turn:${actor}:${ordinal}`);
        counts.set(actor, ordinal);
        return response(
          actor,
          ordinal,
          { turn_id: turnId, action: turn.action.name, arguments: turn.action.args },
          body.stream === true,
        );
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "natural_fixture_failed");
        return Response.json({ error: { message: failures.at(-1) } }, { status: 400 });
      }
    },
  });
  const backendsPath = path.join(workspace.configs, "runtime/backends.json"),
    agentsPath = path.join(workspace.configs, "runtime/agents.json"),
    backends = JSON.parse(await fs.readFile(backendsPath, "utf8")),
    agents = JSON.parse(await fs.readFile(agentsPath, "utf8"));
  backends.items.natural_llm = {
    kind: "llm",
    config: { type: "openai", apiKey: "synthetic", baseURL: `${model.url.origin}/v1` },
  };
  backends.items.natural_pi = {
    kind: "pi",
    config: {
      models: {
        providers: {
          "awa-natural": {
            baseUrl: `${model.url.origin}/v1`,
            api: "openai-completions",
            authHeader: true,
            models: [2, 5].map((actor) => ({
              id: `seat-${actor}`,
              reasoning: true,
              compat: { supportsReasoningEffort: false },
            })),
          },
        },
      },
      auth: { "awa-natural": { type: "api_key", key: "synthetic" } },
    },
  };
  backends.items.natural_acp = {
    kind: "acp",
    config: {
      transport: "stdio",
      command: process.execPath,
      args: [
        path.join(workspace.repository, "packages/game-runtime/tests/fixtures/acp/game-agent.ts"),
      ],
      env: {},
      initializeTimeoutMs: 10000,
    },
  };
  const roles = ["wolf", "seer", "villager", "wolf", "guard", "villager"];
  for (const actor of [1, 2, 3, 4, 5, 6]) {
    const kind = actor === 1 || actor === 4 ? "llm" : actor === 2 || actor === 5 ? "pi" : "acp";
    const script = path.join(workspace.root, `natural-plan-${actor}.json`);
    if (kind === "acp")
      await fs.writeFile(
        script,
        JSON.stringify({
          actorId: actor,
          role: roles[actor - 1],
          locale: "zh-CN",
          turns: turns.get(actor),
        }),
      );
    agents.items[`natural_${actor}`] = {
      backend: `natural_${kind}`,
      options:
        kind === "llm"
          ? { model: `seat-${actor}`, maxTokens: 128 }
          : kind === "pi"
            ? {
                defaultProvider: "awa-natural",
                defaultModel: `seat-${actor}`,
                defaultThinkingLevel: "low",
                compaction: { enabled: false },
                retry: { enabled: false, provider: { maxRetries: 0 } },
              }
            : { spawnArgs: [script], sessionReuse: "per_player", actionTransport: "mcp" },
    };
  }
  await fs.writeFile(backendsPath, JSON.stringify(backends));
  await fs.writeFile(agentsPath, JSON.stringify(agents));
  await fs.writeFile(
    path.join(workspace.configs, "games/natural_mixed.json"),
    JSON.stringify({
      board: "six_player_mvp",
      agent: "natural_1",
      players: Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((actor) => [String(actor), { agent: `natural_${actor}` }]),
      ),
      seed: "foundation-six:116",
      maxDays: 4,
      maxRuntimeMs: 60000,
      llmTimeoutMs: 10000,
      streamEvents: true,
      printThinking: true,
    }),
  );
  return { failures, counts, close: () => model.stop(true) };
}
