/**
 * 单元测试使用手写中英文预期验证终端私有开关：关闭时隐藏底牌、夜间技能、狼聊与刀票，开启时保留原文案。
 * 同时保留匿名熊公告和实际放逐映射等公开事实；只运行内存事件渲染，不调用模型或改动对局记录。
 */
import { expect, test } from "bun:test";
import { PotionType, type GameEvent } from "../../../src/domain";
import { getDefaultScriptEventRenderRegistry } from "../../../src/agents/presentation/event-render-registry";
import type { ScriptLiveKind } from "../../../src/agents/presentation/contracts";
import { presentStreamEvents } from "../../../src/adapters/console/console-presenter";

const event = <K extends GameEvent["type"]>(
  type: K,
  payload: Extract<GameEvent, { type: K }>["payload"],
): Extract<GameEvent, { type: K }> =>
  ({ timestamp: 1, type, payload }) as Extract<GameEvent, { type: K }>;

interface PrivateCase {
  event: GameEvent;
  kind: ScriptLiveKind;
  zh: string;
  en: string;
}

const privateCases: PrivateCase[] = [
  {
    event: event("guard_applied", { actorId: 2, targetId: 7, abstain: false }),
    kind: "action",
    zh: "[live][行动][守卫] 2号守护7号",
    en: "[live][Action][Guard] Player 2 protects 7",
  },
  {
    event: event("guard_applied", { actorId: 2, targetId: null, abstain: true }),
    kind: "action",
    zh: "[live][行动][守卫] 2号空守",
    en: "[live][Action][Guard] Player 2 skips protection",
  },
  {
    event: event("witch_potion_used", { actorId: 3, targetId: 7, potionType: PotionType.Heal }),
    kind: "private",
    zh: "[live][行动][女巫] 3号对7号使用解药",
    en: "[live][Action][Witch] Player 3 uses Antidote on 7",
  },
  {
    event: event("witch_potion_used", { actorId: 3, targetId: 7, potionType: PotionType.Poison }),
    kind: "private",
    zh: "[live][行动][女巫] 3号对7号使用毒药",
    en: "[live][Action][Witch] Player 3 uses Poison on 7",
  },
  {
    event: event("witch_potion_skipped", {
      actorId: 3,
      targetId: null,
      potionType: PotionType.None,
    }),
    kind: "private",
    zh: "[live][行动][女巫] 3号本夜未用药",
    en: "[live][Action][Witch] Player 3 uses no potion tonight",
  },
  {
    event: event("wolf_tactical_order", { order: [4, 9] }),
    kind: "god",
    zh: "[live][上帝] 狼人开始夜聊讨论，顺序：4->9",
    en: "[live][God] Wolf discussion begins. Order: 4->9",
  },
  {
    event: event("wolf_discussion", { actorId: 4, text: "秘密刀口", round: 1, endChat: false }),
    kind: "chat",
    zh: "[live][夜聊][4] 秘密刀口",
    en: "[live][Wolf chat][4] 秘密刀口",
  },
  {
    event: event("wolf_discussion_ended", { actorId: 4, reason: "秘密理由", round: 1 }),
    kind: "chat",
    zh: "[live][夜聊][结束][4] 秘密理由",
    en: "[live][Wolf chat][End][4] 秘密理由",
  },
  {
    event: event("wolf_kill_vote_cast", { actorId: 4, targetId: 7, abstain: false }),
    kind: "chat",
    zh: "[live][行动][狼刀票] 4号投刀7号",
    en: "[live][Action][Wolf kill vote] Player 4 targets 7",
  },
  {
    event: event("wolf_kill_vote_cast", { actorId: 4, targetId: null, abstain: true }),
    kind: "chat",
    zh: "[live][行动][狼刀票] 4号弃刀",
    en: "[live][Action][Wolf kill vote] Player 4 abstains",
  },
  {
    event: event("god_private_game_info", {
      boardSize: 1,
      players: [{ id: 4, seat: 4, name: "秘密名字", role: "wolf", camp: "wolf" }],
    }),
    kind: "god",
    zh: "[live][上帝私有][开局] 角色分布 4:狼人",
    en: "[live][God private][Start] Roles: 4:Werewolf",
  },
  {
    event: event("time_consort_lock_committed", { actorId: 4, day: 2, targetId: 7 }),
    kind: "private",
    zh: "4号第2夜封锁：7。",
    en: "Player 4's night 2 lock: 7.",
  },
  {
    event: event("time_consort_lock_skipped", { actorId: 4, day: 2, reason: "dead" }),
    kind: "private",
    zh: "第2夜，4号已死，不产生新的封锁。",
    en: "Night 2: player 4 is dead; no new lock.",
  },
  {
    event: event("time_consort_reflected", {
      actorId: 4,
      day: 2,
      sourceId: 3,
      requestedId: 7,
      effectiveId: 3,
      kind: "poison",
    }),
    kind: "god",
    zh: "第2夜，4号的封锁将3号对7号的毒药反弹给3号。",
    en: "Night 2: player 4's lock reflects player 3's poison from player 7 to player 3.",
  },
  {
    event: event("wolf_sorcerer_exchange_committed", { actorId: 4, day: 2, pair: [3, 7] }),
    kind: "private",
    zh: "4号第2夜的座位交换：3, 7。",
    en: "Player 4's night 2 seat exchange: 3, 7.",
  },
  {
    event: event("wolf_sorcerer_exchange_skipped", { actorId: 4, day: 2, reason: "dead" }),
    kind: "private",
    zh: "第2夜，4号已死，不产生新的座位交换。",
    en: "Night 2: player 4 is dead; no new seat exchange.",
  },
  {
    event: event("trickster_exchange_committed", { actorId: 4, day: 2, pair: [3, 7] }),
    kind: "private",
    zh: "4号第2夜的放逐交换选择：3, 7。",
    en: "Player 4's night 2 exile exchange choice: 3, 7.",
  },
  {
    event: event("trickster_exchange_skipped", { actorId: 4, day: 2, reason: "dead" }),
    kind: "private",
    zh: "第2夜，4号已死，不产生新的放逐交换。",
    en: "Night 2: player 4 is dead; no new exile exchange.",
  },
];

for (const locale of ["zh-CN", "en"] as const) {
  const registry = getDefaultScriptEventRenderRegistry();
  for (const [index, row] of privateCases.entries())
    test(`${locale}: private event ${index} ${row.event.type} respects the terminal flag`, () => {
      const before = structuredClone(row.event);
      expect(registry.toLiveRender(row.event, false, locale)).toEqual([]);
      expect(registry.toLiveRender(row.event, true, locale)).toEqual([
        { kind: row.kind, text: locale === "en" ? row.en : row.zh },
      ]);
      expect(row.event).toEqual(before);
    });

  test(`${locale}: disabling private terminal output hides the complete secret event batch`, () => {
    const lines: string[] = [];
    presentStreamEvents(
      privateCases.map((row) => row.event),
      false,
      (line) => lines.push(line),
      locale,
    );
    expect(lines).toEqual([]);
  });

  for (const printPrivateEvents of [false, true])
    test(`${locale}/${printPrivateEvents}: public announcements remain visible without exposing their hidden causes`, () => {
      const rows = [
        event("bear_roared", { day: 2, roared: true }),
        event("night_resolved", { deaths: [] }),
        event("exile_target_mapped", { requestedId: 3, effectiveId: 7, missed: false }),
      ];
      const lines: string[] = [];
      presentStreamEvents(rows, printPrivateEvents, (line) => lines.push(line), locale);
      expect(lines).toEqual(
        locale === "en"
          ? [
              "[live][God] Day 2: Bear roared",
              "[live][God] No deaths last night",
              "[live][God] Ballot winner: 3; actual exile target: 7.",
            ]
          : [
              "[live][上帝] 第2天：熊咆哮了",
              "[live][上帝] 昨夜是平安夜",
              "[live][上帝] 原票目标为3号，实际放逐目标为7号。",
            ],
      );
    });
}
