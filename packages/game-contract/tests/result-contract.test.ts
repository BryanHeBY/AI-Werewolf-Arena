/**
 * 包级单元／类型契约测试验证结果与失败数据的提取边界。
 * 独立迁移前枚举字面记录和传输样本构成预期，编译负例保留枚举成员与原始字符串的区别。
 * 胜利、关系和死亡来源是声明数据；本文件不导入引擎结算、领域回调、World、目录或词典。
 * 运行资格与原生命选择不在此纯契约内，其应用兼容出口另行验证。
 */
import { describe, expect, test } from "bun:test";
import {
  Camp,
  Phase,
  RuleError,
  DeathCause,
  FACTION_IDS,
  VICTORY_CHECKPOINTS,
  type RuleViolation,
  type FactionId,
  type VictoryPoint,
  type VictoryAffiliation,
  type VictoryTarget,
  type VictoryClaim,
  type GameOutcome,
  type SealedVictoryResult,
  type InspectionResult,
  type InspectionKind,
  type GameResult,
  type WinDecision,
  type SeerCheckResult,
  type NightSummary,
  type DaySummary,
  type VotingSummary,
  type RuntimeSnapshot,
  type DeathSources,
} from "@ai-werewolf-arena/game-contract";
import { RuleError as LeafRuleError } from "../src/errors";
import { DeathCause as LeafDeathCause } from "../src/death-facts";
// @ts-expect-error Runtime original-life handles and callbacks are not a public data export.
import type { DeathShotSelection } from "@ai-werewolf-arena/game-contract";
// @ts-expect-error Eligibility policy algorithms stay in the domain.
import type { permitsDeathShot } from "@ai-werewolf-arena/game-contract";

// 固定的原枚举值；它们不是生产数据源或由规则生成的预期。
const originalEnums = {
  RuleError: {
    AnimalActionUnavailable: "animal_action_unavailable",
    FragrantPairUnavailable: "fragrant_pair_unavailable",
    NobleBodyUnavailable: "noble_body_unavailable",
    RadiantShelterUnavailable: "radiant_shelter_unavailable",
    RadiantShelterTarget: "radiant_shelter_target",
    EclipseSwallowUnavailable: "eclipse_swallow_unavailable",
    EclipseSwallowTarget: "eclipse_swallow_target",
    MistUnavailable: "mist_unavailable",
    MistTarget: "mist_target",
    SnakeUnavailable: "snake_unavailable",
    SnakeTarget: "snake_target",
    RavenKnifeUnavailable: "raven_knife_unavailable",
    RavenKnifeTarget: "raven_knife_target",
    ModifierUnavailable: "modifier_unavailable",
    ModifierTarget: "modifier_target",
    TimeConsortUnavailable: "time_consort_unavailable",
    TimeConsortTarget: "time_consort_target",
    WolfSorcererUnavailable: "wolf_sorcerer_unavailable",
    WolfSorcererTarget: "wolf_sorcerer_target",
    TricksterUnavailable: "trickster_unavailable",
    TricksterTarget: "trickster_target",
    OrderPrinceUnavailable: "order_prince_unavailable",
    MagicianUnavailable: "magician_unavailable",
    MagicianTarget: "magician_target",
    NightmareUnavailable: "nightmare_unavailable",
    NightmareTarget: "nightmare_target",
    GhostBrideUnavailable: "ghost_bride_unavailable",
    GhostBrideChoice: "ghost_bride_choice",
    LonelyGirlUnavailable: "lonely_girl_unavailable",
    LonelyGirlChoice: "lonely_girl_choice",
    WildChildUnavailable: "wild_child_unavailable",
    WildChildChoice: "wild_child_choice",
    ThiefUnavailable: "thief_unavailable",
    ThiefChoice: "thief_choice",
    ShapeshifterUnavailable: "shapeshifter_unavailable",
    ShapeshifterChoice: "shapeshifter_choice",
    WallNoteUnavailable: "wall_note_unavailable",
    WallNoteText: "wall_note_text",
    BadgeChoiceUnavailable: "badge_choice_unavailable",
    BadgeChoiceTarget: "badge_choice_target",
    AbstainTargetNull: "abstain_target_null",
    ActorDead: "actor_dead",
    ActorMissing: "actor_missing",
    ActorRoleMissing: "actor_role_missing",
    DeathActionUnavailable: "death_action_unavailable",
    AbilityPhase: "ability_phase",
    BlastConfirm: "blast_confirm",
    BlastDisabled: "blast_disabled",
    BlastPhase: "blast_phase",
    BlastWindow: "blast_window",
    CheckTarget: "check_target",
    SeerTargetPolicy: "seer_target_policy",
    PkVoteEligibility: "pk_vote_eligibility",
    PkVoteTarget: "pk_vote_target",
    CustomRuleError: "custom_rule_error",
    GuardOnly: "guard_only",
    GuardRepeat: "guard_repeat",
    GuardTarget: "guard_target",
    HealUnavailable: "heal_unavailable",
    HealTarget: "heal_target",
    KillTarget: "kill_target",
    PoisonTarget: "poison_target",
    PoisonUnavailable: "poison_unavailable",
    ReportCategory: "invalid_report_bug_category",
    ReportMessageEmpty: "invalid_report_bug_message_empty",
    ReportMessageLong: "invalid_report_bug_message_too_long",
    ReportSeverity: "invalid_report_bug_severity",
    SeerOnly: "seer_only",
    RoleInspectUnavailable: "role_inspection_unavailable",
    RoleInspectTarget: "role_inspection_target",
    RoleInspectRepeat: "role_inspection_repeat",
    MechanicalUnavailable: "mechanical_unavailable",
    MechanicalTarget: "mechanical_target",
    AwakenedUnavailable: "awakened_unavailable",
    AwakenedTarget: "awakened_target",
    AwakenedGuardRepeat: "awakened_guard_repeat",
    LuckyTargetRepeat: "lucky_target_repeat",
    MerchantUnavailable: "merchant_unavailable",
    MerchantTarget: "merchant_target",
    BlackMarketSkill: "black_market_skill",
    MerchantSkill: "merchant_skill",
    HybridUnavailable: "hybrid_unavailable",
    HybridTarget: "hybrid_target",
    DebateUnavailable: "debate_unavailable",
    DebateTarget: "debate_target",
    DebateBallot: "debate_ballot",
    CupidUnavailable: "cupid_unavailable",
    CupidTarget: "cupid_target",
    LoversVote: "lovers_vote",
    SelfHeal: "self_heal",
    SheriffDirectionOnly: "sheriff_direction_only",
    SheriffDirectionPhase: "sheriff_direction_phase",
    SheriffNominationPhase: "sheriff_nomination_phase",
    SheriffNominationEligibility: "sheriff_nomination_eligibility",
    SheriffVoteEligibility: "sheriff_vote_eligibility",
    SheriffRunBoolean: "sheriff_run_boolean",
    SheriffVotePhase: "sheriff_vote_phase",
    SheriffVoteTarget: "sheriff_vote_target",
    ShootTarget: "shoot_target",
    ShootUnavailable: "shoot_unavailable",
    ToolMismatch: "tool_mismatch",
    TwoPotions: "two_potions",
    UnknownTool: "unknown_tool",
    VoteRight: "vote_right",
    VoteTarget: "vote_target",
    WitchOnly: "witch_only",
    WolfBlastOnly: "wolf_blast_only",
    WhiteWolfBlastUnavailable: "white_wolf_blast_unavailable",
    WhiteWolfBlastTarget: "white_wolf_blast_target",
    BeautySelfKnife: "beauty_self_knife",
    CharmUnavailable: "charm_unavailable",
    CharmTarget: "charm_target",
    CharmRepeat: "charm_repeat",
    DreamUnavailable: "dream_unavailable",
    DreamTarget: "dream_target",
    KnightDuelUnavailable: "knight_duel_unavailable",
    KnightDuelWindow: "knight_duel_window",
    KnightDuelTarget: "knight_duel_target",
    KnightDuelConfirm: "knight_duel_confirm",
    WolfOnly: "wolf_only",
    WolfChatPermission: "wolf_chat_permission",
    WolfChatPhase: "wolf_chat_phase",
    WolfKillPermission: "wolf_kill_permission",
    WolfKillPhase: "wolf_kill_phase",
  },
  DeathCause: {
    WhiteCatExpiry: "white_cat_expiry",
    PufferRetaliation: "puffer_retaliation",
    FragrantLink: "fragrant_link",
    ServantExpiry: "servant_expiry",
    RadiantBacklash: "radiant_backlash",
    RavenClawKnife: "raven_claw_knife",
    WolfKill: "wolf_kill",
    Poison: "poison",
    EvilKnightReflection: "evil_knight_reflection",
    PureWhiteInspection: "pure_white_inspection",
    WolfWitchInspection: "wolf_witch_inspection",
    DemonHunt: "demon_hunt",
    DemonHuntBacklash: "demon_hunt_backlash",
    Shot: "shot",
    Exile: "exile",
    RedMoonExpiry: "red_moon_expiry",
    SelfDestruct: "self_destruct",
    WhiteWolfBlast: "white_wolf_blast",
    Lovers: "lovers",
    Dream: "dream",
    FoxInspection: "fox_inspection",
    Charm: "charm",
    Duel: "duel",
    DuelFailure: "duel_failure",
    Ability: "ability",
    MechanicalKnife: "mechanical_knife",
    AwakenedHiddenKnife: "awakened_hidden_knife",
    MechanicalGuardFailure: "mechanical_guard_failure",
    MerchantBacklash: "merchant_backlash",
    BlackMarketBacklash: "black_market_backlash",
  },
} as const;

describe("pure result and failure public contract", () => {
  test("RuleError retains all 124 keys, values, member order and its frozen singleton", () => {
    expect<unknown>(RuleError).toEqual(originalEnums.RuleError);
    expect(Object.keys(RuleError)).toEqual(Object.keys(originalEnums.RuleError));
    expect<unknown>(Object.values(RuleError)).toEqual(Object.values(originalEnums.RuleError));
    expect(RuleError).toBe(LeafRuleError);
    expect(Object.isFrozen(RuleError)).toBe(true);
    expect(Reflect.set(RuleError, "ActorDead", "mutated_failure")).toBe(false);
    expect(String(RuleError.ActorDead)).toBe("actor_dead");
  });

  test("DeathCause retains all 30 original keys, values and order without introducing a freeze", () => {
    const expected = { ...originalEnums.DeathCause, Deal: "deal" };
    expect<unknown>(DeathCause).toEqual(expected);
    expect(Object.keys(DeathCause)).toEqual(Object.keys(expected));
    expect<unknown>(Object.values(DeathCause)).toEqual(Object.values(expected));
    expect(DeathCause).toBe(LeafDeathCause);
    expect(Object.isFrozen(DeathCause)).toBe(false);
    const member: DeathCause.WolfKill = DeathCause.WolfKill;
    const errorMember: RuleError.ActorDead = RuleError.ActorDead;
    // @ts-expect-error Original enum member types remain narrow.
    const wrongCause: DeathCause.WolfKill = DeathCause.Poison;
    // @ts-expect-error Original error enum member types remain narrow.
    const wrongError: RuleError.ActorDead = RuleError.ActorMissing;
    void [wrongCause, wrongError];
    expect(String(member)).toBe("wolf_kill");
    expect(String(errorMember)).toBe("actor_dead");
  });

  test("faction/checkpoint IDs and affiliation alternatives retain raw protocol strings", () => {
    expect(FACTION_IDS).toEqual(["good", "wolf", "third_party"]);
    expect(VICTORY_CHECKPOINTS).toEqual([
      "night_settled",
      "day_interrupted",
      "exile_settled",
      "max_days_reached",
    ]);
    const faction: FactionId = "good";
    const point: VictoryPoint = { day: 2, phase: "voting", checkpoint: "exile_settled" };
    const affiliations: VictoryAffiliation[] = [
      { kind: "faction", faction },
      { kind: "individual", goalId: "custom raw goal" },
      { kind: "relationship", groupId: "original-group" },
    ];
    const target: VictoryTarget = { kind: "individual", goalId: "custom raw goal", playerId: 7 };
    expect(JSON.parse(JSON.stringify({ point, affiliations, target }))).toEqual({
      point: { day: 2, phase: "voting", checkpoint: "exile_settled" },
      affiliations: [
        { kind: "faction", faction: "good" },
        { kind: "individual", goalId: "custom raw goal" },
        { kind: "relationship", groupId: "original-group" },
      ],
      target: { kind: "individual", goalId: "custom raw goal", playerId: 7 },
    });
  });

  test("engine Camp fields remain nominal while sealed archive winners accept raw faction strings", () => {
    const primary: VictoryClaim = { kind: "faction", faction: "good", winningPlayerIds: [2, 7] };
    const outcome: GameOutcome = {
      kind: "victory",
      primary,
      additional: [],
      winningPlayerIds: [2, 7],
    };
    const point: VictoryPoint = { day: 2, phase: "voting", checkpoint: "exile_settled" };
    const engine: GameResult = {
      winner: Camp.Good,
      reason: "Custom reason {role}\nOriginal",
      outcome,
      decidedAt: point,
    };
    const sealed: SealedVictoryResult = {
      winner: "good",
      reason: engine.reason,
      outcome,
      decidedAt: point,
    };
    const decision: WinDecision = { winner: Camp.Good, reason: engine.reason, outcome };
    // @ts-expect-error GameResult keeps the original Camp enum field, not a raw FactionId alias.
    const rawEngineWinner: GameResult["winner"] = "good";
    void rawEngineWinner;
    expect(JSON.parse(JSON.stringify(engine))).toEqual(sealed);
    expect(Object.hasOwn(decision, "decidedAt")).toBe(false);
    expect(engine.reason).toBe("Custom reason {role}\nOriginal");
    const none: GameOutcome = { kind: "no_winner" };
    const inProgress: RuntimeSnapshot = {
      day: 1,
      phase: Phase.Night,
      gameOver: false,
      result: null,
    };
    expect(JSON.stringify(none)).toBe('{"kind":"no_winner"}');
    expect(inProgress).toEqual({ day: 1, phase: Phase.Night, gameOver: false, result: null });
  });

  test("inspection alternatives stay closed while SeerCheckResult accepts only camp inspection", () => {
    const results: InspectionResult[] = [
      { kind: "camp", camp: "wolf" },
      { kind: "role", role: "awakened_knight" },
      { kind: "combined", role: "wolf", camp: "good" },
    ];
    const kind: InspectionKind = "combined";
    const check: SeerCheckResult = {
      seerId: 5,
      targetId: 1,
      isWerewolf: true,
      result: { kind: "camp", camp: "wolf" },
    };
    // @ts-expect-error An unregistered raw role is not part of the machine RoleId union.
    const inventedRole: InspectionResult = { kind: "role", role: "invented_role" };
    // @ts-expect-error SeerCheckResult preserves the camp-only discriminated subset.
    const roleOnlyCheck: SeerCheckResult["result"] = { kind: "role", role: "wolf" };
    void [inventedRole, roleOnlyCheck];
    expect(results.map((item) => item.kind)).toEqual(["camp", "role", "combined"]);
    expect(kind).toBe("combined");
    expect(check.result).toEqual({ kind: "camp", camp: "wolf" });
  });

  test("optional exile outcome and nullable phase summaries retain their original wire fields", () => {
    const base: VotingSummary = { tally: { 1: 1.5 }, target: 1, removed: [] };
    const nullEffective: VotingSummary = { ...base, effectiveTarget: null };
    const mapped: VotingSummary = { ...base, effectiveTarget: 4 };
    const night: NightSummary = {
      wolfTarget: null,
      deaths: [],
      seerChecks: [],
      interruptedBySelfDestruct: false,
    };
    const day: DaySummary = {
      speeches: [{ actorId: 4, text: "Exact custom text" }],
      selfDestructBy: null,
    };
    const sources: DeathSources = { 4: [DeathCause.WolfKill, DeathCause.Exile] };
    const custom: RuleViolation = {
      code: RuleError.CustomRuleError,
      message: "Exact original message {role}",
    };
    const ordinary: RuleViolation = { code: RuleError.ActorDead };
    expect(JSON.parse(JSON.stringify([base, nullEffective, mapped]))).toEqual([
      { tally: { 1: 1.5 }, target: 1, removed: [] },
      { tally: { 1: 1.5 }, target: 1, removed: [], effectiveTarget: null },
      { tally: { 1: 1.5 }, target: 1, removed: [], effectiveTarget: 4 },
    ]);
    expect(JSON.parse(JSON.stringify({ night, day, sources, custom, ordinary }))).toEqual({
      night: { wolfTarget: null, deaths: [], seerChecks: [], interruptedBySelfDestruct: false },
      day: { speeches: [{ actorId: 4, text: "Exact custom text" }], selfDestructBy: null },
      sources: { 4: ["wolf_kill", "exile"] },
      custom: { code: "custom_rule_error", message: "Exact original message {role}" },
      ordinary: { code: "actor_dead" },
    });
  });
});
