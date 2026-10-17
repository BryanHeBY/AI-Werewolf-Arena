/**
 * 单元测试负责独立核对正式编译链路的覆盖诊断及真实目录读取边界。输入是小型手写归档和临时文件，输出明确的定位与只读断言。
 * 不从路由表生成预期；无效单局不得吞掉其余局，报告不得包含原话或接入配置。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { auditVideoReplay } from "../../../src/video/plan/audit";
import { auditVideoRecords } from "../../../scripts/audit-video-records";
import { classifyVideoScene } from "../../../src/video/scene-classification";
import { compileVideoPlan } from "../../../src/video/compiler";

function replay(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "audit-local",
    meta: { board: "classic", locale: "zh-CN", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: "in_progress" },
    players: [
      { player_id: 1, role: "wolf", camp: "wolf" },
      { player_id: 2, role: "villager", camp: "good" },
    ],
    events: [
      {
        seq: 1,
        timestamp: "2026-10-17T00:00:00Z",
        day: 1,
        phase: "night",
        type: "wolf_discussion_ended",
        payload: { actorId: 1, reason: "审计不得泄露的原话" },
      },
      {
        seq: 2,
        timestamp: "2026-10-17T00:00:01Z",
        day: 1,
        phase: "night",
        type: "witch_potion_skipped",
        payload: { actorId: 2 },
      },
      {
        seq: 3,
        timestamp: "2026-10-17T00:00:02Z",
        day: 1,
        phase: "night",
        type: "future_unknown",
        payload: { secret: "禁止报告此字段" },
      },
    ],
  };
}

test("actual compiler distinguishes speech, intentional compact notice and unsupported events without leaking text", () => {
  const input = replay();
  const original = JSON.stringify(input);
  const audit = auditVideoReplay(input);
  expect(audit.completed).toBe(false);
  expect(
    audit.scenes.find((scene) => scene.sourceEvents.some((event) => event.seq === 1)),
  ).toMatchObject({ layout: "speech", treatment: "dedicated", blocks: ["dialogue"] });
  expect(
    audit.scenes.find((scene) => scene.sourceEvents.some((event) => event.seq === 2)),
  ).toMatchObject({ layout: "notice", treatment: "compact_notice" });
  expect(audit.invalidEvents).toContainEqual({
    seq: 3,
    type: "future_unknown",
    readerStatus: "unrecognized",
  });
  expect(
    audit.scenes.find((scene) => scene.sourceEvents.some((event) => event.seq === 3)),
  ).toMatchObject({ treatment: "unhandled" });
  expect(JSON.stringify(audit)).not.toContain("审计不得泄露");
  expect(JSON.stringify(audit)).not.toContain("禁止报告");
  expect(JSON.stringify(input)).toBe(original);
});

test("a known generic notice stays visible as review work rather than being declared dedicated by its route", () => {
  const input = replay();
  input.events = [{ ...input.events[0]!, type: "sheriff_elected", payload: { winnerId: 1 } }];
  const audit = auditVideoReplay(input);
  expect(audit.scenes[0]).toMatchObject({ treatment: "generic_record", layout: "notice" });
  expect(audit.invalidEvents).toEqual([]);
  const plan = compileVideoPlan(input);
  expect(classifyVideoScene(plan.shots[0]!.scene, "minimal-v1").treatment).toBe("generic_record");
});

test("unfinished archive uses only recorded initialization roster and preserves its source identity", () => {
  const input = replay();
  input.players = [];
  input.events = [
    {
      ...input.events[0]!,
      type: "god_private_game_info",
      payload: {
        players: [
          { id: 1, role: "wolf", camp: "wolf" },
          { id: 2, role: "villager", camp: "good" },
        ],
      },
    },
    ...input.events.map((event) => ({ ...event, seq: event.seq + 1 })),
  ];
  const audit = auditVideoReplay(input);
  expect(audit.rosterSource).toBe("recorded_initialization");
  expect(audit.completed).toBe(false);
  expect(input.players).toEqual([]);
});

test("missing roster is diagnosed separately and malformed game-over does not mark the archive completed", () => {
  const input = replay();
  input.players = [];
  expect(() => auditVideoReplay(input)).toThrow("video_audit_missing_roster");
  const malformed = replay();
  malformed.events = [{ ...malformed.events[0]!, type: "game_over", payload: { winner: 123 } }];
  const audit = auditVideoReplay(malformed);
  expect(audit.completed).toBe(false);
  expect(audit.invalidEvents).toEqual([
    { seq: 1, type: "game_over", readerStatus: "invalid_payload" },
  ]);
});

test("directory scan continues past a bad archive, rejects symlinks, prunes private/source directories and stays read-only", async () => {
  const directory = await mkdtemp(
    path.resolve(import.meta.dir, "../../../../node_modules/.cache/video-audit-"),
  );
  try {
    for (const sub of ["good", "bad", "players", "checkout", "linked"])
      await mkdir(path.join(directory, sub));
    const source = JSON.stringify(replay());
    await writeFile(path.join(directory, "good/replay.json"), source);
    await writeFile(path.join(directory, "bad/replay.json"), "{");
    await writeFile(path.join(directory, "players/replay.json"), "private auth payload");
    await writeFile(path.join(directory, "checkout/package.json"), "{}");
    await writeFile(path.join(directory, "checkout/replay.json"), "old checkout fixture");
    await writeFile(path.join(directory, "auth.json"), "secret");
    await symlink(
      path.join(directory, "good/replay.json"),
      path.join(directory, "linked/replay.json"),
    );
    const report = await auditVideoRecords(directory);
    expect(report.summary).toMatchObject({ files: 2, succeeded: 1, failed: 1, ongoing: 1 });
    expect(report.files.map((file) => file.path)).toEqual(["bad/replay.json", "good/replay.json"]);
    expect(await readFile(path.join(directory, "good/replay.json"), "utf8")).toBe(source);
    const truncated = await auditVideoRecords(directory, { maxFiles: 1 });
    expect(truncated.truncated).toBe(true);
    await expect(auditVideoRecords(path.join(directory, "linked/replay.json"))).rejects.toThrow(
      "video_audit_symlink_input",
    );
    await expect(auditVideoRecords(path.join(directory, "players"))).rejects.toThrow(
      "video_audit_no_public_replays",
    );
    const tooLarge = await auditVideoRecords(path.join(directory, "good/replay.json"), {
      maxBytes: 2,
    });
    expect(tooLarge.files[0]).toMatchObject({
      status: "error",
      code: "video_audit_file_too_large",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
