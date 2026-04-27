#!/bin/bash
# AI狼人杀竞技场 V2 聊天流演示启动脚本

echo "🎮 AI狼人杀竞技场 V2 聊天流演示"
echo "========================================"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动开发服务器
echo "🚀 启动 V2 聊天流演示..."
echo ""
echo "访问地址: http://localhost:5173"
echo ""
echo "功能说明:"
echo "1. 点击 '启动 Mock 引擎' 开始接收模拟消息"
echo "2. 点击 'P上帝' 切换不同玩家视角"
echo "3. 观察聊天流中的消息对齐 (法官居中、自己右侧、他人左侧)"
echo "4. 点击 '清空消息' 重置聊天历史"
echo "5. 查看带有 '👁️ [查看 AI 神经元推理]' 的消息，点击展开AI思考过程"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "========================================"

npm run dev