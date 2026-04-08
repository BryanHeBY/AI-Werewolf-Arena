import { AliveComponent } from "../domain/components/alive";
import { BadgeComponent } from "../domain/components/badge";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { StatusMarksComponent } from "../domain/components/status_marks";
import { VotingRightComponent } from "../domain/components/voting_right";
import { EntityId } from "../domain/model";
import { World } from "../domain/world";
import { ActiveContextWindow } from "./active_context_window";
import { NotebookStore } from "./notebook_store";
import { RollingSummaryStore } from "./rolling_summary";

/**
 * PromptAssembler 负责把多层记忆拼装成最终上下文：
 * System Fact -> Private Notebook -> Rolling Summary -> Active Context。
 */
export class PromptAssembler {
  constructor(
    private readonly world: World,
    private readonly notebooks: NotebookStore,
    private readonly summaries: RollingSummaryStore,
    private readonly context: ActiveContextWindow,
  ) {}

  buildPromptFor(entityId: EntityId): string {
    const sections: string[] = [];

    sections.push("[System Fact]");
    sections.push(this.renderComponents(entityId));

    sections.push("\n[Private Notebook]");
    sections.push(this.notebooks.get(entityId).join("\n") || "(empty)");

    sections.push("\n[Rolling Summary]");
    sections.push(this.summaries.get(entityId) || "(empty)");

    sections.push("\n[Active Context]");
    sections.push(
      this.context
        .list()
        .map((line) => `[玩家${line.actorId}] ${line.text}`)
        .join("\n") || "(empty)",
    );

    return sections.join("\n");
  }

  private renderComponents(entityId: EntityId): string {
    // 组件渲染顺序固定，确保每次提示词结构稳定可预测。
    const lines: string[] = [];
    const role = this.world.getComponent<RoleComponent>(entityId, COMPONENT.Role);
    const alive = this.world.getComponent<AliveComponent>(entityId, COMPONENT.Alive);
    const marks = this.world.getComponent<StatusMarksComponent>(
      entityId,
      COMPONENT.StatusMarks,
    );
    const voting = this.world.getComponent<VotingRightComponent>(
      entityId,
      COMPONENT.VotingRight,
    );
    const badge = this.world.getComponent<BadgeComponent>(entityId, COMPONENT.Badge);

    if (role) lines.push(role.renderPrompt());
    if (alive) lines.push(alive.renderPrompt());
    if (marks) lines.push(marks.renderPrompt());
    if (voting) lines.push(voting.renderPrompt());
    if (badge) lines.push(badge.renderPrompt());

    return lines.join("\n");
  }
}
