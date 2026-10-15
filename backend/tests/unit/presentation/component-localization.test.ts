/**
 * 单元测试：验证内存组件公开提示 API 的默认语言和独立展示语言。输入为原组件、显式语言与局部状态修改；精确角色／状态／政策文案是原字面预期。所有组件展示通过游戏侧绑定，领域保持原数据；不调用模型或完整对局驱动。
 */
import {
  renderAlivePrompt,
  renderCampPrompt,
  renderBadgePrompt,
  renderVotingRightPrompt,
  renderStatusMarksPrompt,
} from "../../../src/agents/observation/component-presentation";
import { renderRolePrompt } from "../../../src/agents/observation/role-presentation";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
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
} from "../../../src/domain";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: public component prompt APIs bind game locale and support independent display calls`, () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig, {
      locale,
      fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
    });
    const alive = world.getComponent(1, COMPONENT.Alive)!;
    const camp = world.getComponent(1, COMPONENT.Camp)!;
    const badge = world.getComponent(1, COMPONENT.Badge)!;
    const vote = world.getComponent(1, COMPONENT.VotingRight)!;
    const role = world.getComponent(1, COMPONENT.Role)!;
    const marks = world.getComponent(1, COMPONENT.StatusMarks)!;
    expect(renderAlivePrompt(alive)).toBe(
      locale === "en" ? "You are still alive." : "你当前仍存活。",
    );
    alive.alive = false;
    expect(renderAlivePrompt(alive)).toBe(
      locale === "en" ? "You have been eliminated." : "你当前已出局。",
    );
    expect(renderCampPrompt(camp)).toContain(locale === "en" ? "Werewolf team" : "狼人阵营");
    camp.camp = Camp.ThirdParty;
    expect(renderCampPrompt(camp)).toContain(locale === "en" ? "Third party team" : "第三方阵营");
    expect(renderRolePrompt(role)).toContain(locale === "en" ? "Your role is Werewolf." : "狼人");
    expect(renderRolePrompt(createRoleComponent(Role.Wolf, locale))).toBe(
      locale === "en" ? "Your role is Werewolf." : "你的底牌是【狼人】。",
    );
    expect(renderBadgePrompt(badge)).toBe(
      locale === "en" ? "You do not hold the sheriff badge." : "你当前不持有警徽。",
    );
    badge.isSheriff = true;
    badge.voteWeight = 2;
    expect(renderBadgePrompt(badge)).toContain("2");
    badge.destroyed = true;
    expect(renderBadgePrompt(badge)).toBe(
      locale === "en" ? "The sheriff badge has been destroyed." : "警徽已销毁。",
    );
    vote.weight = 1.5;
    expect(renderVotingRightPrompt(vote)).toContain("1.5");
    vote.canVote = false;
    expect(renderVotingRightPrompt(vote)).toBe(
      locale === "en" ? "You currently have no voting right." : "你当前没有投票权。",
    );
    expect(renderStatusMarksPrompt(marks)).toBe(
      locale === "en" ? "You have no status marks." : "你当前没有状态印记。",
    );
    for (const mark of Object.values(StatusMark)) marks.add(mark);
    const original = marks.values();
    expect(renderStatusMarksPrompt(marks)).toContain(
      locale === "en"
        ? "[Guard mark] [Wolf kill mark] [Heal mark] [Poison mark]"
        : "[守护印记] [狼刀印记] [解药印记] [毒药印记]",
    );
    expect(renderStatusMarksPrompt(marks, locale === "en" ? "zh-CN" : "en")).toContain(
      locale === "en" ? "守护印记" : "Guard mark",
    );
    expect(marks.values()).toEqual(original);
    expect(renderStatusMarksPrompt(marks)).toContain(locale === "en" ? "Guard mark" : "守护印记");
  });
