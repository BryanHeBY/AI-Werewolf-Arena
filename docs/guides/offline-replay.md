# 离线模拟、复盘与视频

## 受限模拟与严格动作复现

```bash
bun run --cwd backend simulate --configs-dir ../configs.example --board twelve_player_standard --count 25
bun run --cwd backend replay:actions --record ../record/<session-id>/reproduction.json
```

模拟使用明确受限观察机器人和固定seed输入，不调用模型，也不证明原始God baseline符合玩家信息边界。seed仅固定随机流，模型原文和不同动作仍能改变结果。

严格复现读私有Tape并核真实source／lock／RNG／ruleset；不是公开replay播放器。源码路径／注释改变身份时拒旧构建是有效政策，不改旧hash或删掉字段求通过。

## 公开复盘

```bash
bun run --cwd backend export:replay -- --session <session-id> --out ./<session-id>.replay.json
bun run dev:frontend
```

播放器只读导出的公开God档，不给对局Agent新增底牌知识。公共reader支持已声明旧格式，不等于能运行旧Tape。manifest／逐玩家档含不同隐私与身份字段，不通过复制God文件模拟玩家视角。

前端视频／图片命令保其package.json和README中的实际参数，使用离线输入。不得覆盖已有目标或源文件；浏览器、渲染器和写盘资源按各owner关闭，必需产物错误应失败。修改展示后，双语词典key／placeholder／原文与实际video入口需各自验证。

fixture通过稳定origin／suite选择，loader根据manifest currentPath定位。组织slug更名只改current位置，origin key／archive字节／RNG seed不随之替换。

## 查看玩家思考与工具轨迹

游戏回放工作台右侧“私有档案”页签中的“玩家私有输出”支持显式导入 `record/<session>/players/player_7.json` 等玩家档案。文件只在当前浏览器内存中解析，不上传，不自动发现其它玩家文件，也不合并到游戏回放或视频。可用“清除私有档案”撤回内容。

分类、双语标签、开关和色调与终端共享：思考／消息为灰色，失败为警告或错误色；工具参数与回执可在逐轮详情中展开。玩家文件是独立档案，页面不把它假定为当前游戏的相同会话。旧档未明确区分思考与消息时显示“模型输出”，不会从正文猜测或生成思考。

## 通用视频与单局脚本

`frontend/src/video` 是工作台和离线渲染共用的基础设施。`compileVideoPlan` 从规范复盘及可选 `VideoScript` 编译纯 JSON `VideoPlan`；预览、图片、音轨和片段导出消费同一时间线。可执行命令见 [frontend README](../../frontend/README.md#视频预览与导出)。

新项目的纯编排函数、类型及帧查询从 `src/video/plan` 导入；React／Remotion 组件从 `src/video/render` 导入。旧 `src/video` 入口继续兼容。编译内部复用同一份已校验记录解释，原始事件读取入口继续独立校验；脚本署名、正文及镜头标注不覆盖记录事实。字幕页、结果揭晓和已准备语音共用单镜头调度，状态 cue 绑定同一揭晓节点。主题实现只消费求值后的画面与节点，不重新解释事件或提交生命状态。

### 默认广播与旧版兼容

无脚本时默认 `broadcast-v1`，画幅1920×1080：12人分左右各6席，名册固定，中央按结构化出处显示发言、技能、票型、结算、阶段与通用说明。日夜使用独立色板；原文与身份牌分开，玩家声称不会改真实身份。移动网页提供独立全文和席位查看，完整视频可全屏横向观看。

新广播默认以较紧凑的正文完整显示一段发言，放不下时按编译帧匀速上移，首尾留有停留；普通狼聊与结束狼聊共用玩家署名。旧计划、显式分页和作者时长保留兼容行为。`VideoScene.content` 是网页与视频共用的纯结构块，票型、报告、库存和胜利分别排版；自由发言仍保留原文，不识别意图。库存事实保留原捕获位置，默认不单独播报，女巫行动只显示能按角色能力实例匹配到的记录；未知值不补零。

### 真实记录的场景审计

从仓库根目录运行 `bun --no-env-file frontend/scripts/audit-video.ts --input record`，或在前端运行 `bun run video:audit`。可加 `--theme minimal-v1`、`--max-files 500`、`--output <新文件>`。报告包含每份公开复盘的字节SHA256、来源指纹、完成状态、名册来源、实际版式、模板、原事件/事实序号和镜头帧。它不包含正文、提示词或接入配置，也不改写record。进行中God档案顶层名册为空时，仅消费明确且校验合格的开局记录；没有可靠名册则单独报错。

处理等级分为专门场景、显式紧凑简报、仍采用通用文字记录、未知/无效事件。存在路由不等于已有专门画面，去掉文件图标也不等于全部覆盖。默认遇坏档继续扫其余档案，并以失败退出；`--fail-on unhandled` 可将未知/无效事件设为门禁，`--fail-on generic` 再要求清除所有通用记录。空目录、截断扫描、并发写入导致快照变化均不会报告成功。扫描只认`replay.json`/`*.replay.json`，跳过私档、符号链接和嵌套源码；包含模拟数据的目录会如实列路径，不能把总数全称为真实运行对局。

`render-art-gallery.ts --input <复盘>` 可从同一真实快照抽取关键节点和最长发言首中尾，保留缺省头像，不注入模型图标掩盖缺省问题。`--repairs` 提供标明非真实对局的64角色、长文、双主题终局等边界验收；两种来源互斥。输出目录、浏览器参数与原图库命令一致。JSON诊断不能代替真实PNG和连续帧的人工审查。

名册左右独立按整局裁剪后的 `playersPresentation` 判宽：整侧没有非空姓名和模型时，列宽由画幅17.1%收至11.25%，中央收回对应空间。资料只有部分玩家可见时，该侧仍保留完整列宽，但无资料的单卡不创建空文字槽。列宽不受生死、当前发言或聚焦影响；舞台、字幕安全区、相机、席位锚点和自定义图层共用同一几何，不只用 CSS 偷缩卡片。

既有脚本未声明 `layout` 时使用 `legacy-ellipse-v1`，保留1280×720椭圆桌与原镜头语义；新脚本可显式选择任一版本。旧 `createReplayRenderInput/buildReplayFrame` 保留90帧采样兼容，主工作台与导出按计划导航。原事件序号、展示数组下标、镜头下标和局部帧不是同一个时钟，禁止用 seq 或展示下标直接乘90。

### 项目、来源与时长

- `video:inspect --input <file>` 输出 `source` 的 session、规范化内容指纹、镜头及帧范围。将对应 `source` 填入单局脚本，不复制其他局的指纹。它校验误绑来源，不是安全签名，也不替代严格 Tape 的身份检查。
- 默认导出 `defineVideoProject({ input, script, fonts? })`。`input`、本地素材和字体以项目目录解析；TS/TSX 是本地开发源码，JSON 项目只携带数据。
- `edits[].anchor` 用原始 `{ seq, type }` 精确匹配；`factEdits[].anchor` 用独立事实 `{ seq, kind }` 匹配，两种序号不可混用。均可覆盖时长、说明、镜头、图层、配音准备、语义场景与重点，或 `skip` 跳过画面；被跳过的真实状态仍影响后续镜头。
- `holds` 在 `after` 原事件后插入固定帧停留；`stateAt` 可指向旧事件作回顾，之后镜头仍按原游标取状态。
- 默认短镜头至少三秒；长文分页后自动扩展，中文、英文最大页数决定自动时长。`durationFrames/defaultEventFrames/captionPageFrames` 可显式调整，不自动删改原发言。非发言说明从揭晓后分页，字幕和事实揭晓使用同一计划。
- `video:render --from-frame A --to-frame B` 使用完整计划的闭区间 `[A,B]`，共 `B-A+1` 帧；`--frame N` 输出PNG。已有目标、源归档、项目和素材均不能覆盖。

### 主题、选项与插槽

网页和视频共用 `src/themes` 的纯数据主题定义、解析与日夜 token，但选择独立：网页默认 `minimal-v1`，网页主题／减少动效只保存在本机，不修改视频计划；默认视频主题为 `gothic-v1`。

| 视频主题                 | 选项与默认值                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gothic-v1`（哥特冷雾）  | 冷灰蓝／骨白／炭黑／干血暗红，夜间深蓝黑与月光；`paperTexture: false`、`ornamentalFrames: false`、`waxSeals: false`。显式开启后增加低对比细线纹理、内框和票型结果图章。 |
| `minimal-v1`（简洁看板） | 清晰明暗看板；`density: "comfortable"`（也可 `"compact"`）、`highContrast: false`。分别控制间距与边框／次要文字对比。                                                   |

`script.theme = { id, options? }` 只接受该主题的白名单选项，未知主题、跨主题选项或错误值失败。`resolveTheme` 输出独立 JSON 数据；palette 区分画布文字 `canvasText/canvasMuted` 与面板文字 `text/muted`，不把浅色面板字直接用于深色背景。

哥特舞台默认透明；发言、票图和通知各用局部暗衬，日夜均保留骨白正文与可见雾景。名册使用薄旧金属线与少量角件，`ornamentalFrames` 可显式加饰。`GothicArt` 独立拥有本地环境与无字技能道具，素材路径由两个 bundler 静态打包，不写入归档、身份或原文。图标头像保留LLM徽记，不强制替换成人物画像；背景、边框和技能道具仍可分别由主题插槽覆盖。

项目模块可独立具名导出 `themeSlots`，不要求同时有 `layers`。注册键固定为 `<themeId>/<slot>`：

| slot                                               | 用途                           |
| -------------------------------------------------- | ------------------------------ |
| `background`、`frame`、`transition`                | 背景、中央边框和过渡装饰       |
| `seatBadge`、`playerCard`                          | 座次徽记与玩家卡内容           |
| `sceneHeading`、`speech`、`ballot`、`actionEffect` | 场景标题、发言、票型与行动效果 |

插槽组件只进 bundle，不进入 JSON，不执行字符串组件名恢复。未注册时使用默认模板；未登记的键或非组件值被拒绝。`VideoThemeSlotProps` 提供 `plan/view/theme/palette/playerId?/mediaBaseUrl?`，其中 `view` 含当前事实视图、语义场景、局部帧与双游标。逐帧行为从显式帧计算，不依赖组件上次播放到哪里。

```tsx
import { defineVideoProject } from "../../src/video-project";
import type { VideoThemeSlotRegistry } from "../../src/video/theme-renderers";

export const themeSlots: VideoThemeSlotRegistry = {
  "gothic-v1/sceneHeading": ({ view, palette }) => (
    <h2 style={{ margin: 0, color: palette.text }}>{view.scene.title}</h2>
  ),
};

export default defineVideoProject({
  input: "./game.replay.json",
  script: {
    source: { sessionId: "填入本局 inspect 输出", fingerprint: "填入本局指纹" },
    layout: "broadcast-v1",
    theme: { id: "gothic-v1", options: { ornamentalFrames: true } },
  },
  // 使用自己有权使用的本地字体；此示例路径需自行准备，不含字体下载。
  fonts: [{ family: "Noto Sans SC", src: "./fonts/body.woff2", weight: "400 700" }],
});
```

以上片段按 `frontend/videos/<name>/project.tsx` 的位置导入 API，来源与资源路径需替换成本局实际值；可直接运行的广播版见 `frontend/videos/gothic-demo/project.tsx`，旧椭圆桌示例见 `frontend/videos/example/project.tsx`。

### 本地字体与素材固化

`fonts` 是项目级 `{ family, src, weight? }[]`，接受本地路径或本地 file URL；HTTP(S)、data 字体、同 family／weight 重复项、额外字段与错误权重被拒绝。`weight` 缺省 normal，可用 bold、整百字重或前小后大的变量范围（例如 `400 700`）；normal／bold 规范化为400／700，family 去首尾空格并忽略大小写判重。字体族名应对应主题字体栈，如 `Noto Sans SC/Noto Serif SC`，或组件显式声明的 `fontFamily`。未提供时加载项目内置完整SC字库；项目同family定义显式替换对应内置定义，不能静默回退。固定版本、源提交和OFL许可见 `frontend/src/themes/fonts`。

准备器捕获本地素材和字体字节，按SHA256内容摘要写入临时素材目录；plan 只引用 `assets/<digest>.<ext>`，绝对源路径只留在命令侧。准备后的源文件修改不会改变该次预览／导出的已捕获字节，源文件保持不写回；要采用新字节须重新准备。

预览和导出共用 `VideoFonts` 等待字体加载，失败明确终止，不以静默换字体完成产物。自定义组件通过 `resolveVideoMediaSource(asset.src, mediaBaseUrl)` 取得当前宿主地址；预览使用只读素材端点，导出使用准备目录。

### 玩家展示与匿名

原事件始终引用内部 `player_id`；公开 `seat` 只决定显示座次和稳定位置，旧档缺省回退原ID，不按数组位置重编号。公开 `name/model` 均可缺省。`script.presentation` 支持全局 `anonymous/showNames/showModels/showAvatars`，以及按 playerId 字符串配置的 `players`：

```ts
presentation: {
  showModels: false,
  players: {
    "7": { displayName: "旅人", avatarKey: "neutral" },
    "11": { modelLabel: "本局模型标签", avatarAssetId: "portrait-11" },
  },
}
```

单人可设置 `showName/showModel/showAvatar`；`avatarAssetId` 必须引用已登记图片，与 `avatarKey` 互斥。内置 `neutral/openai/anthropic/deepseek/gemini/qwen/doubao/kimi/glm` 是原创代码徽记，不从名称、模型字符串或话语推断厂商。新计划缺省使用auto：只按当前许可角色显示主题徽记，未知身份使用中性材质章；显式neutral、隐藏头像及旧计划保持原意。公开 seat 已明确时不允许单局配置偷偷换座；重复座次和未知玩家映射失败。

完整匿名隐藏名称、模型和可识别代理的头像，auto仍可展示当前已许可的游戏角色；单独隐藏模型文字不等于完整匿名。系统说明、玩家标签和自动配音准备文本使用同一裁剪名单。原始发言仅保持原文，里面自行报出的名称／模型不会被自动替换；需要调整时用本局脚本明确编辑显示或配音文本，不使用NLP识别意图。

### 语义场景、重点与事实边界

`scene` 可明确覆盖 `kind/title/body/speaker/actorId/targetIds/cues`；场景种类为 `speech/action/ballot/settlement/phase/fallback`。正文取值优先级为 `scene.body → caption → 默认正文`，显式空字符串也生效；明确改写后标记为 script 来源，不更改源归档。查验等场景统一显示该正文的当前分页，不额外追加未经分页的原报告；原报告仍保留在场景数据中。

`emphasis: [{ text, occurrence? }]` 可直接强调默认正文，也可强调作者替换的正文；只匹配精确片段，重复次数从0开始，不猜测同义词、发言主张或目标。重点定位跨字幕页仍按原正文切片；票型与库存场景同样保留作者文字和重点，票数与库存事实不因此改变。

`cues` 使用镜头局部帧 `establish → travel → impact → settled`，按非降序落在镜头时长内；真实席位快照在相应揭晓帧切换。相机聚焦名单也是明确的关键帧数据，台词中提到玩家不会自动移动镜头。

默认只聚合同窗口、连续且有明确汇总的逐票／修正；PK、阶段变化、导演锚点和提交事实可切开分组。加权票数、弃票、未知权重与乌鸦修正来自原记录，不在前端计算胜者。被吸收明细的原seq仍在 `eventFrames`，`getVideoEventFrame(plan, seq)` 返回实际揭晓帧；回顾不替代主出处，未编入的事件返回null。工作台跳转与视频共用 `currentView/sourceSeq/sourceFactSeq`，聚合不提前宣告死亡，倒看也不遗留未来状态。

新God归档可带独立 `facts` 与 `factCoverage.committedDeaths = 1`。有覆盖声明时，放逐／夜报／攻击提案不直接判死，生命只跟随 `life_committed`；无原事件隔开的同日多项死亡可同时揭晓。狼刀终点、药物库存和保护归因分别消费对应已提交事实。旧档没有这些事实时按既有严格reader兼容展示，不从狼刀票推最终刀口，不从用药推救活、库存或保护归因，也不重新运行后端规则。

导演标注的发言指向和声称仅是节目说明；查验报告读当时typed事件，不能以当前真实角色替换报告。身份真相、公开翻牌与当事人主张分层展示。私档导入不会合并或产生God事实流；JSON结构校验不是来源认证，严格Tape复现另行核验。

### 镜头、图层与后续配音

`camera` 是镜头局部帧关键帧：首帧必须为0，严格递增且位于镜头内。`target` 为 `"table"` 或 `{ playerIds: [...] }`，显式 zoom 为绝对倍率，easing 支持 smooth/linear/hold。旧椭圆版省略 zoom 时自动框选目标；广播版使用中央默认倍率与明确聚焦面板，固定席位HUD和台词，镜头只变换中央图形，放大可能裁切图形。相机关注对象不会替换真实行动者。

图层声明 `id/from/durationFrames/space/zIndex`。screen 的显式 x/y 固定在画幅；广播版玩家锚点属于固定HUD，world 显式坐标经中央stage矩阵；旧椭圆版的玩家屏幕锚点由原世界坐标投影。内置 text/arrow/spotlight/highlight/flash/shake，效果由帧号和seed计算，暂停、倒看和导出可重复。

复杂效果用 `{ kind: "custom", component, props }`，模块具名导出 `layers` 注册组件；`CustomVideoLayerProps` 提供局部帧、镜头、plan、JSON参数、当前场景／事实视图和 `mediaBaseUrl`。组件进入bundle，props只允许JSON；预览和导出加载同一份模块。`themeSlots` 与 `layers` 可以各自独立存在。

`media` 登记 `id/kind/src` 及可选尺寸／时长；本地文件按捕获字节准备，媒体的显式HTTP(S)地址仍为外部依赖，内容变化不保证重现。自定义图层可显示图片和视频，`audio` 播放已准备音频。

音轨使用绝对 from、assetId、offsetFrames、时长、音量与淡入淡出；track 为 voice/music/sfx。未知素材时长必须给定音轨时长，越过已知媒体或完整时间线会失败。`speech` 是镜头局部的独立配音文本，speaker 支持 god 和 player:<id>；可绑定已备音频，未绑定时只记录准备信息。

TTS provider、自动语音生成和自动背景音乐压低尚未接入。预览退出会关闭自有子进程并清理临时目录；工作台私有输出开关不参与视频计划。
