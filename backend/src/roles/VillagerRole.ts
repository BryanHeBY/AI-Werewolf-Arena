import { BaseRole } from './Role';
import { RoleType, Faction, GamePhase, PlayerAction } from '../core/types';
import { ModelConfig } from '../core/types';
import * as fs from 'fs';
import * as path from 'path';

export class VillagerRole extends BaseRole {
  roleType: RoleType = RoleType.Villager;
  faction: Faction = Faction.Villager;

  constructor(playerId: number, modelConfig: ModelConfig) {
    const cwd = process.cwd();
    const isRunningFromBackend = cwd.endsWith('/backend');
    const rootDir = isRunningFromBackend ? path.resolve(cwd, '..') : path.resolve(cwd);
    const filePath = path.join(rootDir, 'configs/system-prompts/villager.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    super(playerId, modelConfig, data.systemPrompt);
  }

  canActInPhase(phase: GamePhase): boolean {
    return phase === GamePhase.SequentialSpeech || 
           phase === GamePhase.Vote;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  protected buildObservationPrompt(history: PlayerAction[], gameState: any): string {
    const sanitizedState = this.sanitizeGameStateForObservation(gameState);
    const alivePlayers = sanitizedState.players.filter((p: any) => p.isAlive);
    const aliveCount = alivePlayers.length;
    const deadPlayers = sanitizedState.deadPlayerIds;
    const validTargetIds = this.getValidTargetIds(sanitizedState);

    let prompt = `你现在是一名村民，在一场6人狼人杀游戏中。\n\n`;
    prompt += `当前游戏信息：\n`;
    prompt += `- 你的玩家ID（编号）：${this.playerId}\n`;
    prompt += `- 当前轮次：第${sanitizedState.round}天\n`;
    prompt += `- 当前阶段：${sanitizedState.phase}\n`;
    prompt += `- 存活玩家总数：${aliveCount} 人\n`;
    prompt += `- 已死亡玩家：${deadPlayers.join(', ') || '无'}\n`;
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
    if (sanitizedState.phase === 'Sequential_Speech') {
      prompt += `⚠️ 当前是白天发言阶段，你必须选择：type 只能是 "speak"！\n`;
      prompt += `你必须在 content 字段写出你的公开发言内容，分析场上局势，说出你怀疑谁。\n\n`;
    } else if (sanitizedState.phase === 'Vote') {
      prompt += `⚠️ 当前是投票放逐阶段，你必须选择：type 只能是 "vote"！\n`;
      prompt += `你必须在 targetId 给出你要投票出局的玩家ID，只能从以下列表中选择：${validTargetIds.join(', ')}。\n\n`;
    }

    prompt += `请按照要求输出 JSON 格式，包含两个字段：\n`;
    prompt += `1. thought: 你的内心独白和推理思路（要详细分析每个人发言，推测谁可能是狼人，为什么投给这个人）\n`;
    prompt += `2. action: 你的实际行动，包含 type （动作类型），targetId（目标玩家ID，如果是投票），content（发言内容，如果是发言的话）\n`;
    prompt += `记住：你的目标是找出所有狼人并把他们公投出局。认真分析每个人的发言漏洞。\n`;
    prompt += `你的输出必须严格是JSON，不要有任何其他文字：\n`;

    return prompt;
  }
}
