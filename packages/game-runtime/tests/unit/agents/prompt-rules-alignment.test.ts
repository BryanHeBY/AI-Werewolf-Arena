/**
 * 使用真实能力安装、提示策略和纯内存关系验证规则说明与本局政策对齐。
 * 预期编号、权限和规则片段来自明确场景；不调用模型，不借助真实隐藏阵营补全玩家信息。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type BoardConfig,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import {
  bindTargetHintContext,
  DefaultTargetHintRegistry,
} from "../../../src/agents/tool-repair/target-hint-registry";
import {
  buildPlayerStageContextHint,
  buildPlayerStatusDirective,
} from "../../../src/agents/observation/player-prompt-directives";
import { grantNightAbility } from "../../../src/features/night-abilities/night-ability-grants";
import { installNativeAbility } from "../../../src/features/night-abilities/ability-changes";
import { findNightAbility } from "../../../src/features/night-abilities/abilities";
import { recordOwnNightAction } from "../../../src/features/night-abilities/night-action-history";
import { DefaultConfigRenderRegistry } from "../../../src/agents/prompt/config-render-registry";
import { bindLovers, projectLover } from "../../../src/features/cupid/relation";
import { captureNightLife } from "../../../src/domain/night-effects";
import { getDefaultRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import type { Locale } from "@ai-werewolf-arena/game-contract";

const roles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
const fixture = (locale: Locale = "zh-CN") =>
  bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale });
const request = (
  context: Partial<ActionRequest["context"]>,
  tools: ActionRequest["allowedTools"] = ["use_potion"],
): ActionRequest => ({
  actorId: 3,
  phase: Phase.Night,
  allowedTools: tools,
  context: { day: 1, stage: "witch", visible_events: [], turn_constraints: {}, ...context },
});
const ids = (hint: string | undefined) => hint?.match(/\b\d+\b/g)?.map(Number) ?? [];

for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: 典狱长目标约束保留请求授权的刀口，未知刀口不擅自补全`, () => {
    const queries = { locale: () => locale, boardConfig: () => undefined };
    for (const wolf_target of [3, 4, null, undefined]) {
      const actual = buildPlayerStageContextHint(
        request({ warden_forced_target: 4, wolf_target }),
        queries,
      )!;
      expect(actual).toContain(locale === "zh-CN" ? "4号" : "4");
      if (typeof wolf_target === "number")
        expect(actual).toContain(
          locale === "zh-CN"
            ? `刀口是${wolf_target}号`
            : `wolf target revealed to you is player ${wolf_target}`,
        );
      else if (wolf_target === null)
        expect(actual).toContain(
          locale === "zh-CN" ? "刀口为空" : "wolf target revealed to you is empty",
        );
      else expect(actual).toContain(locale === "zh-CN" ? "刀口信息" : "wolf target");
    }
    const multiple = buildPlayerStageContextHint(
      request({ warden_forced_target: 4, wolf_targets: [2, 5] }),
      queries,
    )!;
    expect(multiple).toContain("2, 5");
  });

  test(`${locale}: 原生查验按实例政策允许自验，新的他人目标策略排除自身与历史目标`, () => {
    const { world } = fixture(locale),
      role = world.getComponent(3, COMPONENT.Role)!;
    const registry = new DefaultTargetHintRegistry();
    const context = {
      world,
      actorId: 3,
      actorRole: Role.Seer,
      day: 1,
      allowedTools: ["check_identity" as const],
    };
    expect(ids(registry.buildActionableIdsHint(bindTargetHintContext(context)))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    installNativeAbility(role, "seer_check", {
      lastTarget: 2,
      lastIsWerewolf: true,
      targetPolicy: "awa_fresh_others_v1",
      history: [{ targetId: 2, isWerewolf: true }],
    });
    const hint = registry.buildActionableIdsHint(bindTargetHintContext(context));
    expect(ids(hint)).toEqual([1, 4, 5, 6]);
    expect(hint).toContain(locale === "zh-CN" ? "不含你自己" : "excluding yourself");
    expect(findNightAbility(role, "seer_check")!.uses).toBe(0);
  });

  for (const activation of [undefined, "lucky", "black_market"] as const)
    test(`${locale}: ${activation ?? "普通复制"}查验使用本轮绑定实例，保留受赠目标限制`, () => {
      const { world } = fixture(locale),
        role = world.getComponent(3, COMPONENT.Role)!;
      const original = findNightAbility(role, "seer_check")!;
      const ability = grantNightAbility(
        world,
        5,
        {
          id:
            activation === "black_market"
              ? "gift:black-market"
              : activation
                ? "gift:lucky"
                : "copy:test",
          kind: "seer_check",
          state: { lastTarget: null, lastIsWerewolf: null, history: [] },
          source: activation
            ? { kind: "gift", actorId: 3 }
            : { kind: "copy", actorId: 3, abilityId: original.id },
          startsOnDay: 2,
          maxUses: activation ? 1 : null,
          ...(activation ? { activation } : {}),
        },
        [],
      );
      const registry = new DefaultTargetHintRegistry(),
        source = {
          world,
          actorId: 5,
          actorRole: Role.Seer,
          day: 2,
          abilityId: ability.id,
          allowedTools: ["check_identity" as const],
        };
      expect(ids(registry.buildActionableIdsHint(bindTargetHintContext(source)))).toEqual(
        activation ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 5, 6],
      );
      if (activation) {
        recordOwnNightAction(world, 5, 2, "check", 2, true, activation);
        expect(ids(registry.buildActionableIdsHint(bindTargetHintContext(source)))).toEqual([
          1, 3, 4, 6,
        ]);
      }
      expect(ability.uses).toBe(0);
      expect(ability.state.history).toEqual([]);
    });

  test(`${locale}: 典狱长候选只保留强制对象，不能绕过查验政策或取得提交权`, () => {
    const { world } = fixture(locale),
      registry = new DefaultTargetHintRegistry();
    const source = {
      world,
      actorId: 3,
      actorRole: Role.Seer,
      day: 1,
      allowedTools: ["check_identity" as const],
      wardenForcedTarget: 4,
    };
    expect(ids(registry.buildActionableIdsHint(bindTargetHintContext(source)))).toEqual([4]);
    installNativeAbility(world.getComponent(3, COMPONENT.Role)!, "seer_check", {
      lastTarget: 4,
      lastIsWerewolf: false,
      targetPolicy: "awa_fresh_others_v1",
      history: [{ targetId: 4, isWerewolf: false }],
    });
    expect(ids(registry.buildActionableIdsHint(bindTargetHintContext(source)))).toEqual([]);
    expect(world.activeDeathActionCount).toBe(0);
  });

  test(`${locale}: 同时持有不同查验实例时，只读取本轮绑定实例的自身与去重政策`, () => {
    const { world } = fixture(locale),
      role = world.getComponent(3, COMPONENT.Role)!;
    const native = findNightAbility(role, "seer_check")!;
    const copied = grantNightAbility(
      world,
      3,
      {
        id: "copy:fresh",
        kind: "seer_check",
        state: {
          lastTarget: 2,
          lastIsWerewolf: true,
          targetPolicy: "awa_fresh_others_v1",
          history: [{ targetId: 2, isWerewolf: true }],
        },
        source: { kind: "copy", actorId: 3, abilityId: native.id },
        startsOnDay: 1,
        maxUses: null,
      },
      [],
    );
    grantNightAbility(
      world,
      3,
      {
        id: "gift:lucky",
        kind: "seer_check",
        state: { lastTarget: null, lastIsWerewolf: null, history: [] },
        source: { kind: "gift", actorId: 4 },
        startsOnDay: 1,
        maxUses: 1,
        activation: "lucky",
      },
      [],
    );
    const registry = new DefaultTargetHintRegistry(),
      source = {
        world,
        actorId: 3,
        actorRole: Role.Seer,
        day: 1,
        allowedTools: ["check_identity" as const],
      };
    expect(
      ids(
        registry.buildActionableIdsHint(bindTargetHintContext({ ...source, abilityId: native.id })),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      ids(
        registry.buildActionableIdsHint(bindTargetHintContext({ ...source, abilityId: copied.id })),
      ),
    ).toEqual([1, 4, 5, 6]);
    expect(
      ids(
        registry.buildActionableIdsHint(
          bindTargetHintContext({ ...source, abilityId: "gift:lucky" }),
        ),
      ),
    ).toEqual([1, 2, 4, 5, 6]);
    expect(native.uses).toBe(0);
    expect(copied.state.history).toEqual([{ targetId: 2, isWerewolf: true }]);
  });

  test(`${locale}: 公开板规则包含普通守救抵消，且不把独立保护一并取消`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.Wolf, count: 2 },
        { role: Role.Seer, count: 1 },
        { role: Role.Guard, count: 1 },
        { role: Role.Witch, count: 1 },
        { role: Role.Villager, count: 1 },
      ],
    };
    const prompt = new DefaultConfigRenderRegistry().renderBoardConfigPrompt(config, locale);
    expect(prompt).toContain(locale === "zh-CN" ? "不能挡毒药" : "not poison");
    expect(prompt).toContain(locale === "zh-CN" ? "相互抵消" : "cancel each other");
    expect(prompt).toContain(locale === "zh-CN" ? "不随同守同救一起抵消" : "not cancelled with");
    expect(
      new DefaultConfigRenderRegistry().renderBoardConfigPrompt(sixPlayerMvpConfig, locale),
    ).not.toContain(locale === "zh-CN" ? "夜间保护规则" : "Night protection:");
  });

  for (const policy of ["awa_final_candidates_v1", "awa_nomination_offstage_pk_v1"] as const)
    for (const round of [1, 2] as const)
      test(`${locale}: 警长 ${policy} 第${round}轮说明与真实选民政策一致`, () => {
        const req = request(
          { day: 2, stage: round === 2 ? "sheriff_pk_vote" : "sheriff_vote", round },
          ["vote_for_sheriff"],
        );
        const prompt = buildPlayerStageContextHint(req, {
          locale: () => locale,
          boardConfig: () =>
            ({ enableSheriff: true, sheriff: { electionPolicy: policy } }) as BoardConfig,
        })!;
        expect(prompt).toContain(
          locale === "zh-CN"
            ? round === 2
              ? "PK"
              : policy === "awa_final_candidates_v1"
                ? "退水"
                : "最初"
            : round === 2
              ? "PK"
              : policy === "awa_final_candidates_v1"
                ? "withdrawn"
                : "did not nominate",
        );
      });

  for (const policy of ["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"] as const)
    test(`${locale}: 非丘比特情侣知道本局条件胜利规则，但不获知伴侣阵营`, () => {
      const { world } = fixture(locale),
        actor = world.getComponent(5, COMPONENT.Role)!;
      bindLovers(
        world,
        {
          actorId: 4,
          day: 1,
          policy,
          pairIds: [5, 1],
          pairCamps: [Camp.Good, Camp.Wolf],
          mixed: true,
          groupId: "cupid_lovers",
        },
        [captureNightLife(world, 5)!, captureNightLife(world, 1)!],
      );
      const req = { ...request({ stage: "day_speech" }, ["speak"]), actorId: 5 };
      const state = buildPlayerStatusDirective(req, actor, {
        world: () => world,
        locale: () => locale,
        catalog: () => getDefaultRoleCatalog(),
        wolfTeammates: () => [],
      })!;
      expect(state).toContain(locale === "zh-CN" ? "双好情侣" : "Two Good lovers");
      expect(state).toContain(locale === "zh-CN" ? "双狼情侣" : "two Wolf lovers");
      expect(state).toContain(locale === "zh-CN" ? "人狼恋" : "Mixed lovers");
      expect(state).toContain(policy === "lui_meme_lovers_only_v1" ? "Lui-même" : "2017");
      expect(state).not.toContain('"mixed"');
      expect(state).not.toContain('"pairCamps"');
      expect(state).not.toContain('"groupId"');
      expect(Object.keys(projectLover(world, 5)!).sort()).toEqual([
        "mayNotVotePartner",
        "partnerId",
        "policy",
      ]);
      const publicRules = new DefaultConfigRenderRegistry().renderBoardConfigPrompt(
        { ...sixPlayerMvpConfig, cupid: { policy } },
        locale,
      );
      expect(publicRules).toContain(locale === "zh-CN" ? "双好情侣" : "Two Good lovers");
      expect(publicRules).not.toContain('"pairCamps"');
      if (policy === "netease_2017_cupid_follows_lovers_v1") {
        const defaultPolicyRules = new DefaultConfigRenderRegistry().renderBoardConfigPrompt(
          {
            ...sixPlayerMvpConfig,
            roleSetups: sixPlayerMvpConfig.roleSetups.map((entry) =>
              entry.role === Role.Seer ? { ...entry, role: Role.Cupid } : entry,
            ),
          },
          locale,
        );
        expect(defaultPolicyRules).toContain("2017");
        expect(defaultPolicyRules).toContain(locale === "zh-CN" ? "双好情侣" : "Two Good lovers");
      }
    });
}
