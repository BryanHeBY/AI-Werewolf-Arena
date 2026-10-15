/**
 * 单元测试用手写事实及两语预期验证机制事件的自然语言展示。
 * 区分待结算／已死亡、多源死因与空名单；夜报只读已经获知的副本，不重算状态或改写事件。
 */
import { expect, test } from "bun:test";
import {
  animalDreamEventLabel,
  fragrantPairEventLabel,
  nobleSecretBodyEventLabel,
  wallEventLabel,
  wildChildEventLabel,
  thiefEventLabel,
  shapeshifterEventLabel,
} from "@ai-werewolf-arena/game-presentation";

const animal = { policy: "awa_animal_dream_v1", day: 1 };
const waves = [
  {
    type: "animal_wave_prepared",
    payload: { ...animal, phase: "night", proposedIds: [1], blockedCatId: null },
    zh: "第1天夜晚待结算死亡：1号；白猫延缓死亡：无。",
    en: "Day 1, Night: proposed deaths: Player 1; White Cat death deferred: None.",
  },
  {
    type: "animal_wave_committed",
    payload: { ...animal, phase: "night", deaths: [1], deathSources: { 1: ["wolf_kill"] } },
    zh: "第1天夜晚实际死亡：1号（狼刀）。",
    en: "Day 1, Night: actual deaths: Player 1 (wolf attack).",
  },
  {
    type: "animal_wave_prepared",
    payload: { ...animal, phase: "voting", proposedIds: [9, 12], blockedCatId: 9 },
    zh: "第1天投票待结算死亡：9号、12号；白猫延缓死亡：9号。",
    en: "Day 1, Voting: proposed deaths: Player 9, Player 12; White Cat death deferred: Player 9.",
  },
  {
    type: "animal_wave_committed",
    payload: {
      ...animal,
      phase: "voting",
      deaths: [12, 9],
      deathSources: {
        9: ["white_cat_expiry", "puffer_retaliation"],
        12: ["exile", "charm", "self_destruct"],
      },
    },
    zh: "第1天投票实际死亡：12号（放逐、狼美人牵连、自爆）、9号（白猫延寿到期、河豚反击）。",
    en: "Day 1, Voting: actual deaths: Player 12 (exile, Wolf Beauty link, self-destruct), Player 9 (White Cat deferral expiry, Pufferfish retaliation).",
  },
  {
    type: "animal_wave_prepared",
    payload: { ...animal, phase: "day", proposedIds: [], blockedCatId: null },
    zh: "第1天白天待结算死亡：无；白猫延缓死亡：无。",
    en: "Day 1, Day: proposed deaths: None; White Cat death deferred: None.",
  },
  {
    type: "animal_wave_committed",
    payload: { ...animal, phase: "day", deaths: [], deathSources: {} },
    zh: "第1天白天实际死亡：无。",
    en: "Day 1, Day: actual deaths: None.",
  },
  {
    type: "animal_cat_expiry_prepared",
    payload: { ...animal, actorId: 9, unit: 2, unitKind: "exile" },
    zh: "第1天第2次白天结算（实际放逐）：9号白猫延寿到期，待结算死亡。",
    en: "Day 1, daytime resolution 2 (exile): White Cat 9 reaches the end of its deferral; death awaits resolution.",
  },
  {
    type: "animal_unit_completed",
    payload: { ...animal, unit: 2, kind: "skipped_day" },
    zh: "第1天第2次白天结算已完成（跳过白天）。",
    en: "Day 1, daytime resolution 2 completed (skipped day).",
  },
] as const;

for (const locale of ["zh-CN", "en"] as const) {
  for (const row of waves)
    test(`${locale}: ${row.type} preserves phase, order and settlement meaning`, () => {
      const original = structuredClone(row.payload);
      expect(animalDreamEventLabel(row.type, row.payload, locale)).toBe(
        locale === "en" ? row.en : row.zh,
      );
      expect(row.payload).toEqual(original);
      expect(
        animalDreamEventLabel(row.type, { ...row.payload, extraPrivateField: 1 }, locale),
      ).toBeNull();
    });

  test(`${locale}: Noble and Secret Body show localized damage, contract state and resource`, () => {
    const base = { policy: "awa_noble_secret_body_v1", actorId: 1, day: 3 };
    expect(
      nobleSecretBodyEventLabel(
        "noble_body_sources_committed",
        {
          ...base,
          deaths: [8],
          deathSources: { 8: ["servant_expiry", "poison"] },
          blocked: { targetId: 6, cause: "wolf_kill" },
        },
        locale,
      ),
    ).toBe(
      locale === "en"
        ? "Night 3 damage resolution: effective lethal damage: Player 8 (servant contract expiry, poison); Secret Body block: Player 6 (wolf attack)."
        : "第3夜伤害结算：有效致死伤害：8号（夜仆契约到期、毒药）；秘密之身抵消：6号（狼刀）。",
    );
    expect(
      nobleSecretBodyEventLabel(
        "noble_body_sources_committed",
        {
          ...base,
          deaths: [],
          deathSources: {},
          blocked: null,
        },
        locale,
      ),
    ).toBe(
      locale === "en"
        ? "Night 3 damage resolution: effective lethal damage: None; Secret Body block: None."
        : "第3夜伤害结算：有效致死伤害：无；秘密之身抵消：无。",
    );
    expect(
      nobleSecretBodyEventLabel(
        "noble_contract_closed",
        {
          ...base,
          contractId: "servant:night:2",
          targetId: 8,
          createdNight: 2,
          expiresNight: 3,
          status: "expired",
          proposedCause: "servant_expiry",
        },
        locale,
      ),
    ).toBe(
      locale === "en"
        ? "Day 3: the servant contract for player 8 (created on night 2) closed: expired."
        : "第3天，8号的夜仆契约（第2夜建立）结束：已到期。",
    );
    expect(
      nobleSecretBodyEventLabel(
        "noble_night_notified",
        {
          ...base,
          day: 4,
          wolfActionPolicy: "standard",
          lastNotifiedNight: 4,
          lastChoice: { day: 3, targetId: 5 },
          contracts: [
            {
              id: "servant:night:2",
              targetId: 8,
              createdNight: 2,
              expiresNight: 3,
              status: { kind: "expired", day: 3 },
            },
            {
              id: "servant:night:3",
              targetId: 5,
              createdNight: 3,
              expiresNight: 4,
              status: { kind: "pending" },
            },
          ],
        },
        locale,
      ),
    ).toBe(
      locale === "en"
        ? "Player 1, night 4 known servant contracts: Player 8 (created on night 2, expires on night 3; expired on day 3), Player 5 (created on night 3, expires on night 4; pending)."
        : "1号第4夜获知自己的夜仆契约：8号（第2夜建立，第3夜到期；第3天已到期）、5号（第3夜建立，第4夜到期；待结算）。",
    );
    expect(
      nobleSecretBodyEventLabel(
        "secret_body_night_notified",
        {
          ...base,
          lastNotifiedNight: 3,
          protectionRepeatPolicy: "awa_repeat_v1",
          lastChoice: { day: 2, targetId: 6 },
          resource: "spent",
          publicRevealDay: null,
        },
        locale,
      ),
    ).toBe(
      locale === "en"
        ? "Player 1 received body state on night 3: Secret Body spent."
        : "1号第3夜获知身体状态：秘密之身已消耗。",
    );
  });

  test(`${locale}: Fragrant night report describes only known choices and knife notices`, () => {
    const p = {
      policy: "awa_fragrant_pair_seer_v1",
      actorId: 5,
      day: 2,
      known: {
        knownWolfId: 1,
        lastOpenedNight: 2,
        lastChoice: { day: 1, pairIds: [2, 3] },
        activeBinding: null,
        used: true,
        knifeNotices: [
          { day: 1, eligible: false },
          { day: 2, eligible: true },
        ],
      },
    };
    const before = structuredClone(p);
    expect(fragrantPairEventLabel("fragrant_night_notified", p, locale)).toBe(
      locale === "en"
        ? "Player 5, night 2 Fragrant report: known wolf: Player 1; last binding choice: Night 1: chose Player 2, Player 3; link ability: used; knife eligibility history: Night 1: unavailable, Night 2: available."
        : "5号第2夜寻香夜报：已知狼人：1号；最近绑定选择：第1夜选择2号、3号；牵连技能已使用；历夜狼刀资格：第1夜不可用、第2夜可用。",
    );
    expect(p).toEqual(before);
    expect(
      fragrantPairEventLabel("fragrant_night_notified", { ...p, hiddenWolfIds: [2, 3] }, locale),
    ).toBeNull();
  });

  test(`${locale}: role lists and model death reasons omit machine formatting`, () => {
    const wild = wildChildEventLabel(
      "wild_child_model_eliminated",
      {
        actorId: 1,
        targetId: 2,
        day: 2,
        phase: "night",
        deathCommit: "wild-model:1:2:2",
        sources: ["wolf_kill", "shot"],
        deadIds: [2],
      },
      locale,
    );
    expect(wild).toBe(
      locale === "en"
        ? "Wild Child 1's model, player 2, actually died; causes: wolf attack, shot."
        : "野孩子1号的榜样2号已实际死亡，来源：狼刀、开枪。",
    );
    for (const [render, type, role, policy] of [
      [thiefEventLabel, "thief_initial_deal", "thief", "lui_meme_thief_two_extra_villagers_v1"],
      [
        shapeshifterEventLabel,
        "shapeshifter_initial_deal",
        "shapeshifter",
        "awa_netease_shapeshifter_two_extra_villagers_v1",
      ],
    ] as const) {
      const label = render(
        type,
        {
          policy,
          boardSize: 6,
          roles: [role, "wolf", "wolf", "seer", "witch", "hunter", "villager", "villager"],
        },
        locale,
      );
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/[\[\]{}"]/);
      expect(label).toContain(locale === "en" ? "Werewolf, Werewolf, Seer" : "狼人、狼人、预言家");
    }
  });
}

test("anonymous wall preserves note order and user text without revealing authors", () => {
  const raw = 'Exact {actorId}\n第二行 "💌" <script>not executable</script>',
    base = { day: 1, eventId: "awa_wall_notes_v1" };
  for (const locale of ["zh-CN", "en"] as const) {
    expect(
      wallEventLabel("wall_notes_published", { ...base, texts: [raw, "second"] }, locale),
    ).toBe(
      locale === "en"
        ? `Anonymous wall notes (random order): Note 1: ${raw}\nNote 2: second`
        : `匿名墙纸条（随机顺序）：第1张：${raw}\n第2张：second`,
    );
    const god = wallEventLabel(
      "wall_note_order_recorded",
      { ...base, rows: [{ actorId: 8, instanceId: "wall:1:8", rank: 0, text: raw }] },
      locale,
    );
    expect(god).toBe(
      locale === "en"
        ? `God note authors and publication order: Note 1, player 8: ${raw}`
        : `上帝纸条作者和公布次序：第1张，8号：${raw}`,
    );
    expect(god).not.toContain("wall:1:8");
  }
});
