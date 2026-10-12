/**
 * Unit tests: Component localization uses in-memory public prompt APIs and explicit
 * locales; exact role/status/policy text checks default game language and independent
 * display selection. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  Camp,
  COMPONENT,
  Role,
  StatusMark,
  type AliveComponent,
  type BadgeComponent,
  type CampComponent,
  type RoleComponent,
  type StatusMarksComponent,
  type VotingRightComponent,
} from "../../../src/core";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: public component prompt APIs bind game locale and support independent display calls`, () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig, {
      locale,
      fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
    });
    const alive = world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
    const camp = world.getComponent<CampComponent>(1, COMPONENT.Camp)!;
    const badge = world.getComponent<BadgeComponent>(1, COMPONENT.Badge)!;
    const vote = world.getComponent<VotingRightComponent>(1, COMPONENT.VotingRight)!;
    const role = world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
    const marks = world.getComponent<StatusMarksComponent>(1, COMPONENT.StatusMarks)!;
    expect(alive.renderPrompt()).toBe(locale === "en" ? "You are still alive." : "你当前仍存活。");
    alive.alive = false;
    expect(alive.renderPrompt()).toBe(
      locale === "en" ? "You have been eliminated." : "你当前已出局。",
    );
    expect(camp.renderPrompt()).toContain(locale === "en" ? "Werewolf team" : "狼人阵营");
    camp.camp = Camp.ThirdParty;
    expect(camp.renderPrompt()).toContain(locale === "en" ? "Third party team" : "第三方阵营");
    expect(role.renderPrompt()).toContain(locale === "en" ? "Your role is Werewolf." : "狼人");
    expect(createRoleComponent(Role.Wolf, Camp.Wolf, locale).renderPrompt()).toBe(
      locale === "en" ? "Your role is Werewolf." : "你的底牌是【狼人】。",
    );
    expect(badge.renderPrompt()).toBe(
      locale === "en" ? "You do not hold the sheriff badge." : "你当前不持有警徽。",
    );
    badge.isSheriff = true;
    badge.voteWeight = 2;
    expect(badge.renderPrompt()).toContain("2");
    badge.destroyed = true;
    expect(badge.renderPrompt()).toBe(
      locale === "en" ? "The sheriff badge has been destroyed." : "警徽已销毁。",
    );
    vote.weight = 1.5;
    expect(vote.renderPrompt()).toContain("1.5");
    vote.canVote = false;
    expect(vote.renderPrompt()).toBe(
      locale === "en" ? "You currently have no voting right." : "你当前没有投票权。",
    );
    expect(marks.renderPrompt()).toBe(
      locale === "en" ? "You have no status marks." : "你当前没有状态印记。",
    );
    for (const mark of Object.values(StatusMark)) marks.add(mark);
    const original = marks.values();
    expect(marks.renderPrompt()).toContain(
      locale === "en"
        ? "[Guard mark] [Wolf kill mark] [Heal mark] [Poison mark]"
        : "[守护印记] [狼刀印记] [解药印记] [毒药印记]",
    );
    expect(marks.renderPrompt(locale === "en" ? "zh-CN" : "en")).toContain(
      locale === "en" ? "守护印记" : "Guard mark",
    );
    expect(marks.values()).toEqual(original);
    expect(marks.renderPrompt()).toContain(locale === "en" ? "Guard mark" : "守护印记");
  });
