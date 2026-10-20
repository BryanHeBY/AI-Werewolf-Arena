# AI Werewolf Arena · Replay

独立只读复盘网页。共享投影、播放器、主题与字体归 `packages/game-media`，工作台使用同一实现。

## 启动

在仓库根运行：

```bash
bun install
bun run dev:frontend
# 默认 http://localhost:5173，可通过页面导入 replay.json
bun run replay:dev -- --input ./record/<session>/replay.json
bun run build:frontend
bun run --cwd apps/replay preview
```

也可从应用目录运行 `bun run dev`。显式复盘路径相对公共入口调用目录；Vite root 和配置固定属于本应用，与输入数据所在目录无关。默认项目数据根始终是仓库根；配置内相对文件引用按声明文件目录解析。

独立游戏 CLI 见[运行指南](../../docs/guides/run-locally.md)，统一配置与运行管理见[工作台指南](../../docs/guides/workbench.md)。视频、语音与成片工具已归 [apps/video](../video/README.md)，不随复盘网页启动。

## 验证

```bash
bun run check:frontend
bun run test:frontend
bun run --cwd apps/replay test:e2e
```

浏览器验证使用 Node.js 和 Playwright Chromium；测试素材与共享展示单测归 `packages/game-media/tests`，本应用只提供浏览器宿主和资源服务。
