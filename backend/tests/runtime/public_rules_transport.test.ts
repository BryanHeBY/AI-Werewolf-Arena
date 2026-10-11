import { expect, test } from "bun:test";
import { magicianScenario } from "../support/magician_transport_scenarios";
import { evilKnightScenario } from "../support/evil_knight_transport_scenarios";
import { timeConsortScenario } from "../support/time_consort_transport_scenarios";
import { nightmareScenario } from "../support/nightmare_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
const entries = [
  {
    name: "magician",
    make: () => magicianScenario("original"),
    early: false,
    zh: ["魔术师从第1夜起", "魔术师的交换不影响死亡后的枪口"],
    en: [
      "Magician exchanges are available starting on night 1.",
      "Magician exchanges do not affect death-shot targets.",
    ],
  },
  {
    name: "evil-knight",
    make: () => evilKnightScenario("shot_bypass_good"),
    early: true,
    zh: ["恶夜骑士可被合格的猎人枪杀死"],
    en: ["Dark Knight can be killed by an eligible Hunter shot"],
  },
  {
    name: "consort",
    make: () => timeConsortScenario("first_effect"),
    early: false,
    zh: ["蚀时狼妃采用首次效果范围"],
    en: ["Time Wolf Consort reflects only the first eligible effect"],
  },
  {
    name: "nightmare",
    make: () => nightmareScenario(),
    early: false,
    zh: ["噩梦之影不能自爆，也不能成为狼刀目标"],
    en: ["Nightmare Shadow cannot self-destruct or be targeted by the pack knife"],
  },
];
for (const entry of entries)
  for (const kind of ["llm", "acp"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(`public variants and real first-day prompt/${entry.name}/${kind}/${locale}`, async () => {
        const scenario = entry.make(),
          old = scenario.promptAssertions;
        scenario.promptAssertions = (actor, language) => {
          const previous = old?.(actor, language);
          const timing = entry.early
            ? language === "en"
              ? "resolves night deaths before daytime"
              : "先完成夜间死亡结算"
            : language === "en"
              ? "After the sheriff vote, night_resolved"
              : "警长投票结束后，才由 night_resolved";
          return {
            ...previous,
            requiredSystemMarkers: [
              ...(previous?.requiredSystemMarkers ?? []),
              timing,
              ...(language === "en" ? entry.en : entry.zh),
            ],
          };
        };
        const run = await runTransportGame(scenario, kind, locale);
        expect(run.result.snapshot.gameOver).toBe(true);
        const events = run.record.events,
          night = events.findIndex((e) => e.type === "night_resolved"),
          nomination = events.findIndex((e) => e.type === "sheriff_nomination_summary");
        expect(night).toBeGreaterThanOrEqual(0);
        expect(nomination).toBeGreaterThanOrEqual(0);
        expect(night < nomination).toBe(entry.early);
        const prompts =
          kind === "llm"
            ? [...run.sdkPrompts.values()].flat()
            : run.acpTraces.flatMap((row) => row.trace.prompts as string[]);
        const marker =
          locale === "en"
            ? "This is nomination, not withdrawal:"
            : "这是上警报名阶段，不是退水阶段";
        const turns = prompts.filter((p) => p.includes(marker));
        expect(turns.length).toBeGreaterThan(0);
        for (const p of turns)
          expect(
            p.includes(
              locale === "en"
                ? "The first-day sheriff election occurs before the night outcome"
                : "首日警长流程发生在昨夜结果公开之前",
            ),
          ).toBe(!entry.early);
        expect(run.rejected.size).toBe(0);
      }, 120000);
