/**
 * 场景测试验证 badge-death-handoff-and-revocation 的原请求、已付行动与失败记录链。输入保留原固定角色、动作脚本、故障与归档矩阵；原字面结果及检查点作为预期。显式特权回退仅服务该控制驱动，不将生产对局输出称作独立玩法 oracle。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../../src/ai/agents/acp/acp_action_provider";
import { NoActionToolLoopClient, ToolLoopClient } from "../../../support/drivers/agents/llm-clients";
import { expect, test, spyOn } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  DeathCause,
  Phase,
  Role,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type RuntimeSnapshot,
  type ToolCall,
} from "../../../../src/core";
import type { BadgeComponent } from "../../../../src/core/domain/components/badge";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
import type { VotingRightComponent } from "../../../../src/core/domain/components/voting_right";

import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { ActionTurn } from "../../../../src/ai/agents/player/action-turn";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { getDefaultConfigRenderRegistry } from "../../../../src/game/mechanisms";

function fixture(locale: "zh-CN" | "en" = "en", choice = true, idiot = false) {
  const roles = [
    Role.Wolf,
    idiot ? Role.Idiot : Role.Seer,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
  ];
  const config: BoardConfig = {
    boardSize: 6,
    enableSheriff: true,
    initialSheriffSeat: 2,
    sheriff: {
      voteWeight: 2.25,
      badgePolicy: choice ? "awa_holder_choice_v1" : "awa_next_seat_v1",
    },
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
  };
  const { world } = bootstrapGame(config, { locale, fixedRoles: roles });
  const events: GameEvent[] = [];
  const state: RuntimeSnapshot = { day: 2, phase: Phase.Voting, gameOver: false, result: null };
  const gateway = new ToolGateway();
  const registry = new EventRegistry();
  const resolution = new DeathResolution(world, events, gateway, registry, state);
  const requests: ActionRequest[] = [];
  async function resolve(
    callback: (r: ActionRequest) => ToolCall | null = () => ({
      name: "choose_badge_successor",
      args: { target_id: 5 },
    }),
  ) {
    await resolution.resolve(
      [2],
      { 2: [DeathCause.Exile] },
      {
        async getAction(r) {
          if (r.context.stage !== "sheriff_badge_choice") return null;
          requests.push(r);
          return callback(r);
        },
      },
      Phase.Voting,
      Phase.Voting,
    );
  }
  return { world, events, state, gateway, registry, resolution, resolve, config, requests };
}

function badge(f: ReturnType<typeof fixture>, id: number) {
  return f.world.getComponent(id, COMPONENT.Badge)!;
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual death holder chooses a successor and retains badge weight`, async () => {
    const f = fixture(locale);
    await f.resolve((r) => {
      expect(r.context.stage).toBe("sheriff_badge_choice");
      expect(r.context.badge_candidates).toEqual([1, 3, 4, 5, 6]);
      const turn = new ActionTurn(new ActionReception(f.world), r, "badge-turn");
      const before = JSON.stringify({ from: badge(f, 2), to: badge(f, 5) });
      expect(turn.submit("badge-turn", "choose_badge_successor", { target_id: "5" })).toMatchObject(
        { ok: true, applied: false },
      );
      expect(JSON.stringify({ from: badge(f, 2), to: badge(f, 5) })).toBe(before);
      return turn.action;
    });
    expect(f.requests).toHaveLength(1);
    expect(badge(f, 2)).toMatchObject({ isSheriff: false, destroyed: true });
    expect(badge(f, 5)).toMatchObject({
      isSheriff: true,
      destroyed: false,
      voteWeight: 2.25,
      handoffPolicy: "awa_holder_choice_v1",
    });
    expect(f.world.getComponent(5, COMPONENT.VotingRight)?.weight).toBe(2.25);
    expect(
      f.events.filter((e) => e.type === "sheriff_badge_transferred").map((e) => e.payload),
    ).toEqual([{ fromId: 2, toId: 5, reason: "voted_out" }]);
    expect(f.world.activeDeathActionCount).toBe(0);
    expect(
      new ActionReception(f.world).validate(f.requests[0]!, "choose_badge_successor", {
        target_id: 5,
      }).ok,
    ).toBe(false);
    expect(getDefaultConfigRenderRegistry().renderBoardConfigPrompt(f.config, locale)).toContain(
      locale === "en" ? "deceased holder" : "死亡持有者",
    );
  });

for (const [name, action] of [
  ["explicit destroy", { name: "choose_badge_successor", args: { target_id: null } }],
  ["no action", null],
  ["self", { name: "choose_badge_successor", args: { target_id: 2 } }],
  ["unknown", { name: "choose_badge_successor", args: { target_id: 99 } }],
  ["fractional", { name: "choose_badge_successor", args: { target_id: 1.5 } }],
  ["wrong tool", { name: "speak", args: { text: "ignored" } }],
] as const)
  test(`badge ${name} destroys once instead of inventing next seat`, async () => {
    const f = fixture();
    await f.resolve(() => action);
    expect(f.events.filter((e) => e.type === "sheriff_badge_destroyed")).toHaveLength(1);
    expect(f.events.some((e) => e.type === "sheriff_badge_transferred")).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
    await f.resolve(() => action);
    expect(f.requests).toHaveLength(1);
  });

test("default retains automatic first eligible seat with no choice request", async () => {
  const f = fixture("en", false);
  await f.resolve(() => {
    throw new Error("unexpected choice");
  });
  expect(f.requests).toHaveLength(0);
  expect(badge(f, 1).isSheriff).toBe(true);
  expect(badge(f, 1).voteWeight).toBe(2.25);
});

test("no eligible successor destroys without opening any dead action", async () => {
  const f = fixture();
  for (const id of [1, 3, 4, 5, 6])
    f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  await f.resolve(() => {
    throw new Error("unexpected choice");
  });
  expect(f.requests).toHaveLength(0);
  expect(badge(f, 2).destroyed).toBe(true);
  expect(f.world.activeDeathActionCount).toBe(0);
});

for (const change of [
  "phase",
  "day",
  "gameover",
  "revive",
  "new-life",
  "new-badge",
  "policy",
  "weight",
] as const)
  test(`badge stale ${change} reply commits no transfer or destruction`, async () => {
    const f = fixture();
    await f.resolve(() => {
      if (change === "phase") f.state.phase = Phase.Night;
      if (change === "day") f.state.day++;
      if (change === "gameover") f.state.gameOver = true;
      if (change === "revive")
        f.world.getComponent(2, COMPONENT.Alive)!.alive = true;
      if (change === "new-life")
        f.world.addComponent(2, COMPONENT.Alive, createAliveComponent(false));
      if (change === "new-badge") f.world.addComponent(2, COMPONENT.Badge, { ...badge(f, 2) });
      if (change === "policy") badge(f, 2).handoffPolicy = "awa_next_seat_v1";
      if (change === "weight") badge(f, 2).voteWeight = 3;
      return { name: "choose_badge_successor", args: { target_id: 5 } };
    });
    expect(
      f.events.some(
        (e) => e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed",
      ),
    ).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  });

for (const change of ["death", "revival", "voting", "destroyed"] as const)
  test(`badge ${change} successor cannot receive the original pending choice`, async () => {
    const f = fixture();
    await f.resolve(() => {
      if (change === "death" || change === "revival") {
        const life = f.world.getComponent(5, COMPONENT.Alive)!;
        life.alive = false;
        if (change === "revival") life.alive = true;
      }
      if (change === "voting")
        f.world.getComponent(5, COMPONENT.VotingRight)!.canVote = false;
      if (change === "destroyed") badge(f, 5).destroyed = true;
      return { name: "choose_badge_successor", args: { target_id: 5 } };
    });
    expect(f.events.filter((e) => e.type === "sheriff_badge_destroyed")).toHaveLength(1);
    expect(f.events.some((e) => e.type === "sheriff_badge_transferred")).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  });

test("provider exception closes the engine permit and remains an explicit failure", async () => {
  const f = fixture();
  await expect(
    f.resolve(() => {
      throw new Error("offline-failure");
    }),
  ).rejects.toThrow("offline-failure");
  // Await separately so permission cleanup is observed after the throw.
  await Promise.resolve();
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("request construction revocation prevents contacting the badge provider", async () => {
  const f = fixture();
  const create = GameActionRequestFactory.prototype.create;
  const hook = spyOn(GameActionRequestFactory.prototype, "create").mockImplementation(function (
    this: GameActionRequestFactory,
    input,
  ) {
    const request = create.call(this, input);
    if (input.stage === "sheriff_badge_choice") f.state.phase = Phase.Night;
    return request;
  });
  try {
    await f.resolve();
    expect(f.requests).toHaveLength(0);
    expect(
      f.events.some(
        (e) => e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed",
      ),
    ).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  } finally {
    hook.mockRestore();
  }
});

test("gateway revocation prevents committing even an accepted badge selection", async () => {
  const f = fixture();
  const validate = f.gateway.validateAndSanitize.bind(f.gateway);
  const hook = spyOn(f.gateway, "validateAndSanitize").mockImplementation(
    (world, actor, call, ctx) => {
      const result = validate(world, actor, call, ctx);
      if (call.name === "choose_badge_successor") f.state.day++;
      return result;
    },
  );
  try {
    await f.resolve();
    expect(
      f.events.some(
        (e) => e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed",
      ),
    ).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  } finally {
    hook.mockRestore();
  }
});

for (const locale of ["zh-CN", "en"] as const)
  for (const transport of ["llm_empty", "llm_invalid", "acp_empty", "acp_invalid"] as const)
    test(`${locale}/${transport}: declined or rejected badge reply never fabricates a fallback successor`, async () => {
      const f = fixture(locale);
      let fallbackCalls = 0;
      const fallback = {
        async getAction(): Promise<ToolCall | null> {
          fallbackCalls++;
          return { name: "choose_badge_successor", args: { target_id: 5 } };
        },
      };
      const provider = transport.startsWith("llm")
        ? new LlmActionProvider(
            f.world,
            transport === "llm_empty"
              ? new NoActionToolLoopClient()
              : new ToolLoopClient("submit_action", {
                  turn_id: "t1",
                  action: "choose_badge_successor",
                  arguments: { target_id: 99 },
                }),
            { privilegedFallbackProvider: fallback, llmTimeoutMs: 500, maxConcurrentRequests: 1 },
          )
        : new AcpActionProvider(f.world, {
            privilegedFallbackProvider: fallback,
            turnTimeoutMs: 500,
            sessionFactory: {
              async createSession(input) {
                return {
                  sessionId: "badge-no-fallback",
                  async prompt() {
                    if (transport === "acp_invalid")
                      expect(
                        input.registry.submitAction("badge-no-fallback", {
                          turn_id: "t1",
                          action: "choose_badge_successor",
                          arguments: { target_id: 99 },
                        }),
                      ).toMatchObject({ ok: false, error: "badge_choice_target" });
                  },
                  async cancel() {},
                  async close() {},
                };
              },
            },
          });
      try {
        await f.resolution.resolve(
          [2],
          { 2: [DeathCause.Exile] },
          {
            async getAction(request) {
              if (request.context.stage !== "sheriff_badge_choice") return null;
              expect(request.context.allow_fallback).toBe(false);
              return provider.getAction(request);
            },
          },
          Phase.Voting,
          Phase.Voting,
        );
        expect(fallbackCalls).toBe(0);
        expect(f.events.filter((event) => event.type === "sheriff_badge_destroyed")).toHaveLength(
          1,
        );
        expect(f.events.some((event) => event.type === "sheriff_badge_transferred")).toBe(false);
        expect(f.world.activeDeathActionCount).toBe(0);
      } finally {
        await provider.close();
      }
    });
