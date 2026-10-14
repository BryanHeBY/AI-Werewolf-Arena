/**
 * 负责全 55 个内建角色在展示时的具体状态捕获。输入为原角色对象、当前语言和原上下文
 * World 引用及晚读当前阵营 source；输出为原拼接规则的提示字符串，每次只把已选标量／已序列化知识交纯展示包，立即完成该片段后才继续读后段。
 * 原生文案使用原不绑定 ability_id 的选择规则，不能用请求观察的赠予／借用状态替代。
 * 这里不复制库存、不授予权限、不提前读取 World 或冻结演员；失败保留已读取前缀。
 */
import type { Locale, InspectionResult } from "@ai-werewolf-arena/game-contract";
import {
  Role,
  type NativeRolePresentationId,
  type NativeRoleMessageKey,
  type NativeRoleMessageParameters,
  type NativeRoleMessagePart,
  type RoleInspectionReadState,
} from "@ai-werewolf-arena/game-contract";
import { formatNativeRolePart } from "@ai-werewolf-arena/game-presentation";
import type { RoleComponent } from "../../core/domain/components/role";
import type { World } from "../../core/domain/world";
import type { CurrentCampSource } from "../../core/domain/components/camp";
import { COMPONENT } from "../../core/domain/components/names";
import { inspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import { nativeMirror, freshMirrorInspectionState } from "../mechanisms/roles/mirror_girl/ports";
import { getTimeConsortState } from "../mechanisms/roles/time_wolf_consort/ports";
import { getWolfSorcererState } from "../mechanisms/roles/wolf_sorcerer/ports";
import { getMagicianState } from "../mechanisms/roles/magician/ports";
import { getRedMoonState } from "../mechanisms/roles/red_moon_apostle/ports";
import { getNightmareShadowState } from "../mechanisms/roles/nightmare_shadow/ports";
import { getEvilKnightState } from "../mechanisms/roles/evil_knight/ports";
import { projectDemonHunter } from "../mechanisms/roles/demon_hunter/ports";
import { weddingBrideState } from "../mechanisms/roles/ghost_bride/ports";
import { projectWildChild } from "../mechanisms/roles/wild_child/ports";
import { projectLonelyGirl } from "../mechanisms/roles/lonely_girl/ports";
import { projectThiefState } from "../mechanisms/roles/thief/ports";
import { projectShapeshifterState } from "../mechanisms/roles/shapeshifter/ports";
import { getWolfKingState } from "../mechanisms/roles/wolf_king/ports";
import { getWhiteWolfKingState } from "../mechanisms/roles/white_wolf_king/ports";
import { getKnightState } from "../mechanisms/roles/knight/ports";
import { getGravekeeperState } from "../mechanisms/roles/gravekeeper/ports";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";
import { getDreamerState } from "../mechanisms/roles/dreamer/ports";
import { isAnimalDreamBoard } from "../mechanisms/roles/animal_dream/ports";
import { animalBeautyKnowledge } from "../mechanisms/roles/animal_dream/ports";
import { getWolfBeautyState } from "../mechanisms/roles/wolf_beauty/ports";
import { animalBearKnowledge } from "../mechanisms/roles/animal_dream/ports";
import { getBearState } from "../mechanisms/roles/bear/ports";
import { getCupidState } from "../mechanisms/roles/cupid/ports";
import { projectCupidState } from "../mechanisms/roles/cupid/ports";
import { projectDebaterState } from "../mechanisms/roles/debater/ports";
import { getDebaterState } from "../mechanisms/roles/debater/ports";
import { hasDebateCommit } from "../mechanisms/roles/debater/ports";
import { getHiddenWolfState } from "../mechanisms/roles/hidden_wolf/ports";
import { canHiddenWolfKnife } from "../mechanisms/roles/hidden_wolf/ports";
import { getRoleInspectionState } from "../mechanisms/roles/role_inspection/ports";
import { getGargoyleState } from "../mechanisms/roles/gargoyle/ports";
import { canGargoyleKnife } from "../mechanisms/roles/gargoyle/ports";
import { getMechanicalState } from "../mechanisms/roles/mechanical_wolf/ports";
import { projectMechanicalState } from "../mechanisms/roles/mechanical_wolf/ports";
import { projectMerchantState } from "../mechanisms/roles/miracle_merchant/ports";
import { getMerchantState } from "../mechanisms/roles/miracle_merchant/ports";
import { projectBlackMarketState } from "../mechanisms/roles/black_market_merchant/ports";
import { getBlackMarketState } from "../mechanisms/roles/black_market_merchant/ports";
import { projectHybridState } from "../mechanisms/roles/hybrid/ports";
import { getHybridState } from "../mechanisms/roles/hybrid/ports";
import { getAwakenedState } from "../mechanisms/roles/awakened_hidden_wolf/ports";
import { projectAwakenedState } from "../mechanisms/roles/awakened_hidden_wolf/ports";
import { getSeerState } from "../mechanisms/roles/seer/ports";
import { getGuardState } from "../mechanisms/roles/guard/ports";
import { getWitchState } from "../mechanisms/roles/witch/ports";
import { getHunterState } from "../mechanisms/roles/hunter/ports";

/** 只把原参数对象传给纯格式化器；不在它之前读取后续角色字段。 */
function nativeText<K extends NativeRoleMessageKey>(
  locale: Locale,
  key: K,
  ...args: NativeRoleMessageParameters[K] extends undefined ? [] : [NativeRoleMessageParameters[K]]
): string {
  // 泛型 key／参数关联由上面的有限契约检查；运行时仍用原文字校验规则拒绝缺失参数。
  return formatNativeRolePart(
    { kind: "message", key, parameters: args[0] } as NativeRoleMessagePart,
    locale,
  );
}
function nativeRoleName(role: string, locale: Locale): string {
  return formatNativeRolePart({ kind: "role-label", role }, locale);
}
function nativeTerm(_kind: "camp", camp: string, locale: Locale): string {
  return formatNativeRolePart({ kind: "camp-label", camp }, locale);
}
function nativeDeathPolicy(policy: string | undefined, locale: Locale): string {
  return formatNativeRolePart({ kind: "death-policy", policy }, locale);
}
/** 保留原查验结果字段的逐次读取和格式化顺序；展示包不接 live result 句柄。 */
function nativeInspectionLabel(result: InspectionResult, locale: Locale): string {
  if (result.kind === "camp") return nativeTerm("camp", result.camp, locale);
  if (result.kind === "role") return nativeRoleName(result.role, locale);
  return nativeText(locale, "inspection.combined", {
    role: nativeRoleName(result.role, locale),
    camp: nativeTerm("camp", result.camp, locale),
  });
}
function nativeInspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
  locale: Locale,
): string {
  return nativeText(
    locale,
    inspectionPolicy(state) === "awa_repeat_optional_v1"
      ? "role.inspection.repeat_optional"
      : inspectionPolicy(state) === "awa_unique_required_v1"
        ? "role.inspection.unique_required"
        : "role.inspection.unique_optional",
  );
}
function inspectionPrompt(role: RoleComponent, locale: Locale, wolf: boolean): string {
  const report = getRoleInspectionState(role)?.history.at(-1);
  return (
    nativeText(locale, wolf ? "role.wolf_witch.state" : "role.pure_white_girl.state") +
    (report
      ? " " +
        nativeText(locale, "inspection.latest", {
          target: report.targetId,
          result: nativeInspectionLabel(report.result, locale),
        })
      : "")
  );
}

const capture_white_cat = (_role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.white_cat.brief");

const capture_fox_cub = (_role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.fox_cub.brief");

const capture_pufferfish = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.pufferfish.brief");

const capture_fragrant_phantom = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.fragrant_phantom.brief");

const capture_awakened_seer = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.awakened_seer.brief");

const capture_night_noble = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.night_noble.brief");

const capture_awakened_idiot = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.awakened_idiot.brief");

const capture_radiant_count = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.radiant_count.brief");

const capture_eclipse_maid = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.eclipse_maid.brief");

const capture_alchemist = (_role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.alchemist.brief");

const capture_raven_claw_wolf = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.raven_claw_wolf.brief");

const capture_day_scholar = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, false ? "role.night_mentor.brief" : "role.day_scholar.brief");

const capture_night_mentor = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, true ? "role.night_mentor.brief" : "role.day_scholar.brief");

const capture_time_wolf_consort = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined, currentCamp: CurrentCampSource,
): string =>
  nativeText(locale, "role.time_wolf_consort.brief") +
  " " +
  nativeText(
    locale,
    getTimeConsortState(role, currentCamp)?.reflectionScope === "first_effect"
      ? "role.time_wolf_consort.scope_first_effect"
      : "role.time_wolf_consort.scope_whole_night",
  );

const capture_wolf_sorcerer = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined, currentCamp: CurrentCampSource,
): string =>
  nativeText(locale, "role.wolf_sorcerer.brief") +
  " " +
  nativeText(locale, "role.wolf_sorcerer.first_night", {
    day: getWolfSorcererState(role, currentCamp)?.firstNight ?? 2,
  });

const capture_trickster = (_role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.trickster.brief");

const capture_order_prince = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.order_prince.brief");

const capture_magician = (role: RoleComponent, locale: Locale = "zh-CN", world: World | undefined, currentCamp: CurrentCampSource): string => {
  const state = getMagicianState(role, currentCamp);
  return [
    nativeText(locale, "role.magician.brief"),
    nativeText(locale, "role.magician.trickster_rule"),
    nativeText(locale, "role.magician.sorcerer_rule"),
    nativeText(locale, "role.magician.heal_rule"),
    nativeText(locale, "role.magician.first_night", { day: state?.firstNight ?? 1 }),
    nativeText(
      locale,
      state?.deathShotTargetPolicy === "exchanged"
        ? "role.magician.shots_exchanged"
        : "role.magician.shots_original",
    ),
  ].join(" ");
};

const capture_red_moon_apostle = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined, currentCamp: CurrentCampSource,
): string => {
  const state = getRedMoonState(role, currentCamp);
  return (
    nativeText(locale, "role.red_moon_apostle.state", {
      blastDay: state?.blastDay ?? nativeText(locale, "replay.none"),
      exileDay: state?.exileDay ?? nativeText(locale, "replay.none"),
    }) +
    " " +
    nativeText(
      locale,
      state?.lastWolfBlastPolicy === "forbidden"
        ? "role.red_moon_apostle.last_wolf_forbidden"
        : "role.red_moon_apostle.last_wolf_ends",
    )
  );
};

const capture_nightmare = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined, currentCamp: CurrentCampSource,
): string => {
  const state = getNightmareShadowState(role, currentCamp);
  return [
    nativeText(locale, "role.nightmare.state"),
    nativeText(
      locale,
      state?.fearActionPolicy === "required_when_legal"
        ? "role.nightmare.required"
        : "role.nightmare.optional",
    ),
    nativeText(
      locale,
      state?.wolfActionPolicy === "standard"
        ? "role.nightmare.standard"
        : "role.nightmare.no_blast",
    ),
  ].join(" ");
};

const capture_evil_knight = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined, currentCamp: CurrentCampSource,
): string => {
  const state = getEvilKnightState(role, currentCamp);
  return (
    nativeText(locale, "role.evil_knight.state", { remaining: state?.reflectionRemaining ?? 0 }) +
    " " +
    nativeText(
      locale,
      state?.shotPolicy === "hunter_shot_bypasses"
        ? "role.evil_knight.gun_bypasses"
        : "role.evil_knight.gun_immune",
    )
  );
};

const capture_pure_white_girl = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => inspectionPrompt(role, locale, false);

const capture_wolf_witch = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  inspectionPrompt(role, locale, true);

const capture_demon_hunter = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.demon_hunter.state", {
    state: JSON.stringify(world ? projectDemonHunter(world, role) : undefined),
  });

const capture_ghost_bride = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.ghost_bride.state", {
    state: JSON.stringify(
      world
        ? weddingBrideState(
            world,
            world.entityIds().find((id) => world.getComponent(id, COMPONENT.Role) === _role) ?? 0,
          )
        : undefined,
    ),
  });

const capture_wild_child = (role: RoleComponent, locale: Locale = "zh-CN", world: World | undefined, currentCamp: CurrentCampSource): string =>
  nativeText(locale, "role.wild_child.state", {
    camp: (() => {
      // 只在此实际显示字段晚查；缺少必需组件不能把初始化元数据伪装成当前阵营。
      const camp = currentCamp();
      if (!camp) throw new Error("role_current_camp_missing");
      return camp.camp;
    })(),
    state: JSON.stringify(world ? projectWildChild(world, role) : undefined),
  });

const capture_lonely_girl = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.lonely_girl.state", {
    state: JSON.stringify(world ? projectLonelyGirl(world, role) : undefined),
  });

const capture_thief = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.thief.state", {
    state: JSON.stringify(world ? projectThiefState(role, world) : undefined),
  });

const capture_shapeshifter = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.shapeshifter.state", {
    state: JSON.stringify(world ? projectShapeshifterState(role, world) : undefined),
  });

const capture_wolf = (_roleComp: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.wolf.state");

const capture_wolf_king = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(
    locale,
    (getWolfKingState(role)?.deathActionPolicy ?? "awa_qualified_sources_v1") !==
      "awa_qualified_sources_v1"
      ? "role.wolf_king.configured_state"
      : "role.wolf_king.state",
    {
      remaining: getWolfKingState(role)?.canShoot ? 1 : 0,
    },
  ) +
  " " +
  nativeDeathPolicy(getWolfKingState(role)?.deathActionPolicy, locale);

const capture_white_wolf_king = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.white_wolf_king.state", {
    remaining: getWhiteWolfKingState(role)?.canDetonate ? 1 : 0,
  });

const capture_knight = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.knight.state", { remaining: getKnightState(role)?.canDuel ? 1 : 0 });

const capture_gravekeeper = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const history = getGravekeeperState(role)?.history,
    raw = Array.isArray(history) ? history.at(-1) : undefined;
  const report = readGravekeeperReport(raw);
  return (
    nativeText(locale, "role.gravekeeper.state") +
    " " +
    (report
      ? nativeText(locale, "role.gravekeeper.latest", {
          exileDay: report.exileDay,
          receivedDay: report.receivedDay,
          target: report.targetId,
          result: nativeInspectionLabel(report.result, locale),
        })
      : nativeText(
          locale,
          raw === undefined && Array.isArray(history)
            ? "role.gravekeeper.no_report"
            : "replay.unknown",
        ))
  );
};

const capture_dreamer = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string => {
  const state = getDreamerState(role);
  return (
    nativeText(locale, "role.dreamer.state") +
    " " +
    nativeText(
      locale,
      state?.protectionPolicy === "netease_2026_night_immunity_v1"
        ? "role.dreamer.protection_netease"
        : "role.dreamer.protection_awa",
    ) +
    (state?.lastTarget !== null && state?.lastTarget !== undefined && state.lastDay !== null
      ? " " +
        nativeText(locale, "role.dreamer.latest", { target: state.lastTarget, day: state.lastDay })
      : "")
  );
};

const capture_wolf_beauty = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const state =
    world && isAnimalDreamBoard(world)
      ? animalBeautyKnowledge(
          world,
          world.entityIds().find((id) => world.getComponent(id, COMPONENT.Role) === role)!,
        )
      : getWolfBeautyState(role);
  return (
    nativeText(locale, "role.wolf_beauty.state") +
    " " +
    nativeText(
      locale,
      state &&
        "deathLinkPolicy" in state &&
        state.deathLinkPolicy === "heroes_s7_2017_exile_hunter_v1"
        ? "role.wolf_beauty.link_s7"
        : "role.wolf_beauty.link_awa",
    ) +
    " " +
    nativeText(locale, "role.wolf_beauty.latest", {
      target: state?.targetId ?? nativeText(locale, "common.none"),
      day: state?.lastActedDay ?? nativeText(locale, "common.none"),
    })
  );
};

const capture_bear = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string => {
  const animal = world && isAnimalDreamBoard(world),
    report = animal
      ? animalBearKnowledge(world).history.at(-1)
      : getBearState(role)?.history.at(-1);
  return (
    nativeText(locale, animal ? "role.bear.dawn_brief" : "role.bear.state") +
    " " +
    (report
      ? nativeText(locale, "role.bear.latest", {
          day: report.day,
          result: nativeText(locale, report.roared ? "bear.roar" : "bear.quiet"),
        })
      : nativeText(locale, "role.bear.no_report"))
  );
};

const capture_cursed_fox = (
  _role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.cursed_fox.state");

const capture_cupid = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.cupid.state") +
  " " +
  nativeText(
    locale,
    getCupidState(role)?.policy === "lui_meme_lovers_only_v1"
      ? "role.cupid.lui"
      : "role.cupid.netease",
  ) +
  " " +
  nativeText(locale, "role.cupid.status", {
    state: JSON.stringify(projectCupidState(getCupidState(role)!)),
  });

const capture_debater = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string => {
  const actor = world
    ?.getEntityIdsByRole(Role.Debater)
    .find((id) => world.getComponent(id, COMPONENT.Role) === role);
  return (
    nativeText(locale, "role.debater.state") +
    " " +
    nativeText(locale, "role.debater.status", {
      state: JSON.stringify(
        projectDebaterState(
          getDebaterState(role)!,
          !!world && actor !== undefined && hasDebateCommit(world, actor),
        ),
      ),
    })
  );
};

const capture_hidden_wolf = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined, currentCamp: CurrentCampSource,
): string =>
  nativeText(
    locale,
    getHiddenWolfState(role)?.campInspection === "netease_2020_good_v1"
      ? "role.hidden_wolf.state_good_v1"
      : "role.hidden_wolf.state",
  ) +
  " " +
  nativeText(locale, "role.hidden_wolf.status", {
    inherited: nativeText(
      locale,
      getHiddenWolfState(role)?.hasInheritedKnife === true ? "common.yes" : "common.no",
    ),
    active: nativeText(locale, canHiddenWolfKnife(role, world, currentCamp) ? "common.yes" : "common.no"),
  });

const capture_gargoyle = (role: RoleComponent, locale: Locale = "zh-CN", world: World | undefined, currentCamp: CurrentCampSource): string => {
  const report = getRoleInspectionState(role)?.history.at(-1);
  return (
    nativeText(
      locale,
      getRoleInspectionState(role)?.inspectionPolicy
        ? "role.gargoyle.configured_identity"
        : "role.gargoyle.state",
    ) +
    " " +
    nativeInspectionPolicy(getRoleInspectionState(role)!, locale) +
    " " +
    nativeText(locale, "role.gargoyle.status", {
      inherited: nativeText(
        locale,
        getGargoyleState(role)?.hasInheritedKnife === true ? "common.yes" : "common.no",
      ),
      active: nativeText(locale, canGargoyleKnife(role, world, currentCamp) ? "common.yes" : "common.no"),
    }) +
    (report
      ? " " +
        nativeText(locale, "inspection.latest", {
          target: report.targetId,
          result: nativeInspectionLabel(report.result, locale),
        })
      : "")
  );
};

const capture_psychic = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string => {
  const report = getRoleInspectionState(role)?.history.at(-1);
  return (
    nativeText(
      locale,
      getRoleInspectionState(role)?.inspectionPolicy
        ? "role.psychic.configured_identity"
        : "role.psychic.state",
    ) +
    " " +
    nativeInspectionPolicy(getRoleInspectionState(role)!, locale) +
    (report
      ? " " +
        nativeText(locale, "inspection.latest", {
          target: report.targetId,
          result: nativeInspectionLabel(report.result, locale),
        })
      : "")
  );
};

const capture_mechanical_wolf = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const raw = getMechanicalState(role),
    state = raw && projectMechanicalState(raw),
    learned = state?.learned,
    none = nativeText(locale, "common.none");
  return (
    nativeText(locale, "role.mechanical_wolf.state") +
    " " +
    nativeText(locale, "role.mechanical_wolf.status", {
      learned: learned ? nativeRoleName(learned.role, locale) : none,
      ready: learned?.readyOnNight ?? none,
      inherited: nativeText(locale, state?.hasInheritedKnife ? "common.yes" : "common.no"),
      first: state?.firstKnifeNight ?? none,
      mode: state?.mode
        ? `${state.mode.day}: ${nativeText(locale, state.mode.kind === "kill" ? "mechanical.mode.kill" : "mechanical.mode.skill")}`
        : none,
      resources: JSON.stringify(learned?.skill ?? null),
    })
  );
};

const capture_miracle_merchant = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.miracle_merchant.state") +
  " " +
  nativeText(locale, "role.miracle_merchant.status", {
    state: JSON.stringify(projectMerchantState(getMerchantState(role)!)),
  });

const capture_black_market_merchant = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string =>
  nativeText(locale, "role.black_market_merchant.state") +
  " " +
  nativeText(locale, "role.black_market_merchant.status", {
    state: JSON.stringify(projectBlackMarketState(getBlackMarketState(role)!)),
  });

const capture_hybrid = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.hybrid.state") +
  " " +
  nativeText(locale, "role.hybrid.status", {
    state: JSON.stringify(projectHybridState(getHybridState(role)!)),
  });

const capture_mirror_girl = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const native = nativeMirror(role),
    report = native?.kind === "role_check" ? native.state.history.at(-1) : undefined;
  return (
    nativeText(
      locale,
      native?.kind === "role_check" && native.state.inspectionPolicy
        ? "role.mirror_girl.configured_identity"
        : "role.mirror_girl.state",
    ) +
    " " +
    nativeInspectionPolicy(
      native?.kind === "role_check" ? native.state : freshMirrorInspectionState(),
      locale,
    ) +
    (report
      ? " " +
        nativeText(locale, "inspection.latest", {
          target: report.targetId,
          result: nativeInspectionLabel(report.result, locale),
        })
      : "")
  );
};

const capture_awakened_hidden_wolf = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const raw = getAwakenedState(role),
    state = raw && projectAwakenedState(raw),
    learned = state?.learned,
    none = nativeText(locale, "common.none");
  return (
    nativeText(locale, "role.awakened_hidden_wolf.state") +
    " " +
    nativeText(locale, "role.awakened_hidden_wolf.status", {
      learned: learned ? nativeRoleName(learned.role, locale) : none,
      activation: learned?.activationNight ?? none,
      ready: learned?.activeFromNight ?? none,
      inherited: nativeText(locale, state?.hasInheritedKnife ? "common.yes" : "common.no"),
      first: state?.firstKnifeNight ?? none,
      resources: JSON.stringify(learned?.skill ?? null),
    })
  );
};

const capture_villager = (
  _roleComp: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.villager.state");

// 预言家最新结果在基础文字之前格式化；保留原 legacy camp 与 lastResult 分支。
const capture_seer = (roleComp: RoleComponent, locale: Locale = "zh-CN", world?: World): string => {
  const state = getSeerState(roleComp);
  const latest =
    state && state.lastTarget !== null && (state.lastResult || state.lastIsWerewolf !== null)
      ? ` ${state.lastResult ? nativeText(locale, "inspection.latest", { target: state.lastTarget, result: nativeInspectionLabel(state.lastResult, locale) }) : nativeText(locale, "role.seer.latest", { target: state.lastTarget, camp: nativeTerm("camp", state.lastIsWerewolf ? "wolf" : "good", locale) })}`
      : "";
  return (
    nativeText(locale, "role.seer.state") +
    latest +
    " " +
    nativeText(
      locale,
      state?.targetPolicy === "awa_fresh_others_v1"
        ? "role.seer.targets_fresh"
        : "role.seer.targets_alive",
    ) +
    " " +
    nativeText(
      locale,
      state?.actionPolicy !== "awa_optional_v1"
        ? "role.seer.action_required"
        : "role.seer.action_optional",
    )
  );
};

// 守卫先格式化基础文字再查询 repeatPolicy；非法语言不能先触发后段私有 getter。
const capture_guard = (roleComp: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.guard.state") +
  " " +
  nativeText(
    locale,
    getGuardState(roleComp)?.repeatPolicy === "netease_consecutive_nights_v1"
      ? "role.guard.repeat_actual_nights"
      : "role.guard.repeat_last_action",
  );

// 女巫先读取 heal／poison 并完成库存文案，之后才分别查询刀口及用药政策；不得提前收齐状态。
const capture_witch = (roleComp: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.witch.state", {
    heal: getWitchState(roleComp)?.heal ?? 0,
    poison: getWitchState(roleComp)?.poison ?? 0,
  }) +
  " " +
  nativeText(
    locale,
    getWitchState(roleComp)?.knifeVisibility === "awa_always_v1"
      ? "role.witch.knife_always"
      : "role.witch.knife_with_heal",
  ) +
  " " +
  nativeText(
    locale,
    getWitchState(roleComp)?.potionPolicy === "awa_both_native_experimental_v1"
      ? "role.witch.potions_both"
      : "role.witch.potions_one",
  );

const capture_hunter = (role: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(
    locale,
    getHunterState(role)?.deathActionPolicy === "awa_knife_or_exile_v1"
      ? "role.hunter.configured_state"
      : "role.hunter.state",
  ) +
  " " +
  nativeDeathPolicy(getHunterState(role)?.deathActionPolicy, locale);

const capture_idiot = (_roleComp: RoleComponent, locale: Locale = "zh-CN", world?: World): string =>
  nativeText(locale, "role.idiot.state");

/** 这张表只选择具体捕获程序，不读取角色或 World，也不作为角色数据 shape 约束。 */
const nativeCaptures: Record<
  NativeRolePresentationId,
  (role: RoleComponent, locale: Locale, world: World | undefined, currentCamp: CurrentCampSource) => string
> = {
  white_cat: capture_white_cat,
  fox_cub: capture_fox_cub,
  pufferfish: capture_pufferfish,
  fragrant_phantom: capture_fragrant_phantom,
  awakened_seer: capture_awakened_seer,
  night_noble: capture_night_noble,
  awakened_idiot: capture_awakened_idiot,
  radiant_count: capture_radiant_count,
  eclipse_maid: capture_eclipse_maid,
  alchemist: capture_alchemist,
  raven_claw_wolf: capture_raven_claw_wolf,
  day_scholar: capture_day_scholar,
  night_mentor: capture_night_mentor,
  time_wolf_consort: capture_time_wolf_consort,
  wolf_sorcerer: capture_wolf_sorcerer,
  trickster: capture_trickster,
  order_prince: capture_order_prince,
  magician: capture_magician,
  red_moon_apostle: capture_red_moon_apostle,
  nightmare: capture_nightmare,
  evil_knight: capture_evil_knight,
  pure_white_girl: capture_pure_white_girl,
  wolf_witch: capture_wolf_witch,
  demon_hunter: capture_demon_hunter,
  ghost_bride: capture_ghost_bride,
  wild_child: capture_wild_child,
  lonely_girl: capture_lonely_girl,
  thief: capture_thief,
  shapeshifter: capture_shapeshifter,
  wolf: capture_wolf,
  wolf_king: capture_wolf_king,
  white_wolf_king: capture_white_wolf_king,
  knight: capture_knight,
  gravekeeper: capture_gravekeeper,
  dreamer: capture_dreamer,
  wolf_beauty: capture_wolf_beauty,
  bear: capture_bear,
  cursed_fox: capture_cursed_fox,
  cupid: capture_cupid,
  debater: capture_debater,
  hidden_wolf: capture_hidden_wolf,
  gargoyle: capture_gargoyle,
  psychic: capture_psychic,
  mechanical_wolf: capture_mechanical_wolf,
  miracle_merchant: capture_miracle_merchant,
  black_market_merchant: capture_black_market_merchant,
  hybrid: capture_hybrid,
  mirror_girl: capture_mirror_girl,
  awakened_hidden_wolf: capture_awakened_hidden_wolf,
  villager: capture_villager,
  seer: capture_seer,
  guard: capture_guard,
  witch: capture_witch,
  hunter: capture_hunter,
  idiot: capture_idiot,
};
export function captureNativeRolePresentation(
  id: NativeRolePresentationId,
  role: RoleComponent,
  locale: Locale,
  world: World | undefined,
  currentCamp: CurrentCampSource,
): string {
  // 表只传输入；语言及前段失败仍在各具体捕获点，source未被dispatcher提前执行。
  return nativeCaptures[id](role, locale, world, currentCamp);
}
