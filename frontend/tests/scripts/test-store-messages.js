// Test to check store messages
console.log("Testing store messages...");

// This would need to run in browser context
// For now, let's check what the mock engine generates

const MOCK_PLAYERS = [
  { id: 1, name: "Player 1" },
  { id: 2, name: "Player 2" },
  { id: 3, name: "Player 3" },
  { id: 4, name: "Player 4" },
  { id: 5, name: "Player 5" },
  { id: 6, name: "Player 6" },
];

const NORMAL_SPEAK_CONTENTS = [
  "我是好人，大家相信我！",
  "我觉得Player 1可能是狼人",
  "昨晚Player 3死了，我认为...",
  "大家一起投票投Player 5",
  "我同意Player 2的说法",
  "暂时没有线索，先观察一下",
  "Player 4的发言很奇怪",
  "我认为应该先投Player 6",
  "我是村民，请大家相信我",
  "大家都冷静分析一下",
];

console.log("Mock players:", MOCK_PLAYERS.length);
console.log("Normal speak contents:", NORMAL_SPEAK_CONTENTS.length);

// Simulate what a message might look like
const sampleMessage = {
  id: `mock-${Date.now()}-1`,
  type: "speak",
  playerId: 1,
  playerName: "Player 1",
  content: "我是好人，大家相信我！",
  timestamp: Date.now(),
};

console.log(
  "Sample message structure:",
  JSON.stringify(sampleMessage, null, 2),
);

console.log("\nPotential issues to check:");
console.log("1. Is the store actually populated?");
console.log("2. Are messages being filtered out by computed property?");
console.log("3. Is useVirtualList getting a valid container height?");
console.log("4. Are CSS classes conflicting?");
