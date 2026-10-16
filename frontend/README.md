# AI Werewolf Arena · Replay Studio

当前前端是 React + Remotion 的离线复盘工作台与视频编排基础设施。可在浏览器导入、切换后端 `record/session_*/replay.json`，也可通过本地命令提供只读文件；加载失败可重试。

## 本地流程

```bash
# 先运行一盘对局，再把 session 目录直接交给播放器
bun run replay:dev -- --input ../record/session_<id>
```

也可以直接传入 `../record/session_<id>/replay.json`。命令只读取该文件，由 Vite 开发或生产预览提供 `/api/replay`，不会复制或改写 record。静态部署可直接在页面导入本地文件。默认播放器地址为 `http://localhost:5173`。显示语言缺省跟随文件 locale（旧档中文），时区缺省 UTC；切换不修改文件，保留播放和筛选进度。时间线提供章节、搜索、可暂停跟随与倍速；当前全文独立滚动。

## 验证

```bash
bun run --cwd frontend test
bun run --cwd frontend typecheck
bun run --cwd frontend build
```

## 模块分工

- 当前入口：`src/main.tsx` → `src/App.tsx`（加载状态）→ `src/replay/ReplayWorkspace.tsx`（工作台）。播放控制集中在 `useReplayPlayback.ts`，舞台、席位、时间线分别由 `ReplayStage`、`PlayerSeats`、`EventTimeline` 呈现。
- 当前数据源：`@ai-werewolf-arena/replay-contract` 的 `ReplayDocument`，当前为完整的 `god`（上帝）离线复盘视角。
- 文件加载与校验在 `offline-replay.ts`，事件文案在 `event-labels.ts`，唯一事实投影和前缀索引在 `replay-projection.ts`。
- `src/video` 编译默认或单局脚本为纯数据 `VideoPlan`，统一镜头、字幕、特效和已备音轨；工作台与导出共用 `VideoComposition`。长字幕分页，默认时长按两语最大页数确定，切换语言不移动镜头边界。
- “玩家私有输出”可显式导入独立玩家文件，展示思考、消息和工具轨迹；它不生成角色视角舞台，也不把 God 席位筛选变成权限过滤。操作见[离线复盘指南](../docs/guides/offline-replay.md)。
- 角色视角舞台、公开脱敏、在线观战和 MP4 任务队列均不属于当前范围。

## 双语图片/视频

```bash
bun run --cwd frontend replay:render -- --input ../record/session_<id> --output /tmp/game.en.mp4 --locale en --time-zone UTC
bun run --cwd frontend replay:render -- --input tests/fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json --output /tmp/frame.zh.png --locale zh-CN --time-zone Asia/Shanghai --frame 100 --browser /usr/bin/chromium
```

输出PNG或H.264 MP4，已有目标和源文件不覆盖。语言/日期/历史字段、渲染参数、独占发布与资源关闭详见[展示契约](../docs/guides/offline-replay.md)。本地已有浏览器可设置`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`运行`test:e2e`；缺省使用Playwright安装的浏览器。

## 单局脚本与视频预览

在仓库根目录运行：

```bash
# 无脚本时自动生成通用版本，并打印来源指纹和镜头帧区间
bun run --cwd frontend video:inspect -- --input ../record/<session-id>/replay.json
# 可直接运行的具名示例：推近、返回全景、说明、箭头与自定义 TSX/SVG
bun run --cwd frontend video:preview -- --project videos/example/project.tsx
bun run --cwd frontend video:render -- --project videos/example/project.tsx --output /tmp/example.png --frame 230 --browser /usr/bin/chromium
# from/to 都是完整编排中的源帧，闭区间；这里导出30帧
bun run --cwd frontend video:render -- --project videos/example/project.tsx --output /tmp/example.mp4 --from-frame 210 --to-frame 239 --browser /usr/bin/chromium
```

预览地址为命令输出的 `/video.html`。每份项目默认导出 `defineVideoProject({ input, script })`，具名导出 `layers` 注册自定义组件。脚本与素材路径以项目目录为基准；新项目通过 `video:inspect` 取得对应 `source`，不复制示例指纹。更改编排、媒体或源归档后重启预览以重新准备计划，自定义 TSX 画面可由 Vite 更新。

完整字段、镜头坐标、素材和音轨约定见[离线复盘与视频指南](../docs/guides/offline-replay.md)。本轮支持已准备的音频文件和说话者元数据，TTS 服务后续接入。
