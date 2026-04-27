// Test script to check ChatFlow rendering
console.log("Testing ChatFlow component...");

// Simulate checking the store
const mockMessages = [
  {
    id: 1,
    playerId: -1,
    playerName: "法官",
    content: "游戏开始！天黑请闭眼。",
    timestamp: Date.now(),
    type: "system",
  },
  {
    id: 2,
    playerId: 1,
    playerName: "玩家1",
    content: "我是好人，过。",
    timestamp: Date.now() + 1000,
    privateThought: "这个人发言很可疑，可能是狼人。",
  },
  {
    id: 3,
    playerId: 2,
    playerName: "玩家2",
    content: "我支持玩家1的观点。",
    timestamp: Date.now() + 2000,
  },
];

console.log("Mock messages:", mockMessages.length, "条");
console.log("检查可能的问题:");
console.log("1. 虚拟滚动容器高度是否设置？");
console.log("2. containerProps 和 wrapperProps 是否正确绑定？");
console.log("3. 消息数组是否响应式更新？");
console.log("4. 组件的 computed 属性是否正确计算？");
