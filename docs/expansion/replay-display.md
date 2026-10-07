# 双语工作台与离线渲染（P3 I04）

## 输入与状态所有权

- `App` 持有展示选择；`ReplayDisplayOptions` 是显式 `{ locale: "zh-CN" | "en", timeZone: string }`。已加载文件的 `meta.locale` 只作为默认语言提示；没有该字段的旧档缺省中文。用户的语言选择优先，单独修改时区不产生语言选择，包括文件仍在加载时。
- 时区缺省 `UTC`，界面提供 UTC、Asia/Shanghai、America/New_York、Europe/London；离线 API/命令可使用其他有效 IANA 时区。缺失、空值、非字符串和无效时区均拒绝，不回退到宿主设置。
- 用户选择保存在当前工作台内，不改 replay、配置或磁盘。`useReplayPlayback` 唯一持有 Player ref、当前 frame 和播放状态；席位筛选只影响时间线，切换语言/时区保留筛选、位置和播放。
- `ReplayComposition` 只接收 `ReplayRenderInput` 和 Remotion frame；`buildReplayFrame` 是纯投影，`ReplayFrame` 是 Player 与离线渲染共同使用的画面。没有工作台 focus、计时器、当前系统时间或全局语言。

## 文字、日期与历史数据

UI 加载/错误、控件、席位、时间线、角色、阵营、阶段、技能和终局说明全部从共享 `game-text`/`game-catalog` 查询。品牌和 session/board/事件序号/时区 ID 保留机器值。第三方 Player 的固定英文控制栏关闭，由本地双语播放/暂停、逐帧滑杆、前后事件和全屏控件提供交互；视频仍无交互状态依赖。

名字、玩家/模型发言、遗言、夜聊结束理由和未知自定义事件 text 是原文。React 作为文本展示，HTML/占位形状不执行。未知角色/阵营/阶段/结束原因保持 ID，原型形状字符串也按未知值显示。旧 reason ID 的有限别名仅用于显示查询，不反写文件；共享术语取代原独立表后部分中文措辞变化。

时间统一显示 `YYYY-MM-DD HH:mm:ss [IANA zone]`，用显式 locale/timeZone 与 24 小时制产生年月日/时间部分，覆盖跨日和夏令时。缺少时区 offset 的历史日期及 Date 解析失败的字符串保持原值，不按宿主时区猜测；没有额外的严格历法校验，JavaScript 可容错解析的日期按解析结果展示。缺失值显示 `—`。

有 winner 则显示阵营；winner=null 时，已有 game_over/终局 phase 事实或明确终止原因（max_days_reached、runtime_timeout、runtime_error、completed）显示“无胜者/No winner”。没有终止事实的未知原因和 in_progress 保持“未结束/Unfinished”。此判断仅用于最终结果标签，不改变领域判胜。

`ReplayLoadState.status=error` 的 `message` 从 string 改为 `MessageRef`，界面每次按当前展示语言渲染。`ReplayLoadError.messageRef` 可供调用者使用；继承的 `Error.message` 缺省中文，保留旧调用的可读异常。JSON/结构/未来版本/HTTP/read 失败分别使用共享说明；不展示任意 fetch/file 原始异常。`parseOfflineReplayJson` 仍通过共享版本 reader 归一旧格式。

## 离线 PNG/MP4

```bash
bun run --cwd frontend replay:render -- \
  --input ../record/session_<id> \
  --output /tmp/game.en.mp4 \
  --locale en --time-zone UTC

bun run --cwd frontend replay:render -- \
  --input tests/fixtures/sample.replay.json \
  --output /tmp/game.zh.png \
  --locale zh-CN --time-zone Asia/Shanghai --frame 100 \
  --browser /usr/bin/chromium
```

`--input` 接受 canonical god replay.json 或其 session 目录。`--locale` 缺省跟随文件，旧档中文；`--time-zone` 缺省 UTC。传 `--frame` 输出 PNG（0 起算的有效安全整数），不传则完整 H.264 MP4。固定画幅 1280×720、30 fps、每个叙事节点 90 frame；空文件 1 frame。离线入口和工作台都过滤并发逐票/报名事件，保留统一结算节点，原始事件文件不变；派生节点保留原 seq，不能当 canonical replay 文件重新导出。

默认使用 Remotion 支持的浏览器发现方式，`--browser` 可指定已有可执行文件。实际 [渲染 API](https://www.remotion.dev/docs/renderer/render-still) 与 [浏览器所有权](https://www.remotion.dev/docs/renderer/open-browser) 由与 Player 同版的 `@remotion/bundler`/`@remotion/renderer` 4.0.529 提供；这两个构建工具为开发依赖，不能单独升级到与核心不一致的版本。

入口先校验文件/语言/时区/frame/扩展名，拒绝已有输出（含普通文件、hardlink、symlink 和 dangling symlink）及直接源路径；输出父目录可自动创建。bundle 与临时 artifact 在输出父目录下独有的隐藏临时目录。浏览器显式创建一次、传入 select/render 并在 finally 等待关闭；开始失败不调用后续选择，选择/渲染/清理失败保留原错，多个错误用 AggregateError 汇总。CLI 只输出稳定失败 ID。

产物完成后以同文件系统 `link()` 原子、独占发布；渲染期间出现的竞争文件/源链接导致 EEXIST 拒绝，竞争目标不删除、不覆盖。finally 只删除本次拥有的临时目录。渲染成功但后续资源关闭失败时仍可能存在完整已发布产物，命令明确失败；没有部分产物发布为成功文件。渲染期间的外部强制杀进程不保证临时目录回收，目录具有独有前缀；当前入口没有任务队列或持久任务恢复。

## 验收

- 手工双语事件与 unknown/raw/null oracle、共享 key/参数检查、两语言日期/DST/缺失时区、同 frame markup/投影、独立 render input copy。
- 源/已有输出保护、晚到竞争文件/源 symlink、open/select/render/close 故障注入，等待关闭与主错/清理错保留。
- 实际 Chromium：加载提示、语言/时区、席位筛选、逐帧跳转、播放中语言切换、原名原话、错误/空文件、无胜者终局。
- 实际中英 PNG 与英文 MP4，同输入/同 frame PNG 重复哈希；类型检查/构建与后端 release。

I04展示/渲染边界与P3剩余日志、整体双语运行门槛均已验证，英文runner/Tape replay已开放。未来角色矩阵、长局视频和全链路最终验证随 P4–P10，不能用基础 fixture 代表所有 64 项角色已实现。
