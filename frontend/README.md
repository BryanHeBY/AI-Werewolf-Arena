# AI Werewolf Arena · Replay Studio

React + Remotion 的离线复盘工作台与视频编排工具。浏览器可导入、切换后端 `record/session_*/replay.json`，加载失败可重试；本地命令也可提供只读文件。

## 本地流程

在仓库根目录运行：

```bash
bun run --cwd frontend replay:dev -- --input ../record/session_<id>
```

也可直接传 `../record/session_<id>/replay.json`。Vite 开发与生产预览共用 `/api/replay`，不复制或改写 record；静态部署可使用浏览器文件导入。默认地址 `http://localhost:5173`。

工作台以视频为主，右侧当前事件全文持续可读；“事件／玩家／私有档案／外观”页签分别提供日与阶段分组、搜索和可暂停跟随、玩家详情、显式私档导入与外观设置。支持逐事件、逐阶段、逐帧跳转、倍速和全屏，长全文独立滚动。显示语言缺省跟随归档（旧档中文），时区缺省 UTC；语言、时区、页签和网页主题切换保留播放与筛选状态。

网页主题与减少动效偏好在本机保存，默认 `minimal-v1`；视频主题独立配置，默认 `gothic-v1`。网页外观切换不改视频项目或归档。

## 视频预览与导出

```bash
# 自动编排广播版，查看来源指纹、原事件与镜头帧区间
bun run --cwd frontend video:inspect -- --input ../record/session_<id>/replay.json
# 哥特广播版示例：真实十二人回放、语义场景、精确重点和镜头
bun run --cwd frontend video:preview -- --project videos/gothic-demo/project.tsx
bun run --cwd frontend video:render -- --project videos/gothic-demo/project.tsx --output /tmp/gothic-demo.mp4 --browser /usr/bin/chromium
# 长中文仅作编导稿排版示例，画面明确标注“非玩家原话”
bun run --cwd frontend video:preview -- --project videos/gothic-demo/layout-demo.tsx
# 既有椭圆桌示例保持兼容：推近、图层、自定义 TSX/SVG 与回顾
bun run --cwd frontend video:preview -- --project videos/example/project.tsx
bun run --cwd frontend video:render -- --project videos/example/project.tsx --output /tmp/example.png --frame 230 --browser /usr/bin/chromium
# 完整计划中的源帧闭区间，共30帧
bun run --cwd frontend video:render -- --project videos/example/project.tsx --output /tmp/example.mp4 --from-frame 210 --to-frame 239 --browser /usr/bin/chromium
# 原命令继续使用统一视频准备和渲染链路
bun run --cwd frontend replay:render -- --input ../record/session_<id> --output /tmp/game.en.mp4 --locale en --time-zone UTC
```

预览地址为命令输出的 `/video.html`。输出 PNG 或 H.264 MP4；已有目标、源归档、项目与素材均不能覆盖。修改脚本、归档、素材或字体后重启预览以重新准备；自定义 TSX 可由 Vite 更新。

无脚本默认 `broadcast-v1`：12 人分双侧常驻名册，中央分发言、技能、票型、结算和阶段场景，日夜使用不同色板。已有脚本未声明 `layout` 时保持 `legacy-ellipse-v1`；旧 `createReplayRenderInput/buildReplayFrame` 保留90帧采样 API。新视频定位必须用原 seq 对应的揭晓帧，不能用 `index * 90`。聚合逐票明细仍可导航，姓名、身份与死亡在视频和工作台共用同一事实游标。

双侧名册按整局已裁剪的展示资料分别定宽：某侧没有可显示的姓名或模型时，1920画幅下从328.32px收至216px，空间归还中央；空单卡不创建文字槽。死亡、镜头和事件切换不会改变列宽，箭头、高亮及自定义层共用实际席位坐标。

## 主题、展示资料与扩展

主题为可序列化数据，`src/themes` 提供解析、色板、选项和 CSS 变量。两套主题均有日夜 token：

| 主题                    | 风格与专用 options                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gothic-v1` · 哥特冷雾  | 冷灰蓝、骨白、暗红与深蓝夜色；`paperTexture`、`ornamentalFrames`、`waxSeals` 默认均为 `false`，开启后分别增加细线纹理、内框与票型图章。 |
| `minimal-v1` · 简洁看板 | 简洁明暗看板；`density: "comfortable" \| "compact"` 调整间距，`highContrast: boolean` 提升边框与次要文字对比，默认 comfortable／false。 |

单局项目默认导出 `defineVideoProject({ input, script, fonts? })`。`script.theme` 选择视频主题；`script.presentation` 按内部 playerId 字符串配置 `displayName/modelLabel/avatarKey/avatarAssetId` 和显示开关。座次优先用公开 `seat`，旧档回退原 ID；不从昵称、模型字符串或发言猜厂商和意图。未知头像用中性 SVG，完整匿名同时隐藏名称、模型并中性化头像，系统字幕和配音准备文本共用展示名单；原始发言不自动改写。

自定义 `layers` 与主题 `themeSlots` 是项目模块的独立具名导出，只注册插槽也能预览和导出。主题插槽键为 `<themeId>/<slot>`，支持 `background/frame/seatBadge/sceneHeading/transition/playerCard/speech/ballot/actionEffect`；组件进入 bundle，plan 只保留 JSON。插槽收到 `plan/view/theme/palette/playerId?/mediaBaseUrl?`，可读当前语义场景与事实游标。通过 `resolveVideoMediaSource` 解析本地素材，保持预览和导出一致。

`fonts` 显式登记本地字体 `{ family, src, weight? }`；准备时捕获原字节并以 SHA256 命名，后续源编辑不改变已准备的素材。预览和渲染等待字体加载，失败中止；字体族名应匹配主题字体栈（如 `Noto Sans SC`）或自定义组件的 `fontFamily`。不接受远程或 data 字体，不在仓库复制系统字体。完整字段和项目写法见[离线复盘与视频指南](../docs/guides/offline-replay.md#通用视频与单局脚本)。

`scene`、`emphasis`、`edits/factEdits`、镜头和图层支持单局微调。发言主张只作原话，技能、库存、狼刀、保护归因和死亡只消费结构化事件／提交事实；证据缺失时显示未知，不在前端重跑游戏规则。已准备的音轨和 `god/player:<id>` 说话者元数据可接入；TTS 服务尚未接入。

哥特主题使用原创本地雾景、古镜和药瓶，结合代码绘制的旧金属框、铭牌和LLM图标圆章。图片不含文字、身份答案或库存；镜面保持中性，查验结果单独按事实揭晓。素材及内置 imagegen 的完整提示词见 [`src/video/assets/gothic/manifest.json`](src/video/assets/gothic/manifest.json)。`minimal-v1` 保持简洁模板；主题的 background/frame/actionEffect 插槽可替换相应美术层。

## 模块与验证

- `main.tsx → App.tsx → replay/ReplayWorkspace.tsx`：文件状态与工作台；播放控制由 `useReplayPlayback` 拥有。
- `offline-replay.ts`：公开 God 文档的读取与校验；`replay-projection.ts`：唯一事实投影和前缀索引。
- `src/video`：编译 `VideoPlan`、语义场景、状态揭晓 cue 与共用 `VideoComposition`；长文分页，两语最大页数确定自动时长。
- `src/presentation`：白名单展示资料与原创 SVG 徽记；`src/themes`：共用主题数据及独立网页偏好。
- 私有档案只在浏览器显式导入，不自动发现其他玩家，不参与视频或授予 God 信息。角色视角舞台、公开脱敏、在线观战与 MP4 任务队列仍不属于当前范围。

```bash
bun run --cwd frontend test
bun run --cwd frontend typecheck
bun run --cwd frontend build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium bun run --cwd frontend test:e2e
```

缺省使用 Playwright 安装的浏览器。产物范围、事实边界与资源生命周期见[离线复盘指南](../docs/guides/offline-replay.md)。
