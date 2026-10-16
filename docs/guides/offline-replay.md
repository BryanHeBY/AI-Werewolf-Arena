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

游戏回放工作台下方的“玩家私有输出”支持显式导入 `record/<session>/players/player_7.json` 等玩家档案。文件只在当前浏览器内存中解析，不上传，不自动发现其它玩家文件，也不合并到游戏回放或视频。可用“清除私有档案”撤回内容。

分类、双语标签、开关和色调与终端共享：思考／消息为灰色，失败为警告或错误色；工具参数与回执可在逐轮详情中展开。玩家文件是独立档案，页面不把它假定为当前游戏的相同会话。旧档未明确区分思考与消息时显示“模型输出”，不会从正文猜测或生成思考。

## 通用视频与单局脚本

`frontend/src/video` 是工作台和离线渲染共用的视频基础设施。`compileVideoPlan` 对规范复盘生成默认镜头，可用 `VideoScript` 增量调整；产出的 `VideoPlan` 只有 JSON 数据，画面、音轨和片段导出均消费同一时间线。命令与可直接运行示例见 [frontend README](../../frontend/README.md#单局脚本与视频预览)。

旧 `createReplayRenderInput/buildReplayFrame` 保留90帧采样兼容，供既有逐帧调用方使用；主工作台和导出通过计划的镜头起点导航。新代码按原事件 seq 查询计划，不能把展示下标或原 seq 直接乘90作为视频帧。

### 来源、事件与时长

- `video:inspect --input <file>` 输出 `source` 的 session 与内容指纹、镜头 ID、起始帧和时长。指纹针对规范化内容，发现误绑文件；它不是安全签名，也不替代严格 Tape 的来源检查。
- 项目默认导出 `defineVideoProject({ input, script })`。`input` 和本地素材以项目文件所在目录解析；TS/TSX 项目是本地开发源码，JSON 项目只携带数据。
- `edits[].anchor` 通过原始 `{ seq, type }` 精确匹配。默认隐藏的逐项投票也能显式编排，`skip` 只跳过画面，完整历史中的死亡、身份、阵营和警徽变化仍参与后续投影。
- `holds` 在 `after` 原事件后插入固定帧停留；可用 `stateAt` 指向旧事件制作回顾，后续镜头仍按自己的原游标取状态。
- 默认每个短事件至少三秒；长字幕分页后自动扩展，中文和英文页数取最大以稳定语言切换时的边界。`durationFrames`、`defaultEventFrames`、`captionPageFrames` 可显式调整，原始发言不修改。
- `video:render --from-frame A --to-frame B` 使用完整计划中的闭区间 `[A,B]`，包含 `B-A+1` 帧；`--frame N` 导出单张 PNG。已有目标、原归档、项目或素材不能覆盖。

### 镜头与图层

`camera` 是镜头局部帧关键帧：首帧必须为 0，帧号严格递增且落在镜头内。`target` 可为 `"table"` 或 `{ playerIds: [...] }`；省略 `zoom` 时自动框住目标，显式 `zoom` 是绝对场景倍率。`easing` 支持 `smooth`、`linear`、`hold`，描述驶向下一关键帧的插值。

图层声明 `id`、局部 `from`／`durationFrames`、`space` 和 `zIndex`。`world` 随镜头运动，`screen` 固定在画幅上；屏幕空间若使用玩家锚点，则映射至该玩家的当前屏幕位置。内置 `text`、`arrow`、`spotlight`、`highlight`、`flash`、`shake`。所有效果由帧号与固定 seed 计算，暂停、倒看和导出可重复。

复杂效果使用 `{ kind: "custom", component, props }`，项目模块具名导出 `layers` 注册函数、class、memo 或 forwardRef 组件。组件通过 bundle 接入，不能放进 plan 或 props JSON。`CustomVideoLayerProps` 提供局部帧、镜头、计划、纯数据参数和 `mediaBaseUrl`；本地素材使用 `resolveVideoMediaSource(asset.src, mediaBaseUrl)`，以兼容预览和导出两种地址。示例的自定义徽章同时使用本地 SVG。

### 媒体与后续配音

`media` 登记 `id/kind/src` 及可选尺寸、帧时长。准备器读取本地文件，按内容摘要复制到临时素材目录，不改原文件；显式 HTTP(S) 地址保留为外部依赖，外部内容改变不保证重现。自定义图层可消费图片和视频素材；`audio` 消费已准备的音频。

音轨提供绝对 `from`、`assetId`、裁入 `offsetFrames`、时长、音量和淡入淡出；`track` 为 `voice/music/sfx`。未知素材时长必须显式给定音轨时长，超出已知媒体或完整时间线会被拒绝。`speech` 是镜头局部的说话者与独立配音文本，`speaker` 支持 `god` 和 `player:<id>`；给定音频素材时可直接播放，未给定时只保存准备信息。本轮没有 TTS provider、自动生成或自动背景音乐压低。

`video:preview` 在启动时准备计划和素材；修改镜头参数、源文件或素材后重启以重新准备。预览结束会关闭子进程并清理自有临时目录。普通对局复盘的私有输出查看状态不参与视频时间线。
