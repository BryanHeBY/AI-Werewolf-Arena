/**
 * 单元测试：验证共用 LLM／ACP 提示路径的玩家配置继承与覆盖。输入为 inert provider、明确席位／角色资料；捕获昵称和指令采用原字面预期，不调用模型。
 */
import { runtimeConfigV2 } from "../../support/builders/runtime-config-v2";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type RoleComponent,
  type ActionRequest,
} from "../../../src/domain";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup, resolvePlayerProfile } from "../../../src/app/config/resolve-game-setup";
import { LlmActionProvider } from "../../../src/agents/llm/llm-action-provider";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import type {
  ChatMessage,
  ChatModelClient,
  ToolLoopCallbacks,
  ToolSchema,
} from "../../../src/adapters/llm/transport";
import type { AcpSessionFactory } from "../../../src/adapters/acp/session";

for (const kind of ["llm", "acp"] as const) {
  test(`${kind}: seat and role configuration reaches actual identity and personality prompts`, async () => {
    const runtime = parseRuntimeConfig(
      runtimeConfigV2({
        providers: {
          default: "test",
          items: {
            test:
              kind === "llm"
                ? { type: "openai", apiKey: "unused" }
                : { type: "acp", command: "unused" },
          },
        },
        agents: {
          default: "main",
          items: {
            main: {
              kind,
              provider: "test",
              ...(kind === "llm" ? { model: "unused" } : {}),
              customInstructions: { mode: "replace", text: "INHERITED_STYLE" },
            },
            other: {
              kind,
              provider: "test",
              ...(kind === "llm" ? { model: "other" } : {}),
              customInstructions: { mode: "replace", text: "OTHER_STYLE" },
            },
          },
        },
        game: {
          customInstructions: { text: "GLOBAL_STYLE" },
          players: {
            "1": {
              name: "Player One",
              customInstructions: { mode: "replace", text: "SEAT_STYLE" },
            },
            "2": { customInstructions: { mode: "clear" } },
            "3": { agent: "other" },
            "4": { name: "Player Four" },
          },
          roles: {
            wolf: { agent: "main", customInstructions: { mode: "replace", text: "WOLF_STYLE" } },
          },
        },
      }),
    );
    const setup = resolveGameSetup(runtime);
    const { world } = bootstrapGame(setup.boardConfig, {
      playerNames: Object.fromEntries(
        Object.entries(setup.players).flatMap(([id, player]) =>
          player.name ? [[id, player.name]] : [],
        ),
      ),
    });
    // 座位到身份的夹具用于验证分配后的选择，不依赖洗牌。
    for (const actor of [1, 2, 3, 5])
      world.getComponent(actor, COMPONENT.Role)!.role = Role.Villager;
    world.getComponent(4, COMPONENT.Role)!.role = Role.Wolf;
    const profiles = new Map(
      world
        .entityIds()
        .map((id) => [
          id,
          resolvePlayerProfile(setup, id, world.getComponent(id, COMPONENT.Role)?.role),
        ]),
    );
    expect(profiles.get(3)?.name).toBe("other");
    const prompts = new Map<number, string>();
    const client: ChatModelClient = {
      async chat() {
        return "";
      },
      async runToolLoop<T>(
        messages: ChatMessage[],
        _tools: ToolSchema[],
        callbacks: ToolLoopCallbacks<T>,
      ) {
        const system = messages.find((message) => message.role === "system")?.content ?? "";
        const actor = Number(/编号是(\d+)号/.exec(system)?.[1]);
        prompts.set(actor, system);
        const result = await callbacks.onToolCall({
          id: "speak",
          name: "speak",
          args: { text: "hello" },
          rawArgs: '{"text":"hello"}',
        });
        return { finalAction: result.finalAction ?? null, assistantText: "" };
      },
    };
    const factory: AcpSessionFactory = {
      async createSession(input) {
        const sessionId = `actor-${input.actorId}`;
        prompts.set(input.actorId, input.initialPrompt ?? "");
        return {
          sessionId,
          async prompt(text) {
            const turnId = /当前回合 ID：(\S+)/.exec(text)?.[1];
            expect(
              input.registry.submitAction(sessionId, {
                turn_id: turnId!,
                action: "speak",
                arguments: { text: "hello" },
              }),
            ).toEqual({ ok: true, accepted: true });
          },
          async cancel() {},
          async close() {},
        };
      },
    };
    const customInstructionsResolver = (request: ActionRequest) =>
      profiles.get(request.actorId)?.customInstructions;
    const provider =
      kind === "llm"
        ? new LlmActionProvider(world, client, { customInstructionsResolver })
        : new AcpActionProvider(world, { sessionFactory: factory, customInstructionsResolver });
    try {
      for (const actorId of [1, 2, 3, 4, 5]) {
        const action = await provider.getAction({
          actorId,
          phase: Phase.Day,
          allowedTools: ["speak"],
          context: {
            day: 1,
            stage: "day_speech",
            visible_events: [],
            turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
          },
        });
        expect(action?.name).toBe("speak");
      }
      expect(prompts.get(1)).toContain("Player One");
      expect(prompts.get(1)).toContain("SEAT_STYLE");
      expect(prompts.get(1)).not.toContain("INHERITED_STYLE");
      expect(prompts.get(2)).not.toContain("INHERITED_STYLE");
      expect(prompts.get(2)).not.toContain("WOLF_STYLE");
      expect(prompts.get(3)).toContain("OTHER_STYLE");
      expect(prompts.get(3)).toContain("GLOBAL_STYLE");
      expect(prompts.get(2)).not.toContain("GLOBAL_STYLE");
      expect(prompts.get(4)).toContain("Player Four");
      expect(prompts.get(4)).toContain("WOLF_STYLE");
      expect(prompts.get(5)).toContain("INHERITED_STYLE");
      for (const system of prompts.values()) {
        expect(system).toContain("阶段规则、可用工具与回合约束是不可违反的行动边界");
        const line = system.split("\n").find((line) => line.startsWith("公开玩家名册："))!;
        const roster = JSON.parse(line.slice("公开玩家名册：".length).split("。编号与昵称对应")[0]);
        expect(roster[0]).toEqual({ id: 1, seat: 1, name: "Player One" });
        expect(roster[1]).toEqual({ id: 2, seat: 2 });
        expect(roster[3]).toEqual({ id: 4, seat: 4, name: "Player Four" });
        expect(Object.keys(roster[0]).sort()).toEqual(["id", "name", "seat"]);
        expect(line).not.toContain("STYLE");
        expect(line).toContain("工具行动必须使用玩家 ID");
      }
    } finally {
      if (provider instanceof AcpActionProvider) await provider.close();
    }
  });
}
