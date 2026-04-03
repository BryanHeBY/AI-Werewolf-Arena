import { BaseRole } from './Role';
import { RoleType, Faction, GamePhase, PlayerAction } from '../core/types';
import { ModelConfig } from '../core/types';
import * as fs from 'fs';
import * as path from 'path';

export class WitchRole extends BaseRole {
  roleType: RoleType = RoleType.Witch;
  faction: Faction = Faction.Villager;

  constructor(playerId: number, modelConfig: ModelConfig) {
    const cwd = process.cwd();
    const isRunningFromBackend = cwd.endsWith('/backend');
    const rootDir = isRunningFromBackend ? path.resolve(cwd, '..') : path.resolve(cwd);
    const filePath = path.join(rootDir, 'configs/system-prompts/witch.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    super(playerId, modelConfig, data.systemPrompt);
  }

  canActInPhase(phase: GamePhase): boolean {
    return phase === GamePhase.WitchAction || 
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
    const deadPlayers = sanitizedState.deadPlayerIds;
    const nightResult = gameState.nightResult; // keep internal nightResult for witch to see who was killed
    const validTargetIds = this.getValidTargetIds(sanitizedState);

    let prompt = `你现在是女巫，在一场6人狼人杀游戏中。\n\n`;
    prompt += `当前游戏信息：\n`;
    prompt += `- 你的玩家ID（编号）：${this.playerId}\n`;
    prompt += `- 当前轮次：第${sanitizedState.round}天\n`;
    prompt += `- 当前阶段：${sanitizedState.phase}\n`;
    prompt += `- 存活玩家总数：${aliveCount} 人\n`;
    prompt += `- 已死亡玩家：${deadPlayers.join(', ') || '无'}\n`;
    prompt += `- 可选择的目标玩家ID：${validTargetIds.join(', ')}\n`;
    prompt += `- 你是否还有解药：${gameState.witchHasAntidote ? '是' : '否'}\n`;
    prompt += `- 你是否还有毒药：${gameState.witchHasPoison ? '是' : '否'}\n`;
     if (nightResult?.killedByWolf !== undefined) {
       prompt += `- 今晚狼人刀了玩家 ${nightResult.killedByWolf}\n`;
     } else {
       prompt += `- 今晚无人被狼人袭击\n`;
     }
    prompt += '\n';

    if (this.privateMemory.length > 0) {
      prompt += `你之前的内心思考记忆：\n`;
      this.privateMemory.forEach((memory, index) => {
        prompt += `第${index + 1}轮：${memory}\n\n`;
      });
      prompt += '\n';
    }

    prompt += `历史行动记录：\n${this.formatHistory(history)}\n\n`;

    // 强制告诉模型当前阶段需要什么动作类型
    if (sanitizedState.phase === 'Witch_Action') {
      prompt += `⚠️ 当前是夜晚女巫行动阶段，你必须选择：type 只能是 "save", "poison", 或 "no_action"！\n`;
      prompt += `- 如果使用解药救人：type "save"，targetId 是被刀玩家ID\n`;
      prompt += `- 如果使用毒药杀人：type "poison"，targetId 是你要毒的玩家ID，只能从以下列表中选择：${validTargetIds.join(', ')}\n`;
      prompt += `- 如果不使用药：type "no_action"\n\n`;
    } else if (sanitizedState.phase === 'Sequential_Speech') {
      prompt += `⚠️ 当前是白天发言阶段，你必须选择：type 只能是 "speak"！\n`;
      prompt += `你必须在 content 字段写出你的公开发言内容。\n\n`;
    } else if (sanitizedState.phase === 'Vote') {
      prompt += `⚠️ 当前是投票放逐阶段，你必须选择：type 只能是 "vote"！\n`;
      prompt += `你必须在 targetId 给出你要投票出局的玩家ID，只能从以下列表中选择：${validTargetIds.join(', ')}。\n\n`;
    }

    prompt += `请按照要求输出 JSON 格式，包含两个字段：\n`;
    prompt += `1. thought: 你的内心独白和推理思路\n`;
    prompt += `2. action: 你的实际行动，包含 type （动作类型），targetId（目标玩家ID，如果需要），content（发言内容，如果是发言的话）\n`;
    prompt += `记住：解药只能用一次，毒药只能用一次。不要乱开药。\n`;
    prompt += `你的输出必须严格是JSON，不要有任何其他文字：\n`;

    return prompt;
  }
}
