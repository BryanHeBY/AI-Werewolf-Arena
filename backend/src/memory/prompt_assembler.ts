import { AliveComponent } from "../core/domain/components/alive";
import { BadgeComponent } from "../core/domain/components/badge";
import { COMPONENT } from "../core/domain/components/names";
import { RoleComponent } from "../core/domain/components/role";
import { VotingRightComponent } from "../core/domain/components/voting_right";
import { EntityId } from "../core/domain/model";
import { World } from "../core/domain/world";
import { ActiveContextWindow } from "./active_context_window";
import { NotebookStore } from "./notebook_store";
import { RollingSummaryStore } from "./rolling_summary";

/**
 * Prompt 组装器参数配置。
 */
export interface PromptAssemblerOptions {
  compressionSoftLimitChars?: number;
  compressionTargetChars?: number;
  summaryMaxChars?: number;
}

/**
 * PromptAssembler 负责把多层记忆拼装成最终上下文：
 * System Fact -> Private Notebook -> Rolling Summary -> Active Context。
 */
export class PromptAssembler {
  private readonly compressionSoftLimitChars: number;
  private readonly compressionTargetChars: number;
  private readonly summaryMaxChars: number;

  constructor(
    private readonly world: World,
    private readonly notebooks: NotebookStore,
    private readonly summaries: RollingSummaryStore,
    private readonly context: ActiveContextWindow,
    options: PromptAssemblerOptions = {},
  ) {
    this.compressionSoftLimitChars = options.compressionSoftLimitChars ?? 4000;
    this.compressionTargetChars = options.compressionTargetChars ?? 2500;
    this.summaryMaxChars = options.summaryMaxChars ?? 500;
  }

  /**
   * 为指定玩家组装完整 Prompt 文本。
   */
  buildPromptFor(entityId: EntityId): string {
    this.compressIfNeeded(entityId);

    const sections: string[] = [];

    sections.push("[系统事实]");
    sections.push(this.renderComponents(entityId));

    sections.push("\n[私密笔记]");
    sections.push(this.notebooks.get(entityId).join("\n") || "(empty)");

    sections.push("\n[滚动摘要]");
    sections.push(this.summaries.get(entityId) || "(empty)");

    sections.push("\n[高保真近期上下文]");
    sections.push(
      this.context
        .list()
        .map((line) => `[玩家${line.actorId}] ${line.text}`)
        .join("\n") || "(empty)",
    );

    return sections.join("\n");
  }

  /**
   * 当上下文超过阈值时执行压缩并写入滚动摘要。
   */
  private compressIfNeeded(entityId: EntityId): void {
    if (this.context.totalChars() <= this.compressionSoftLimitChars) {
      return;
    }

    const extracted = this.context.extractOldestUntilWithin(
      this.compressionTargetChars,
    );
    if (extracted.length === 0) {
      return;
    }

    const summaryRaw = extracted
      .map((line) => `[玩家${line.actorId}] ${line.text}`)
      .join("；");
    const summary =
      summaryRaw.length > this.summaryMaxChars
        ? `${summaryRaw.slice(0, this.summaryMaxChars)}...`
        : summaryRaw;

    this.summaries.append(entityId, summary);
  }

  /**
   * 按固定顺序渲染玩家组件事实。
   */
  private renderComponents(entityId: EntityId): string {
    // 组件渲染顺序固定，确保每次提示词结构稳定可预测。
    const lines: string[] = [];
    const role = this.world.getComponent<RoleComponent>(entityId, COMPONENT.Role);
    const alive = this.world.getComponent<AliveComponent>(entityId, COMPONENT.Alive);
    const voting = this.world.getComponent<VotingRightComponent>(
      entityId,
      COMPONENT.VotingRight,
    );
    const badge = this.world.getComponent<BadgeComponent>(entityId, COMPONENT.Badge);

    if (role) lines.push(role.renderPrompt());
    if (alive) lines.push(alive.renderPrompt());
    if (voting) lines.push(voting.renderPrompt());
    if (badge) lines.push(badge.renderPrompt());

    return lines.join("\n");
  }
}
