# AI Werewolf Arena · Video Production

React + Remotion 的离线复盘工作台与视频编排工具。浏览器可导入、切换后端 `record/session_*/replay.json`，加载失败可重试；本地命令也可提供只读文件。

## 本地流程

在仓库根目录运行：

```bash
bun run replay:dev -- --input ./record/session_<id>
```

也可直接传 `./record/session_<id>/replay.json`。Vite 开发与生产预览共用 `/api/replay`，不复制或改写 record；静态部署可使用浏览器文件导入。默认地址 `http://localhost:5173`。

工作台以视频为主，右侧当前事件全文持续可读；“事件／玩家／私有档案／外观”页签分别提供日与阶段分组、搜索和可暂停跟随、玩家详情、显式私档导入与外观设置。支持逐事件、逐阶段、逐帧跳转、倍速和全屏，长全文独立滚动。显示语言缺省跟随归档（旧档中文），时区缺省 UTC；语言、时区、页签和网页主题切换保留播放与筛选状态。

网页主题与减少动效偏好在本机保存，默认 `minimal-v1`；视频主题独立配置，默认 `gothic-v1`。网页外观切换不改视频项目或归档。

## 视频预览与导出

```bash
# 自动编排广播版，查看来源指纹、原事件与镜头帧区间
bun run --cwd apps/video video:inspect -- --input ../../record/session_<id>/replay.json
# 哥特广播版示例：真实十二人回放、语义场景、精确重点和镜头
bun run --cwd apps/video video:preview -- --project examples/video/gothic/project.tsx
bun run --cwd apps/video video:render -- --project examples/video/gothic/project.tsx --output /tmp/gothic-demo.mp4 --browser /usr/bin/chromium
# 长中文仅作编导稿排版示例，画面明确标注“非玩家原话”
bun run --cwd apps/video video:preview -- --project examples/video/gothic/layout-demo.tsx
# 既有椭圆桌示例保持兼容：推近、图层、自定义 TSX/SVG 与回顾
bun run --cwd apps/video video:preview -- --project examples/video/custom-layers/project.tsx
bun run --cwd apps/video video:render -- --project examples/video/custom-layers/project.tsx --output /tmp/example.png --frame 230 --browser /usr/bin/chromium
# 完整计划中的源帧闭区间，共30帧
bun run --cwd apps/video video:render -- --project examples/video/custom-layers/project.tsx --output /tmp/example.mp4 --from-frame 210 --to-frame 239 --browser /usr/bin/chromium
# 原命令继续使用统一视频准备和渲染链路
bun run --cwd apps/video replay:render -- --input ../../record/session_<id> --output /tmp/game.en.mp4 --locale en --time-zone UTC
```

独立视频预览地址为命令输出的根页面 `/`。输出 PNG 或 H.264 MP4；已有目标、源归档、项目与素材均不能覆盖。修改脚本、归档、素材或字体后重启预览以重新准备；自定义 TSX 可由 Vite 更新。

无脚本默认 `broadcast-v1`：12 人分双侧常驻名册，中央分发言、技能、票型、结算和阶段场景，日夜使用不同色板。已有脚本未声明 `layout` 时保持 `legacy-ellipse-v1`；旧 `createReplayRenderInput/buildReplayFrame` 保留90帧采样 API。新视频定位必须用原 seq 对应的揭晓帧，不能用 `index * 90`。聚合逐票明细仍可导航，姓名、身份与死亡在视频和工作台共用同一事实游标。

双侧名册按整局已裁剪的展示资料分别定宽：某侧没有可显示的姓名或模型时，1920画幅下从328.32px收至240px，空间归还中央；空单卡不创建文字槽。死亡、镜头和事件切换不会改变列宽，箭头、高亮及自定义层共用实际席位坐标。

## 主题、展示资料与扩展

主题为可序列化数据，`packages/game-media/src/themes` 提供解析、色板、选项和 CSS 变量。两套主题均有日夜色板及 typography/surface/frame/connector/effect/motion token；`largeText` 和 `reducedMotion` 默认 false。旧版已编译主题缺少新token时纯函数补齐默认，保留已有颜色、字体和显式选项：

| 主题                    | 风格与专用 options                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gothic-v1` · 哥特冷雾  | 冷灰蓝、骨白、暗红与深蓝夜色；`paperTexture`、`ornamentalFrames`、`waxSeals` 默认均为 `false`，开启后分别增加细线纹理、内框与票型图章。 |
| `minimal-v1` · 简洁看板 | 简洁明暗看板；`density: "comfortable" \| "compact"` 调整间距，`highContrast: boolean` 提升边框与次要文字对比，默认 comfortable／false。 |

单局项目默认导出 `defineVideoProject({ input, script, fonts? })`。`script.theme` 选择视频主题；`script.presentation` 按内部 playerId 字符串配置 `displayName/modelLabel/avatarKey/avatarAssetId` 和显示开关。座次优先用公开 `seat`，旧档回退原 ID；不从昵称、模型字符串或发言猜厂商和意图。未知头像用中性 SVG，完整匿名同时隐藏名称、模型并中性化头像，系统字幕和配音准备文本共用展示名单；原始发言不自动改写。

自定义 `layers` 与主题 `themeSlots` 是项目模块的独立具名导出，只注册插槽也能预览和导出。主题插槽键为 `<themeId>/<slot>`，支持 `background/frame/seatBadge/sceneHeading/transition/playerCard/speech/ballot/actionEffect`；组件进入 bundle，plan 只保留 JSON。插槽收到 `plan/view/theme/palette/playerId?/mediaBaseUrl?`，可读当前语义场景与事实游标。通过 `resolveVideoMediaSource` 解析本地素材，保持预览和导出一致。

`fonts` 显式登记本地字体 `{ family, src, weight? }`；准备时捕获原字节并以 SHA256 命名，后续源编辑不改变已准备的素材。预览和渲染等待字体加载，失败中止；字体族名应匹配主题字体栈（如 `Noto Sans SC`）或自定义组件的 `fontFamily`。不接受远程或 data 字体，不在仓库复制系统字体。完整字段和项目写法见[离线复盘与视频指南](../../docs/guides/offline-replay.md#通用视频与单局脚本)。

`scene`、`emphasis`、`edits/factEdits`、镜头和图层支持单局微调。发言主张只作原话，技能、库存、狼刀、保护归因和死亡只消费结构化事件／提交事实；证据缺失时显示未知，不在前端重跑游戏规则。`intro` 在初始事实视图前插入片头，`shotEdits` 按稳定镜头 ID 微调语音、正文、时长和镜头，不拆散原生语义合段；过期 ID 明确报错。

阶段场景可设置 `scene.textLayout: "title"`，将 `title/body` 作为主副标题直接排在原生舞台中央，保留背景和两侧名册。`emphasis` 可用 `color: "#ff8e9e"` 明确区分角色与关键规则；缺省仍使用场景强调色，不改正文字符或字幕时间。

标题场景可附加 `scene.credits: { repository: "owner/repo", agent: "pi-agent", features: ["独立会话", "工具调用"], description: "项目说明" }`，在同一舞台展示GitHub署名、Agent来源和最多三项特点；`features/description` 可省略，也可用可选 `model` 字段补充模型。资料直接写在制作稿中，仅用于画面，不自动加入配音或其他镜头；本局将具体模型和人格提示词节选放在第二页正文。

阶段场景可用 `scene.notes: { title: "模型与人格配置", body: "补充说明" }`，在主正文之后用分隔线和较小字号展示配置或提示词。补充说明仍参与同一阅读窗的量高，流程对照报告也保留全文；内容不自动加入配音，停留时长由制作稿明确设置。

## 完整流程稿与离线配音

`videos/<theme>/` 只保存本局画面稿、JSONL台词、固定选角、来源配置与制作记录；生成清单和冻结快照放在 `output/videos/<theme>/`。通用演示在 `examples/video/`，音色试听在 `examples/speech/`。视频与语音契约、时间线算法归 `src`；文件读取、项目装配和TTS准备归 `scripts`，基础设施不反向导入具体对局。

`scripts/video/authoring.ts` 提供锁定来源的 `readVideoSource` 与 `createSpeechVideoProject`，后者接收画面项目、JSONL文档及可选 `{ audio }`，仅声明估时或真实配音编排，不在导入时读取录像或编译计划。准备阶段通过 `loadVideoProject → compileLoadedVideo → prepareVideoAssets` 分层执行；估时、检查和字幕导出不读取素材字节。`scripts/video/speech-script.ts` 提供JSONL文件读取与独立选角装配；本局入口只指定文件与配置。资源路径仍以入口项目文件所在目录为基准，Node读取代码不进入浏览器图层。

先导出原生完整流程，再用 `--editable` 复制一份完整制作稿。原生文件的 `flow` 是全文对照索引；可编辑稿直接展开每个镜头的正文、配音文本、镜头和图层，并显式保存来源与版式。本局 `overrides.ts` 是完整画面副本，`visual.project.ts` 可单独预览画面对照；正式旁白与发言归 `speech.jsonl`，画面副本通过稳定ID引用玩家全文和口播，`project.ts` 按台词累加临时时钟，不叠加原生稿。可编辑稿不接受自动覆盖，后续直接修改对应镜头。

```bash
# 在仓库根目录运行；输出可执行TS原稿和可搜索的逐镜头对照
bun --no-env-file apps/video/scripts/generate-video-script.ts --input record/session_<id>/replay.json --output output/videos/<theme>/snapshots/native.generated.ts --report output/<id>/native-flow.html
# 复制完整制作稿；新路径只生成一次，之后就地修改
bun --no-env-file apps/video/scripts/generate-video-script.ts --input record/session_<id>/replay.json --output output/videos/<theme>/snapshots/editable.project.ts --editable
# 本局：原生基准 / 完整对局上的微调稿，分别预览
bun run --cwd apps/video video:preview -- --project ../../output/videos/catgirl-knight/snapshots/native.generated.ts --port 5174
bun run --cwd apps/video video:preview -- --project videos/catgirl-knight/project.ts --port 5175
# 本地检查完整配音稿，不调用云端、不需要凭据
bun --no-env-file apps/video/scripts/prepare-voices.ts --project apps/video/videos/catgirl-knight/dialogue.ts --dry-run
# 导出便于通读的完整语音稿HTML，不调用云端
bun --no-env-file apps/video/scripts/generate-speech-script.ts --script apps/video/videos/catgirl-knight/speech.jsonl --report output/session_1792391429963_4bygw6/speech-review.html
```

前端默认时长按阅读速度编排，不等于配音时长。`video:estimate` 可用 `--calibration <json>` 提供音色ID、语速参数、实测字符数和秒数；已试听声线按各自实测语速推算，未试听声线按样本整体语速估算，并给出语速上下浮动15%的区间。`--output <json>` 保存逐镜头报告，实际音频准备完成后由采样数替代估计。

腾讯云的 `Speed` 是接口参数，不直接等于倍速：`1` 对应1.2倍，`2` 对应1.5倍，换算按[官方说明](https://cloud.tencent.com/document/api/1073/37995)的分段关系。旧估时工具会将不同Speed的本地样本归一后再换算目标语速。本局已切换豆包2.0，12位猫娘玩家采用不同女声，以青春声线为主，全部角色统一 `speechRate: 20`（1.2倍）；`program` 设置左上角片名和板型，`maxDurationFrames` 可设置时长硬上限，超过时编译失败；本局不设置该限制。本局JSONL模式按实际采样重算全部时长，`readingClock: "flow"` 保留全文阅读窗，不再保留旧片头的固定阅读停留。

`packages/game-media/src/speech.ts` 按 `narrator/god/player:<id>` 分别为作者旁白、上帝和玩家选角，从完整计划提取稳定台词 ID。`scripts/tts/provider.ts` 定义统一合成与本地对齐端口；腾讯云 `TextToVoice` 和豆包2.0 HTTP SSE适配器可在同一项目混用。长文当前按句保守切至每块140字符；PCM WAV缓存以服务商、文字、声线、参数、take 和分句策略摘要命名，实际采样数决定时长。独立分段缓存支持复用未改变的文本块；`synthesisChunks` 可固定局部重录边界。修改 `take` 可保存新的试听版本。失败不自动重试已发送请求，已成功分块可在下次显式运行时复用；缓存损坏直接报错。

只有显式运行语音准备命令才会联网。确认需发送的台词后，可在仓库根目录运行 `bun --env-file=.env.tts.local apps/video/scripts/prepare-voices.ts --project apps/video/videos/<id>/dialogue.ts`，也可用 `--script speech.jsonl --casting casting.ts` 直接准备JSONL；腾讯云凭据使用 `TENCENTCLOUD_SECRET_ID/TENCENTCLOUD_SECRET_KEY`，豆包新版控制台使用 `VOLCENGINE_TTS_API_KEY`，不进入项目、素材或浏览器。`--only <id,id>` 选择性准备，`--check` 离线检查完整缓存。本机 `output/videos/<theme>/dialogue/speech.generated.ts` 以简短索引引用JSON对齐明细，合成和绑定共用规范化声线身份，改显示名不重录。本局 `voiced.ts` 通过 `applySpeechScript` 替换全部场景时钟；`compile-speech-video.ts` 可进一步生成单条连续WAV、真实时间报告及完整SRT，命令见[离线语音与字幕](../../docs/guides/offline-speech.md#完整jsonl稿与语音驱动编排)。旧项目仍可使用 `bindVideoSpeech`。

`packages/game-media/src/speech-timing.ts` 将服务商时间戳统一为音频局部毫秒，并按标点、长度和停顿生成底部短字幕。字幕与中央完整正文独立；`DialogueLine.subtitles` 可手改断句、文字和时间，或设为false关闭，不改变音频缓存。没有时间戳时不估造；可通过 `SpeechAligner` 端口补齐本地对齐，具体模型尚未接入。`subtitles: { requireTiming: true }` 可让有声绑定拒绝缺字幕的行。腾讯云请求 `EnableSubtitle`，部分超自然音色可能返回空值；豆包2.0请求 `enable_subtitle`，支持中英文字级时间。`video:subtitles -- --project videos/<id>/voiced.ts --output ../../output/<id>/subtitles.srt` 从正式时间轴导出SRT，已有输出不会覆盖。接入凭据、试听和手动字幕示例见[离线语音与字幕](../../docs/guides/offline-speech.md)。

需要Node读取录像的项目可用 `visuals: "./visuals.tsx"` 单独登记浏览器图层；预览和导出只打包该模块。历史项目的内联 `layers/themeSlots` 仍受支持。渲染和预览不生成语音，缺失或过期台词由有声项目报错。

哥特主题使用20张原创本地环境/道具素材，含血狼爪、古镜、药瓶、双剑、弩、枪、盾、契约及银/蚀报告印记；结合薄旧金属框、铭牌和LLM图标圆章。中央舞台透明，只在真实文字与票图背后铺局部衬底。图片不含文字、身份答案或库存；镜面保持中性，查验结果单独按事实揭晓。素材及内置 imagegen 的完整提示词见 [`packages/game-media/src/video/assets/gothic/manifest.json`](../../packages/game-media/src/video/assets/gothic/manifest.json)。`minimal-v1` 保持简洁模板；主题的 background/frame/actionEffect 插槽可替换相应美术层。

## 模块与验证

- `apps/replay/src/main.tsx → App.tsx → packages/game-media/src/replay/ReplayWorkspace.tsx`：文件状态与工作台；播放控制由 `useReplayPlayback` 拥有。
- `offline-replay.ts`：公开 God 文档的读取与校验；`replay-projection.ts`：唯一事实投影和前缀索引。
- `packages/game-media/src/video`：编译 `VideoPlan`、语义场景、状态揭晓 cue 与共用 `VideoComposition`；长文分页，按两语阅读预算及settled后完整停留编译自动时长；`captionPageRanges` 明确每页帧区间。
- `packages/game-media/src/video/plan`：纯数据公开入口，供准备/检查命令及编译消费者使用；`packages/game-media/src/video/render`：React／Remotion 画面与音轨入口。旧 `packages/game-media/src/video` 继续兼容既有项目，包含渲染依赖；新消费者按职责选择入口。
- 编译内部按 `records → source-index → shot-content → shot-timing → shot-state/tracks → plan` 分工。记录解释只在本次编译和玩家名单内共享；单镜头调度同时拥有字幕、结果及语音时段，事实切换消费其揭晓节点，不由主题重新计时。
- `video/render/broadcast` 分别拥有常驻名册、发言、票型、行动、公告及正文强调；宿主只求值一次帧视图。哥特道具选择、素材组合与报告封印在 `themes/gothic`，通用连接线与有限动画时钟仍由视频层拥有。
- `packages/game-media/src/presentation`：白名单展示资料、LLM头像徽记与64角色小纹章；`packages/game-media/src/themes`：共用主题数据及独立网页偏好。
- 私有档案只在浏览器显式导入，不自动发现其他玩家，不参与视频或授予 God 信息。角色视角舞台、公开脱敏、在线观战与 MP4 任务队列仍不属于当前范围。

```bash
bun run --cwd apps/video test
bun run --cwd apps/video typecheck
bun run --cwd apps/video build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium bun run --cwd apps/video test:e2e
```

缺省使用 Playwright 安装的浏览器。产物范围、事实边界与资源生命周期见[离线复盘指南](../../docs/guides/offline-replay.md)。

## 真实美术验收图库

验收数据来自签入教学归档及明确标注“非真实对局”的边界用例，构造器在 `tests/support/art-gallery-cases.ts`。以下命令复用正式 `VideoComposition`，不生成概念截图：

```bash
bun run --cwd apps/video scripts/render-art-gallery.ts --output /tmp/awa-gallery --browser /usr/bin/chromium
# 精确选择并导出完整建立/揭晓/停稳过程（每镜头最多六秒的验收片段）
bun run --cwd apps/video scripts/render-art-gallery.ts --output /tmp/awa-motion --browser /usr/bin/chromium --ids knife-mapped,report-camp-wolf --motion
```

输出为PNG、可选MP4、索引与来源摘要。`--only` 按ID子串筛选，`--ids` 精确逗号列表；`--resume` 只续接同目录已有记录且保留每张原sourceDigest，不覆盖已有图。脚本拒绝重复case ID；空 `reviewedBy` 明确表示尚未人工验收，导出成功不代表美术通过。

配音时间安排统一归 `packages/game-media/src/speech-clock.ts`。JSONL首行的 `timing` 可分别设置换人、上帝短句、阶段、结算与片尾的额外留白，每行 `pauseAfterMs` 可覆盖，包括0。第二版采用玩家换人600ms、普通上帝场景250ms、阶段900ms、结果800ms、片尾3000ms；字幕延后400ms后清空。关键帧与图层的 `clock` 独立指定起点锚点和固定／伸缩时长，默认不把短特效随配音拉长。

完整TS副本仍可直接编辑；`scene.bodySource` 表示来源，`scene.bodyLayout` 单独选择 `structured/text`，不按正文相等与否切版式。字幕、开场标题与承载面样式归主题tokens，安全区统一由layout计算。

`compile-speech-video.ts` 在候选目录完成最终计划与字幕校验后，整组发布 `build-<摘要>/`，失败不留下半组产物。整片可使用 `video:render-production -- --project <已编译项目> --output <movie.mp4> --workers 6` 分段渲染并统一封装音轨；进度、分段和冻结bundle保存在输出目录，正式音频持续位于仓库output下。详细命令及职责见[离线语音与字幕](../../docs/guides/offline-speech.md)。

## 正式制作目录

单局作者稿采用 `videos/trusted-wolf`、`videos/catgirl-knight`、`videos/glm-comeback` 等短主题名；来源sessionId仍用于校验归档。`production.ts` 统一项目和本机输出路径，选角装配、文件读取、混音、发布与审片实现在 `scripts/video/`。所有生成语音明细、冻结快照和视频进入忽略的 `output/videos/<theme>/`，不在作者目录复制生成数据。

从原来 `output` 临时工具整理出的维护入口为 `video:produce`、`video:audio`、`video:review` 和 `video:verify`。分阶段命令、历史产物兼容与目录迁移见[视频制作指南](../../docs/guides/video-production.md)，各局文件职责见[作者目录](videos/README.md)。
