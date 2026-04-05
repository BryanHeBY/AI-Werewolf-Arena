const { PromptPipeline } = require('./dist/agent/PromptPipeline');
const { Environment } = require('./dist/core/Environment');
const { GamePhase, RoleType, Faction } = require('./dist/core/types');
const { WolfRole } = require('./dist/roles/WolfRole');

// 创建简单测试
const env = {
  getGameState: () => ({
    phase: GamePhase.WolfAction,
    round: 1,
    players: [{
      id: 1,
      name: "Player 1",
      role: new WolfRole(1, { baseURL: "test", apiKey: "test", model: "test", temperature: 0.7, maxTokens: 1024 }),
      isAlive: true,
      faction: Faction.Wolf,
      modelConfig: { baseURL: "test", apiKey: "test", model: "test", temperature: 0.7, maxTokens: 1024 },
      privateMemory: ["test memory"]
    }],
    deadPlayerIds: [],
    history: [],
    witchHasAntidote: true,
    witchHasPoison: true,
    currentSpeechIndex: 0,
    phaseStack: []
  }),
  getVisibleHistory: () => []
};

const pipeline = new PromptPipeline(env, 1);
const prompt = pipeline.buildPrompt(RoleType.Wolf, GamePhase.WolfAction, true);
console.log("=== PROMPT START ===");
console.log(prompt.substring(0, 500));
console.log("=== PROMPT END ===");
console.log("\nContains '# 基础游戏规则':", prompt.includes("# 基础游戏规则"));
console.log("Contains '# 角色与性格':", prompt.includes("# 角色与性格"));
console.log("Contains '# 当前角色上下文':", prompt.includes("# 当前角色上下文"));
