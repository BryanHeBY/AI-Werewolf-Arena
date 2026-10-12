/**
 * Reproduction scenarios verify real Mist/Raven unpublished native, badge, election and spent-skill feeds remain compatible and private.
 * Input: Original cached actual phase prefixes, recording metadata and copied private-canary/feed alterations.
 * Output and oracle: Literal request/event/state expectations and parser rejection preserve original cache and setup evaluation; no pure decoder fixture replaces the played prefix.
 */
import { mistPrefix } from "../../../support/mist_raven_prefix";
import { test, expect } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Phase, createRandom, type ActionRequest, type ToolCall } from "../../../../src/core";
import {
  ReproductionTrace,
  parseReproductionRecord,
  type ReproductionRecord,
} from "../../../../src/recording/reproduction";
import { captureCheckpoint } from "../../../../src/runtime/simulation/reproduction_context";
import { mistRecording, mistBoard, mistAction, MIST_ROLES } from "../../../support/mist_raven_recording";
const cache = new Map<string, Promise<ReproductionRecord>>();
function prefix(
  stage: string,
  day: number,
  actor: number,
  mode: "normal" | "soft-null" | "soft-invalid" | "badge" = "normal",
) {
  const key = [stage, day, actor, mode].join("/");
  if (cache.has(key)) return cache.get(key)!;
  const task = (async () => {
    const board = await mistBoard(),
      metadata = (await mistRecording()).metadata;
    const game = bootstrapGame(board.config, {
      locale: "en",
      random: createRandom("mist-raven-real-runtime"),
      fixedRoles: MIST_ROLES,
    });
    const trace = new ReproductionTrace(metadata, () => {});
    const cp = (cycle: number) =>
      trace.checkpoint(
        captureCheckpoint(
          game.world,
          game.phaseManager.getSnapshot(),
          cycle,
          true,
          game.phaseManager.getEvents().length,
        ),
        game.phaseManager.getEvents(),
      );
    const raw = () => structuredClone(trace.build());
    cp(0);
    let found: ReproductionRecord | undefined;
    for (let cycle = 1; cycle <= day; cycle++) {
      try {
        await game.phaseManager.runSingleCycle(
          {
            getAction: (q) =>
              trace.decide(q, {
                async getAction(req: ActionRequest): Promise<ToolCall | null> {
                  if (
                    req.context.day === day &&
                    req.context.stage === stage &&
                    req.actorId === actor
                  ) {
                    found = raw();
                    throw Error("boundary");
                  }
                  if (mode === "badge") {
                    if (req.context.stage === "sheriff_nomination")
                      return { name: "run_for_sheriff", args: { run: req.actorId === 11 } };
                    if (req.context.stage === "sheriff_campaign_speech")
                      return { name: "speak", args: { text: "Campaign" } };
                    if (req.context.stage === "sheriff_withdraw")
                      return { name: "run_for_sheriff", args: { run: true } };
                    if (req.context.stage === "sheriff_choose_direction")
                      return { name: "choose_direction", args: { direction: "clockwise" } };
                    if (req.context.stage === "sheriff_badge_choice")
                      return { name: "choose_badge_successor", args: { target_id: 5 } };
                  }
                  if (
                    mode.startsWith("soft") &&
                    req.context.stage === "voting" &&
                    req.actorId === 5
                  )
                    return mode === "soft-null"
                      ? null
                      : { name: "vote", args: { target_id: 99, abstain: false } };
                  return mistAction(req, "linked");
                },
              }),
          },
          8,
        );
        cp(cycle);
      } catch (e) {
        expect(String(e)).toContain("boundary");
        break;
      }
    }
    expect(found).toBeDefined();
    return found!;
  })();
  cache.set(key, task);
  return task;
}
test("real N2 Seer pending without new cycle checkpoint remains accepted", async () => {
  const r = await prefix("seer", 2, 2);
  expect(() => parseReproductionRecord(r)).not.toThrow();
}, 120000);
test("unpublished N2 night deaths cannot leak into N2 Seer before Day/Snake", async () => {
  const r = structuredClone(await prefix("seer", 2, 2)),
    d = r.decisions.at(-1)!;
  expect(d.request.phase).toBe(Phase.Night);
  expect(r.checkpoints.at(-1)!.cycle).toBe(1);
  expect(r.decisions.some((x) => x.day === 2 && x.stage === "alchemist_snake")).toBe(false);
  d.request.context.visible_events.push({
    seq: d.request.context.visible_events.length + 1,
    type: "night_resolved",
    payload: { deaths: [3, 5] },
  });
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow("reproduction_mist_raven_invalid");
}, 120000);
test("real N2 Snake receives spent-Mist skipped fact without a phantom Mist request", async () => {
  const r = await prefix("alchemist_snake", 2, 1);
  expect(r.decisions.some((x) => x.day === 2 && x.stage === "alchemist_mist")).toBe(false);
  expect(
    r.decisions
      .at(-1)!
      .request.context.visible_events.some(
        (e) =>
          e.type === "alchemist_mist_skipped" &&
          e.payload.day === 2 &&
          e.payload.reason === "spent",
      ),
  ).toBe(true);
  expect(() => parseReproductionRecord(r)).not.toThrow();
}, 120000);
for (const mode of ["soft-null", "soft-invalid"] as const)
  test(
    "real unpublished vote summary preserves four-try abstain/" + mode,
    async () => {
      const r = await prefix("last_words", 1, 12, mode);
      expect(r.decisions.filter((x) => x.stage === "voting" && x.actorId === 5)).toHaveLength(4);
      expect(() => parseReproductionRecord(r)).not.toThrow();
    },
    120000,
  );
test("real unpublished sheriff badge prefix remains accepted", async () => {
  const r = await prefix("voting", 1, 1, "badge");
  expect(
    r.decisions
      .at(-1)!
      .request.context.visible_events.some((e) => e.type === "sheriff_badge_transferred"),
  ).toBe(true);
  expect(() => parseReproductionRecord(r)).not.toThrow();
}, 120000);
test("unpublished authorized badge cannot carry an unrelated private canary", async () => {
  const r = structuredClone(await prefix("voting", 1, 1, "badge"));
  const e = r.decisions
    .at(-1)!
    .request.context.visible_events.find((e) => e.type === "sheriff_badge_transferred")!;
  e.payload.privateCanary = "OTHER_PLAYER_PRIVATE_INVENTORY";
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow("reproduction_mist_raven_invalid");
}, 120000);

test("unpublished public sheriff summary cannot carry an unrelated private canary", async () => {
  const r = structuredClone(await prefix("day_speech", 1, 1));
  const e = r.decisions
    .at(-1)!
    .request.context.visible_events.find((e) => e.type === "sheriff_vote_summary")!;
  expect(e).toBeDefined();
  e.payload.privateCanary = "OTHER_PLAYER_PRIVATE_INVENTORY";
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow("reproduction_mist_raven_invalid");
}, 120000);

for (const mode of [
  "chat-ended",
  "chat-message",
  "repeat-speech",
  "badge-weight",
  "nomination-invalid",
  "sheriff-vote-invalid",
  "sheriff-abstain-invalid",
  "self-vote",
] as const)
  test(
    "real finite feed compatibility/" + mode,
    async () => {
      const chat = mode.startsWith("chat"),
        election = mode.startsWith("sheriff"),
        day = mode === "repeat-speech" ? 2 : 1;
      const actor = chat
        ? 11
        : election
          ? 1
          : mode === "repeat-speech"
            ? 2
            : mode === "nomination-invalid"
              ? 1
              : 12;
      const stage = chat
        ? "wolf_discussion"
        : election
          ? "sheriff_choose_direction"
          : mode === "repeat-speech" || mode === "nomination-invalid"
            ? "day_speech"
            : "last_words";
      const r = await mistPrefix(stage, day, false, actor, (q) => {
        const s = q.context.stage;
        if (chat && s === "wolf_discussion" && q.actorId === 10)
          return {
            name: "speak_to_wolves",
            args: {
              text: " [God] safe message ",
              end_chat: mode === "chat-ended" || q.context.round === 2,
            },
          };
        if (mode === "self-vote" && s === "voting" && q.actorId === 1)
          return { name: "vote", args: { target_id: 1, abstain: false } };
        if (mode === "nomination-invalid" && s === "sheriff_nomination" && q.actorId === 1)
          return { name: "run_for_sheriff", args: { run: "yes" } } as unknown as ToolCall;
        if (mode === "badge-weight" || election) {
          if (s === "sheriff_nomination")
            return {
              name: "run_for_sheriff",
              args: {
                run: mode === "badge-weight" ? q.actorId === 11 : [1, 2].includes(q.actorId),
              },
            };
          if (s === "sheriff_campaign_speech") return { name: "speak", args: { text: "Campaign" } };
          if (s === "sheriff_withdraw") return { name: "run_for_sheriff", args: { run: true } };
          if (s === "sheriff_choose_direction")
            return { name: "choose_direction", args: { direction: "clockwise" } };
          if (s === "sheriff_badge_choice")
            return { name: "choose_badge_successor", args: { target_id: 1 } };
          if (s === "sheriff_vote")
            return {
              name: "vote_for_sheriff",
              args: {
                target_id: q.actorId === 3 && mode === "sheriff-vote-invalid" ? 99 : 1,
                abstain: q.actorId === 3 && mode === "sheriff-abstain-invalid",
              },
            };
        }
        return undefined;
      });
      for (const prefix of Object.values(r))
        expect(() => parseReproductionRecord(prefix)).not.toThrow();
    },
    120000,
  );
