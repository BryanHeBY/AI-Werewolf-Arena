import { BaseRole } from './Role';
import { RoleType, Faction, GamePhase, PlayerAction } from '../core/types';
import { ModelConfig } from '../core/types';
import * as fs from 'fs';
import * as path from 'path';

export class WolfRole extends BaseRole {
  roleType: RoleType = RoleType.Wolf;
  faction: Faction = Faction.Wolf;

  constructor(playerId: number, modelConfig: ModelConfig) {
    const cwd = process.cwd();
    const isRunningFromBackend = cwd.endsWith('/backend');
    const rootDir = isRunningFromBackend ? path.resolve(cwd, '..') : path.resolve(cwd);
    const filePath = path.join(rootDir, 'configs/system-prompts/wolf.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    super(playerId, modelConfig, data.systemPrompt);
  }

  canActInPhase(phase: GamePhase): boolean {
    return phase === GamePhase.WolfAction || 
           phase === GamePhase.SequentialSpeech || 
           phase === GamePhase.Vote;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  protected buildObservationPrompt(history: PlayerAction[], gameState: any): string {
    const sanitizedState = this.sanitizeGameStateForObservation(gameState);
    const alivePlayers = sanitizedState.players.filter((p: any) => p.isAlive);
    const aliveCount = alivePlayers.length;
    const myAllyIds = sanitizedState.players
      .filter((p: any) => p.roleType === RoleType.Wolf && p.isAlive)
      .map((p: any) => p.id);
    const validTargetIds = this.getValidTargetIds(sanitizedState);

    let prompt = `你现在是一名狼人，在一场6人狼人杀游戏中。\n\n`;
    prompt += `当前游戏信息：\n`;
    prompt += `- 你的玩家ID（编号）：${this.playerId}\n`;
    prompt += `- 当前轮次：第${sanitizedState.round}天\n`;
    prompt += `- 当前阶段：${sanitizedState.phase}\n`;
    prompt += `- 存活玩家总数：${aliveCount} 人\n`;
    prompt += `- 你的狼人同伴：玩家 ${myAllyIds.filter((id: number) => id !== this.playerId).join(', ')}\n`;
    prompt += `- 可选择的目标玩家ID：${validTargetIds.join(', ')}\n\n`;

    if (this.privateMemory.length > 0) {
      prompt += `你之前的内心思考记忆：\n`;
      this.privateMemory.forEach((memory, index) => {
        prompt += `第${index + 1}轮：${memory}\n\n`;
      });
      prompt += `\n`;
    }

    prompt += `历史行动记录：\n${this.formatHistory(history)}\n\n`;

    // 强制告诉模型当前阶段需要什么动作类型
    if (sanitizedState.phase === 'Wolf_Action') {
      prompt += `⚠️ 当前是夜晚狼人行动阶段，你必须选择：type 只能是 "kill" 或者 "no_action"！\n`;
      prompt += `如果你选择杀人，必须给出 targetId（目标玩家ID），只能从以下列表中选择：${validTargetIds.join(', ')}。\n\n`;
    } else if (sanitizedState.phase === 'Sequential_Speech') {
      prompt += `⚠️ 当前是白天发言阶段，你必须选择：type 只能是 "speak"！\n`;
      prompt += `你必须在 content 字段写出你的公开发言内容。\n\n`;
    } else if (sanitizedState.phase === 'Vote') {
      prompt += `⚠️ 当前是投票放逐阶段，你必须选择：type 只能是 "vote"！\n`;
      prompt += `你必须在 targetId 给出你要投票出局的玩家ID，只能从以下列表中选择：${validTargetIds.join(', ')}。\n\n`;
    }

    prompt += `请按照要求输出 JSON 格式，包含两个字段：\n`;
    prompt += `1. thought: 你的内心独白和推理思路（要详细说明你为什么这么做，对其他人身份的怀疑，这个选择的理由）\n`;
    prompt += `2. action: 你的实际行动，包含 type （动作类型），targetId（目标玩家ID，如果需要），content（发言内容，如果是发言的话）\n`;
    prompt += `记住：狼人晚上请隐藏身份，白天发言不要暴露自己和同伴。杀人请杀你认为是神职的人。\n`;
    prompt += `你的输出必须严格是JSON，不要有任何其他文字：\n`;

    return prompt;
  }
}
