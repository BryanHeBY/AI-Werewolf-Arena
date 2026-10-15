/**
 * 故障场景测试：验证已送达贵族／不死之身猎杀清除在后续来源发布失败前已付款。输入为原角色行动、必需上帝操作故障及精确已送达选择；操作次序、单次发布及已付状态为字面预期，不重写 golden。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Phase,
  Camp,
  COMPONENT,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain/index";
import { nobleSecretBodyTwelveConfig } from "../../../../src/rulesets/presets/noble-secret-body-twelve";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { snapshotNobleBodyAuthority } from "../../../../src/features/noble-secret-body/authority";
const game = () => {
  const c = nobleSecretBodyTwelveConfig();
  return bootstrapGame(c, {
    fixedRoles: c.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
  });
};
type Plan = {
  body?: number | null;
  servant?: number | null;
  knife?: number | null;
  hunt?: number | null;
  potion?: { target: number; type: PotionType };
  exile?: number | null;
};
function call(r: ActionRequest, p: Plan): ToolCall | null {
  if (r.allowedTools.includes("protect_secret_body"))
    return { name: "protect_secret_body", args: { target_id: p.body ?? null } };
  if (r.allowedTools.includes("choose_servant"))
    return { name: "choose_servant", args: { target_id: p.servant ?? null } };
  if (r.allowedTools.includes("check_identity"))
    return { name: "check_identity", args: { target_id: 7 } };
  if (r.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: p.exile ?? null, abstain: p.exile == null } };
  if (r.allowedTools.includes("speak"))
    return { name: "speak", args: { text: "A literal independent test speech." } };
  if (r.allowedTools.includes("self_destruct"))
    return { name: "self_destruct", args: { confirm: false } } as unknown as ToolCall;
  return demonNightChoice(r, 3, p);
}
const nights = (g: ReturnType<typeof game>) =>
  g.phaseManager
    .getEvents()
    .filter((e) => e.type === "night_resolved")
    .map((e) => e.payload.deaths);
const live = (g: ReturnType<typeof game>, id: number) =>
  g.world.getComponent(id, COMPONENT.Alive)!.alive;
async function cycles(plans: Plan[]) {
  const g = game(),
    seen: ActionRequest[] = [];
  for (let i = 0; i < plans.length; i++)
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          seen.push(r);
          return call(r, plans[r.context.day - 1]!);
        },
      },
      10,
    );
  return { g, seen };
}

import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import { checkpointNobleBodyAuthority } from "../../../../src/features/noble-secret-body/authority";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { writeFileSync } from "node:fs";

test("actual delivered hunt clear has required God op before subsequent FINAL-source failure", async () => {
  const g = game(),
    ops: any[] = [];
  let faultApplied = false;
  const recorder = {
    recordLogicOp(op: any) {
      ops.push(structuredClone(op));
    },
    recordRequiredLogicOp(op: any) {
      ops.push(structuredClone(op));
      if (op.op === "noble_contract_closed" && op.output.status === "cleared") {
        // 在必需追加成功返回后注入窄外部故障：下一次
        // 来源／所有者检查必须失败；不手动推进资源或 Alive。
        expect(checkpointNobleBodyAuthority(g.world, true).noble.contracts[0]!.status).toEqual({
          kind: "cleared",
          day: 2,
        });
        const identity = g.world.getComponent(3, COMPONENT.Identity)!;
        identity.name = "fault-after-clear-god-op";
        faultApplied = true;
      }
    },
  };
  await runWithSessionRecorder(recorder as any, () =>
    g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          return call(r, { body: 7, exile: 10 });
        },
      },
      10,
    ),
  );
  const run = runWithSessionRecorder(recorder as any, () =>
    g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          return call(r, { body: 6, servant: 6, knife: 6, hunt: 6 });
        },
      },
      10,
    ),
  );
  await expect(run).rejects.toThrow("noble_body_owner_revoked");
  expect(faultApplied).toBe(true);
  const failed = checkpointNobleBodyAuthority(g.world, false),
    events = g.phaseManager.getEvents();
  expect(failed.noble.contracts[0]!.status).toEqual({ kind: "cleared", day: 2 });
  expect(failed.body.body).toEqual({ kind: "intact" });
  expect(failed.body.lastChoice).toEqual({ day: 2, targetId: 6 });
  expect(failed.nights.at(-1)).toMatchObject({ day: 2, status: "aborted", bodyResolved: false });
  const clear = ops.filter((op) => op.op === "noble_contract_closed");
  expect(clear).toHaveLength(1);
  expect(clear[0]).toMatchObject({
    scope: "resolution",
    phase: Phase.Night,
    status: "ok",
    output: { actorId: 1, day: 2, targetId: 6, contractId: "servant:night:2", status: "cleared" },
  });
  expect(nights(g)).toEqual([[]]);
  expect(events.some((e) => e.type === "secret_body_blocked")).toBe(false);
  expect(events.some((e) => e.type === "game_over")).toBe(false);
  const chosen = events.filter((e) => e.type === "demon_hunter_chosen").at(-1)!;
  expect(chosen.payload).toEqual({
    policy: "awa_netease_demon_hunter_v1",
    actorId: 4,
    day: 2,
    targetId: 6,
  });
  expect(Object.keys(chosen.payload)).toEqual(["policy", "actorId", "day", "targetId"]);
  for (const viewer of [1, 4, 6, 11])
    expect(
      buildAgentVisibleEventFeed(g.world, events, viewer).some(
        (e) => e.type === "noble_contract_closed" || e.type === "secret_body_blocked",
      ),
    ).toBe(false);
  writeFileSync(
    "/tmp/awa-noble-maintained-clear-failure-evidence.json",
    JSON.stringify(
      {
        fault: "Identity.name changed only after required clear God op recorded",
        ops,
        failed,
        events,
      },
      null,
      2,
    ),
  );
});

test("successful clear required God op appears once; original hunt payload and all player feeds stay private", async () => {
  const g = game(),
    ops: any[] = [];
  const recorder = {
    recordLogicOp(op: any) {
      ops.push(structuredClone(op));
    },
    recordRequiredLogicOp(op: any) {
      ops.push(structuredClone(op));
    },
  };
  await runWithSessionRecorder(recorder as any, async () => {
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          return call(r, { body: 7 });
        },
      },
      10,
    );
    await g.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          return call(r, { body: 8, servant: 6, hunt: 6 });
        },
      },
      10,
    );
  });
  expect(ops.filter((op) => op.op === "noble_contract_closed")).toHaveLength(1);
  const events = g.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "noble_contract_closed")).toHaveLength(1);
  expect(events.filter((e) => e.type === "demon_hunter_chosen").at(-1)!.payload).toEqual({
    policy: "awa_netease_demon_hunter_v1",
    actorId: 4,
    day: 2,
    targetId: 6,
  });
  expect(
    ops.filter((op) => op.op === "demon_hunter_sources_frozen").at(-1)!.output.hunt,
  ).toMatchObject({
    damage: null,
    choice: { day: 2, targetId: 6 },
    servantCleared: { status: "cleared" },
  });
  for (let viewer = 1; viewer <= 12; viewer++)
    expect(
      buildAgentVisibleEventFeed(g.world, events, viewer).some(
        (e) => e.type === "noble_contract_closed",
      ),
    ).toBe(false);
  expect(checkpointNobleBodyAuthority(g.world, true).knowledge.noble.contracts[0]!.status).toEqual({
    kind: "pending",
  });
});
