import { beforeAll, test, expect } from "bun:test";
import {
  assertFragrantTransportWire,
  type FragrantWireRun,
} from "../support/features/fragrant-pair-seer/oracles/wire";
import { fragrantTransportScenario } from "../support/fragrant_pair_seer_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
let sdk: FragrantWireRun, acp: FragrantWireRun;
beforeAll(async () => {
  sdk = await runTransportGame(fragrantTransportScenario("expiry"), "llm", "zh-CN");
  acp = await runTransportGame(fragrantTransportScenario("expiry"), "acp", "en");
}, 30000);
const actor = (r: FragrantWireRun, role: string) =>
  r.record.metadata.players.find((p) => p.role === role)!.id;
const marker = "你的已授权寻香知识、绑定历史和刀权状态：";
const current = (w: any) =>
  [...w.messages]
    .reverse()
    .find(
      (m: any) =>
        m.role === "user" && typeof m.content === "string" && m.content.includes("[行动提示]"),
    );
function first(r: FragrantWireRun, role: string) {
  return r.sdkWireMessages.find((w) => w.actor === actor(r, role))!;
}
function negative(
  label: string,
  source: () => FragrantWireRun,
  mutate: (r: FragrantWireRun) => void,
  error: string,
) {
  test(label, () => {
    const r = structuredClone(source());
    mutate(r);
    expect(() => assertFragrantTransportWire(r)).toThrow(error);
  });
}
test("two literal wire snapshots are valid", () => {
  expect(() => assertFragrantTransportWire(sdk)).not.toThrow();
  expect(() => assertFragrantTransportWire(acp)).not.toThrow();
});
negative(
  "Phantom initial wrong identity",
  () => sdk,
  (r) => {
    const m: any = first(r, "fragrant_phantom").messages[0];
    m.content = m.content.replace("你的真实身份是寻香魅影。", "你的真实身份是狼人。");
  },
  "initial_identity",
);
negative(
  "AS initial ordinary Seer",
  () => sdk,
  (r) => {
    const m: any = first(r, "awakened_seer").messages[0];
    m.content = m.content.replace("你的真实身份是觉醒预言家。", "你的真实身份是预言家。");
  },
  "initial_identity",
);
negative(
  "Phantom initial all three wolves",
  () => sdk,
  (r) => {
    const m: any = first(r, "fragrant_phantom").messages[0];
    m.content = m.content.replace(
      /队友（不含你自己）的编号：[^。]+。/,
      "队友（不含你自己）的编号：1, 8, 12。",
    );
  },
  "initial_teammates",
);
negative(
  "AS receives singleton teammate",
  () => sdk,
  (r) => {
    const m: any = first(r, "awakened_seer").messages[0];
    m.content = m.content.replace(
      "队友（不含你自己）的编号：无。",
      "队友（不含你自己）的编号：12。",
    );
  },
  "initial_teammates",
);
negative(
  "remove complete current knowledge",
  () => sdk,
  (r) => {
    const m = current(first(r, "fragrant_phantom"));
    m.content = m.content.replace(marker, "已删除：");
  },
  "known_state",
);
negative(
  "premature used flag before any public death",
  () => sdk,
  (r) => {
    const m = current(first(r, "fragrant_phantom"));
    m.content = m.content.replace('"used":false', '"used":true');
  },
  "known_state",
);
negative(
  "invent night one inherited knife",
  () => sdk,
  (r) => {
    const m = current(first(r, "fragrant_phantom"));
    m.content = m.content.replace('"canVoteForKill":false', '"canVoteForKill":true');
  },
  "known_state",
);
negative(
  "hidden God state plaintext",
  () => sdk,
  (r) => {
    current(first(r, "fragrant_phantom")).content += '\n{"trigger":{"rootId":5,"addedTargetId":6}}';
  },
  "actual_state_exposed",
);
negative(
  "same-day future pair result before first decision",
  () => sdk,
  (r) => {
    const w = first(r, "awakened_seer");
    w.messages.splice(w.messages.length - 1, 0, {
      role: "user",
      content: JSON.stringify({
        event: [
          2,
          "fragrant_pair_inspected",
          {
            policy: "awa_fragrant_pair_seer_v1",
            actorId: w.actor,
            day: 1,
            targetIds: [1, 12],
            containsWerewolf: true,
          },
        ],
      }),
    });
  },
  "suffix",
);
negative(
  "flip literal two-wolf boolean in emitted event",
  () => sdk,
  (r) => {
    const w = r.sdkWireMessages.find(
      (w) =>
        w.actor === actor(r, "awakened_seer") &&
        w.messages.some(
          (m: any) =>
            typeof m.content === "string" &&
            m.content.startsWith('{"event":') &&
            m.content.includes("fragrant_pair_inspected"),
        ),
    )!;
    const m: any = w.messages.find(
      (m: any) =>
        m.content?.startsWith('{"event":') && m.content.includes("fragrant_pair_inspected"),
    );
    m.content = m.content.replace('"containsWerewolf":true', '"containsWerewolf":false');
  },
  "suffix",
);
negative(
  "alter AS history aggregate in current resources",
  () => sdk,
  (r) => {
    const w = r.sdkWireMessages.find(
      (w) =>
        w.actor === actor(r, "awakened_seer") &&
        current(w).content.includes('"containsWerewolf":true'),
    )!;
    current(w).content = current(w).content.replace(
      '"containsWerewolf":true',
      '"containsWerewolf":false',
    );
  },
  "pair_state",
);
negative(
  "add forbidden per-target camp to resources",
  () => sdk,
  (r) => {
    const m = current(first(r, "awakened_seer"));
    m.content = m.content.replace('"history":[]', '"history":[],"targetCamp":"wolf"');
  },
  "pair_state",
);
negative(
  "drop bind parameter shape",
  () => sdk,
  (r) => {
    const m = current(first(r, "fragrant_phantom"));
    m.content = m.content.replace(
      'bind_fragrant_pair args: {"target_ids":[number,number]|null}',
      "bind_fragrant_pair args: {}",
    );
  },
  "bind_hint",
);
negative(
  "rewrite retained historical status using future used",
  () => sdk,
  (r) => {
    const w = r.sdkWireMessages.find(
      (w) =>
        w.actor === actor(r, "fragrant_phantom") &&
        w.ordinal > 1 &&
        w.messages.some(
          (m: any) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes(marker) &&
            m.content.includes("turn_id 必须为 t1"),
        ),
    )!;
    const m: any = w.messages.find(
      (m: any) =>
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.includes(marker) &&
        m.content.includes("turn_id 必须为 t1"),
    );
    m.content = m.content.replace('"used":false', '"used":true');
  },
  "known_state",
);
negative(
  "retained valid future prompt cannot appear earlier",
  () => sdk,
  (r) => {
    const later = r.sdkWireMessages.find(
      (w) => w.actor === actor(r, "fragrant_phantom") && w.ordinal === 2,
    )!;
    first(r, "fragrant_phantom").messages.splice(1, 0, structuredClone(current(later)));
  },
  "future_history",
);
negative(
  "delete entire one actor wire",
  () => sdk,
  (r) => {
    r.sdkWireMessages = r.sdkWireMessages.filter((w) => w.actor !== actor(r, "fragrant_phantom"));
  },
  "coverage",
);
negative(
  "ACP omit mandatory night notice",
  () => acp,
  (r) => {
    const t = r.acpTraces.find((t) => t.actor === actor(r, "fragrant_phantom"))!.trace;
    const index = t.prompts.findIndex((p) => p.includes("Current turn ID: t1"));
    t.prompts[index] = t.prompts[index]!.split("\n")
      .map((line) => {
        const n = line.indexOf('{"events":');
        if (n < 0) return line;
        const payload = JSON.parse(line.slice(n));
        payload.events = payload.events.filter((e: any) => e[1] !== "fragrant_night_notified");
        return line.slice(0, n) + JSON.stringify(payload);
      })
      .join("\n");
  },
  "delta",
);
negative(
  "ACP active schema reports game state",
  () => acp,
  (r) => {
    (r.acpTraces[0]!.trace.activeSchemas[0]!.body as any).world = { wolves: [1, 8, 12] };
  },
  "schema",
);
negative(
  "ACP valid schema wrong actorOrdinal",
  () => acp,
  (r) => {
    r.acpTraces[0]!.trace.activeSchemas[0]!.actorOrdinal = 99;
  },
  "schema_ordinal",
);
negative(
  "foreign owner knowledge injected into ordinary current prompt",
  () => sdk,
  (r) => {
    const w = first(r, "villager");
    current(w).content += '\n{"knownWolfId":12}';
  },
  "foreign_state_exposed",
);
