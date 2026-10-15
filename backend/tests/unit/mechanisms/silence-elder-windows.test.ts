/**
 * 负责禁言夜窗和表达窗的真实网关集成测试；输入为原十二人 World、实际工厂与手写 Provider。
 * 按独立字面预期断言租约 true／false、期限撤权、角色无关表达权限和已发表手势的失败前缀。
 * 测试不调用外部模型，也不以生产事件投影生成预期事实。
 */
import { expect, test } from "bun:test";
import {
  Role,
  Phase,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { silenceElderTwelveConfig } from "../../../src/rulesets/presets/silence-elder-twelve";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import {
  deferRequestDelivery,
  deriveBoundedRequest,
  assertRequestDelivery,
} from "../../../src/domain/request-delivery";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import type { TrustedNightStageRuntime } from "../../../src/engine/night/trusted-runtime";
import { SILENCE_ELDER_NIGHT_STAGE } from "../../../src/features/silence-elder/night-stage";
import { projectSilenceElderState } from "../../../src/features/silence-elder/state";
import {
  openSilenceNight,
  commitSilenceChoice,
} from "../../../src/features/silence-elder/authority";
import { announceSilenceDay } from "../../../src/rulesets/silence-expression-plan";
import { openSilenceSpeech } from "../../../src/features/silence-elder/expression-window";

function fixture() {
  const config = structuredClone(silenceElderTwelveConfig);
  const f = bootstrapGame(config);
  const actor = f.world.getEntityIdsByRole(Role.SilenceElder)[0]!;
  const [target, translator] = f.world.getEntityIdsByRole(Role.Villager);
  const events: GameEvent[] = [];
  const requests = new GameActionRequestFactory(f.world, events, 1);
  const gateway = new ToolGateway();
  return {
    ...f,
    config,
    actor,
    target: target!,
    translator: translator!,
    events,
    requests,
    gateway,
  };
}
function night(
  f: ReturnType<typeof fixture>,
  decide: (r: ActionRequest) => Promise<ToolCall | null>,
) {
  return SILENCE_ELDER_NIGHT_STAGE.execute({
    world: f.world,
    events: f.events,
    currentDay: () => 1,
    isCurrent: () => true,
    getAliveByRole: (role) =>
      f.world
        .getEntityIdsByRole(role)
        .filter((id) => f.world.getComponent(id, COMPONENT.Alive)?.alive),
    actionProvider: { getAction: decide },
    toolGateway: f.gateway,
    makeRequest: (actorId, allowedTools, context) => {
      const { stage, requiresAction = true, ...extra } = context;
      return f.requests.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage,
        requiresAction,
        summary: { key: "request.summary.silence_elder" },
        context: extra,
      });
    },
  } as TrustedNightStageRuntime);
}
function expression(
  f: ReturnType<typeof fixture>,
  decide: (r: ActionRequest) => Promise<ToolCall | null>,
  translator = f.translator,
) {
  openSilenceNight(f.world, f.actor, 1);
  commitSilenceChoice(f.world, f.actor, 1, f.target, translator, () => true);
  announceSilenceDay(f.config, f.world, f.events, 1);
  return openSilenceSpeech(
    {
      world: f.world,
      events: f.events,
      requests: f.requests,
      provider: { getAction: decide },
      gateway: f.gateway,
      day: 1,
      phase: Phase.Day,
      isCurrent: () => true,
    },
    f.target,
    "day",
  )!;
}

for (const mode of ["missing", "expired", "context", "target", "translator"] as const)
  test(`真实夜请求${mode}关闭false且零付款`, async () => {
    const f = fixture(),
      outcomes: boolean[] = [];
    await expect(
      night(f, async (r) => {
        deferRequestDelivery(r, (ok) => outcomes.push(ok));
        if (mode === "expired") r.deadlineAtMs = Date.now() - 1;
        if (mode === "context") r.context.stage = "day_speech";
        if (mode === "target" || mode === "translator")
          f.world.addComponent(
            mode === "target" ? f.target : f.translator,
            COMPONENT.Alive,
            createAliveComponent(),
          );
        return mode === "missing"
          ? null
          : { name: "silence", args: { target_id: f.target, translator_id: f.translator } };
      }),
    ).rejects.toThrow();
    expect(outcomes).toEqual([false]);
    expect(
      projectSilenceElderState(f.world.getComponent(f.actor, COMPONENT.Role))!.history,
    ).toEqual([]);
    expect(f.events).toEqual([]);
  });

test("合法期限别名共用真实完成；通知晚错保已付历史且不被关闭异常覆盖", async () => {
  const f = fixture(),
    outcomes: boolean[] = [];
  const sentinel = new Error("paid_observer_error");
  await expect(
    night(f, async (r) => {
      const alias = deriveBoundedRequest(r, Date.now() + 30000);
      assertRequestDelivery(alias);
      deferRequestDelivery(alias, (ok) => {
        outcomes.push(ok);
        throw sentinel;
      });
      return { name: "silence", args: { target_id: f.target, translator_id: null } };
    }),
  ).rejects.toThrow(sentinel);
  expect(outcomes).toEqual([true]);
  expect(projectSilenceElderState(f.world.getComponent(f.actor, COMPONENT.Role))!.history).toEqual([
    { day: 1, targetId: f.target, translatorId: null },
  ]);
  expect(f.events).toEqual([]);
});

for (const text of [null, '译者自己的解释：\nExact {actor} "保留原文"'] as const)
  test(`非长老原译者独立请求，${text === null ? "明确拒译" : "公开译文"}不制造普通发言`, async () => {
    const f = fixture(),
      outcomes: Array<[string, boolean]> = [],
      seen: ActionRequest[] = [];
    const raw = ' （双手指向3号）\nExact {actor} "动作" ';
    await expression(f, async (r) => {
      seen.push(r);
      deferRequestDelivery(r, (ok) => outcomes.push([r.context.stage, ok]));
      return r.allowedTools.includes("gesture")
        ? { name: "gesture", args: { description: raw } }
        : { name: "translate_silence", args: { text } };
    });
    expect(seen.map((r) => [r.actorId, r.allowedTools])).toEqual([
      [f.target, ["gesture"]],
      [f.translator, ["translate_silence"]],
    ]);
    expect(seen[1]!.context.silence_gesture_description).toBe(raw);
    expect(outcomes).toEqual([
      ["silence_gesture", true],
      ["silence_translation", true],
    ]);
    expect(f.events.map((e) => e.type)).toEqual([
      "silence_announced",
      "silence_gesture",
      text === null ? "silence_translation_declined" : "silence_translated",
    ]);
    expect(f.events[1]!.payload).toMatchObject({ actorId: f.target, description: raw });
    const last = f.events[2]!;
    if (last.type === "silence_translation_declined") expect(last.audience).toEqual([f.translator]);
    expect(f.events.some((e) => e.type === "day_speech")).toBe(false);
  });

for (const mode of ["missing", "expired", "replacement", "sentinel"] as const)
  test(`译者${mode}失败保已发表手势，不伪造拒译`, async () => {
    const f = fixture(),
      outcomes: Array<[string, boolean]> = [];
    const sentinel = new Error("translation_original_error");
    const promise = expression(f, async (r) => {
      deferRequestDelivery(r, (ok) => outcomes.push([r.context.stage, ok]));
      if (r.allowedTools.includes("gesture"))
        return { name: "gesture", args: { description: "（指向3号）" } };
      if (mode === "sentinel") throw sentinel;
      if (mode === "expired") r.deadlineAtMs = Date.now() - 1;
      if (mode === "replacement")
        f.world.addComponent(f.translator, COMPONENT.Alive, createAliveComponent());
      return mode === "missing" ? null : { name: "translate_silence", args: { text: "过期译文" } };
    });
    if (mode === "sentinel") await expect(promise).rejects.toThrow(sentinel);
    else await expect(promise).rejects.toThrow();
    expect(outcomes).toEqual([
      ["silence_gesture", true],
      ["silence_translation", false],
    ]);
    expect(f.events.map((e) => e.type)).toEqual(["silence_announced", "silence_gesture"]);
  });

test("手势等待期间译者死亡，不再询问或伪造拒译；目标不能借speak绕过专用请求", async () => {
  const f = fixture();
  let calls = 0;
  await expression(f, async () => {
    calls++;
    f.world.getComponent(f.translator, COMPONENT.Alive)!.alive = false;
    return { name: "gesture", args: { description: "（摇头）" } };
  });
  expect(calls).toBe(1);
  expect(f.events.map((e) => e.type)).toEqual(["silence_announced", "silence_gesture"]);
  const other = fixture();
  await expect(
    expression(other, async () => ({ name: "speak", args: { text: "绕过禁言" } })),
  ).rejects.toThrow("silence_gesture_missing");
  expect(other.events.map((e) => e.type)).toEqual(["silence_announced"]);
});

for (const kind of ["gesture", "translation"] as const)
  for (const revoke of ["deadline", "life"] as const)
    test(`${kind}候选字段getter晚${revoke}撤权，首表达写前拒绝`, async () => {
      const f = fixture(),
        outcomes: Array<[string, boolean]> = [];
      let active: ActionRequest;
      const validate = f.gateway.validateAndSanitize.bind(f.gateway);
      f.gateway.validateAndSanitize = ((world, actorId, action, context) => {
        const result = validate(world, actorId, action, context);
        if (!result.ok || action.name !== (kind === "gesture" ? "gesture" : "translate_silence"))
          return result;
        const field = kind === "gesture" ? "description" : "text";
        const args = Object.defineProperty({}, field, {
          enumerable: true,
          get() {
            if (revoke === "deadline") active.deadlineAtMs = Date.now() - 1;
            else f.world.addComponent(actorId, COMPONENT.Alive, createAliveComponent());
            return "合法但已撤权的候选内容";
          },
        });
        return { ok: true, sanitizedCall: { name: action.name, args } };
      }) as ToolGateway["validateAndSanitize"];
      await expect(
        expression(f, async (r) => {
          active = r;
          deferRequestDelivery(r, (ok) => outcomes.push([r.context.stage, ok]));
          return r.allowedTools.includes("gesture")
            ? { name: "gesture", args: { description: "（摇头）" } }
            : { name: "translate_silence", args: { text: "正常译文" } };
        }),
      ).rejects.toThrow(
        kind === "gesture"
          ? "silence_gesture_request_revoked"
          : "silence_translation_request_revoked",
      );
      expect(outcomes).toEqual(
        kind === "gesture"
          ? [["silence_gesture", false]]
          : [
              ["silence_gesture", true],
              ["silence_translation", false],
            ],
      );
      expect(f.events.map((e) => e.type)).toEqual(
        kind === "gesture" ? ["silence_announced"] : ["silence_announced", "silence_gesture"],
      );
    });

test("事实sink失败关闭false，已append前缀保留；完成true通知晚错不再补false", async () => {
  for (const mode of ["before_append", "after_append", "true_notification"] as const) {
    const f = fixture(),
      outcomes: boolean[] = [];
    const sentinel = new Error(mode);
    await expect(
      expression(f, async (r) => {
        deferRequestDelivery(r, (ok) => {
          outcomes.push(ok);
          if (mode === "true_notification") throw sentinel;
        });
        if (mode !== "true_notification")
          Object.defineProperty(f.events, "push", {
            value(...events: GameEvent[]) {
              if (mode === "after_append") Array.prototype.push.apply(f.events, events);
              throw sentinel;
            },
          });
        return { name: "gesture", args: { description: "（点头）" } };
      }),
    ).rejects.toThrow(sentinel);
    expect(outcomes).toEqual([mode === "true_notification"]);
    expect(f.events.map((e) => e.type)).toEqual(
      mode === "before_append" ? ["silence_announced"] : ["silence_announced", "silence_gesture"],
    );
    expect(() =>
      openSilenceSpeech(
        {
          world: f.world,
          events: f.events,
          requests: f.requests,
          provider: { getAction: async () => null },
          gateway: f.gateway,
          day: 1,
          phase: Phase.Day,
          isCurrent: () => true,
        },
        f.target,
        "day",
      ),
    ).toThrow("silence_expression_already_opened");
  }
});
