# 视频制作与目录组织

制作沿用“记录事实 → 场景编排 → 视频计划 → 按帧渲染”的边界。作者文件、通用实现和生成产物分别保存，渲染不调用 TTS。`frontend/videos/` 下只放主题作者目录，session ID 用于定位归档和核对指纹。

## 目录与职责

| 位置                          | 拥有的内容                                                             |
| ----------------------------- | ---------------------------------------------------------------------- |
| `frontend/videos/<theme>/`    | 本局台词、画面、选角、配乐锚点、制作配置及修订记录                     |
| `frontend/examples/`          | 教学回放示例和通用短句试听                                             |
| `frontend/src/speech*.ts`     | 纯语音契约、规范化身份、统一时钟、对齐与字幕，不读文件或凭据           |
| `frontend/src/video/`         | 事实编译、镜头、布局与按帧画面                                         |
| `frontend/scripts/tts/`       | 服务商适配、分段合成缓存、整行装配与连续音轨                           |
| `frontend/scripts/video/`     | 文件读取、作者装配、选角预设、制作路径、版本发布、混音与审片基础设施   |
| `frontend/scripts/*video*.ts` | 显式 CLI 和制作阶段编排，复用上述基础设施                              |
| `asset/`                      | README 图片，以及不含音源二进制的来源／许可清单                        |
| `output/tts-cache/`           | 持久的音频与对齐缓存，忽略于 Git                                       |
| `output/videos/<theme>/`      | 本局生成清单、冻结快照、连续音轨、字幕、成片、报告和审片页，忽略于 Git |

`scripts/video/production.ts` 统一路径，`casting.ts` 装配固定豆包选角，`speech-script.ts` 读取 JSONL 和相对本机清单，`authoring.ts` 声明延迟语音项目，`publication.ts` 发布完整候选版本，`soundtrack.ts` 编排本地授权音源，`review.ts/review-http.ts` 生成审片页并提供 Range 读取。

作者入口使用短主题名；`build-<摘要>`、合成块、WAV 和配乐版本的摘要仅存在生成目录中，仍用于校验、复用和防止误覆盖。`speech.generated.ts` 默认位于 `output/videos/<作者目录>/<合成入口名>/`；正式 `dialogue.ts` 对应 `dialogue/speech.generated.ts`，试听入口对应独立的 `audition/`。

## 从作者稿到成片

以下命令均从仓库根运行，需要 Bun、FFmpeg/FFprobe；渲染另需 Chromium。三局的标题、模型与来源对应关系见[作者稿目录](../../frontend/videos/README.md)。本地 `record/` 不随 Git 分发，示例项目则使用签入的教学夹具。

```bash
# 无声画面对照和按JSONL估时的制作预览
bun --no-env-file frontend/scripts/preview-video.ts --project frontend/videos/trusted-wolf/visual.project.ts
bun --no-env-file frontend/scripts/preview-video.ts --project frontend/videos/trusted-wolf/project.ts

# 检查字数与缓存；两条命令都不联网
bun --no-env-file frontend/scripts/prepare-voices.ts --project frontend/videos/trusted-wolf/dialogue.ts --dry-run
bun --no-env-file frontend/scripts/prepare-voices.ts --project frontend/videos/trusted-wolf/dialogue.ts --check

# 确定台词和选角后显式生成：这一步会发送台词并使用服务商配额
bun --env-file=.env.tts.local frontend/scripts/prepare-voices.ts --project frontend/videos/trusted-wolf/dialogue.ts

# 离线编译连续WAV、真实时间、完整字幕和冻结项目；缺字幕直接失败
bun --no-env-file frontend/scripts/produce-video.ts --production frontend/videos/trusted-wolf/production.ts --stage compile

# 按一分钟分段恢复；在持久磁盘保存临时文件，避免/tmp容量不足
mkdir -p output/render-tmp
TMPDIR="$PWD/output/render-tmp" bun --no-env-file frontend/scripts/produce-video.ts --production frontend/videos/trusted-wolf/production.ts --stage render --workers 6 --browser /usr/bin/chromium
```

`compile` 在 `output/videos/trusted-wolf/production/` 发布 `build-<摘要>/`，并更新 `compiled-build.json` 索引；原声成片为 `movie.mp4`。已有成片不覆盖，恢复渲染必须使用同一冻结计划、bundle、运行时代码摘要和素材。改变编排或渲染实现后，用 `--output output/videos/trusted-wolf/production-v2` 选择新输出目录，并在后续阶段传入同一参数，不复用旧分段。

`--stage all` 依次编译、渲染、按配置混音及封装，最后生成审片页；不准备语音。单独执行各阶段方便局部修改和验收。命令也可通过 `bun run --cwd frontend video:produce -- ...` 使用，路径相对于该命令工作目录。

字幕位置由 `frontend/src/themes/tokens.ts` 的 `subtitle.bottom` 统一控制。当前在1080p画面底部留144像素，给播放器章节标识和控制条保留空间，其他分辨率按画幅缩放。中央正文同步避开字幕安全区，带四行以上配置说明的开场页会压紧字号和标题间距，左右玩家栏位置保持不变；字幕延后400毫秒的时间规则独立于布局。调整位置后需要重渲画面，并使用新输出目录，不能只替换SRT或复用旧分段。

## 音源、配乐与音效

[`asset/audio/ambient-sources.json`](../../asset/audio/ambient-sources.json) 保存当前选定的音源下载地址、来源、许可、原件及处理后摘要、裁切与滤波参数。音频二进制继续保存在本机 `output/video-audio-library/`。

```bash
# 只检查本机音源，不下载
bun --no-env-file frontend/scripts/prepare-video-audio.ts --sources asset/audio/ambient-sources.json --output output/video-audio-library --check
# 显式补齐缺失音源并发布本机manifest；已有正确素材直接复用
bun --no-env-file frontend/scripts/prepare-video-audio.ts --sources asset/audio/ambient-sources.json --output output/video-audio-library

bun --no-env-file frontend/scripts/produce-video.ts --production frontend/videos/trusted-wolf/production.ts --stage mix
bun --no-env-file frontend/scripts/produce-video.ts --production frontend/videos/trusted-wolf/production.ts --stage mux
```

`soundtrack.ts` 拥有本局音量和时间锚点，音效跟随场景或具体口播行。当前预设白天 −48 dB RMS、夜间 −57 dB RMS，发言时不额外压低音乐。昼夜音乐先淡出再淡入，中间600毫秒不重叠；片尾淡出并保留短静音。狼刀指最终确认，逐人投刀页面仍省略；骑士出剑与结果分别引用对应语音节点。

混音输出独立的音乐、音效与母带，`mixed-build.json` 指向已校验版本。`mux` 复制画面码流，只编码新音轨，并核对帧数、时长、画面摘要和多个音频位置后发布 `delivery.json`。只有音量或音效变化时无需重渲画面。

素材摘要不符会停止，不能静默接受网站换文件；下载失败不会发布新的清单。不同 FFmpeg 版本若导致处理后字节摘要变化，也需人工核验后更新来源清单。Kevin MacLeod 两首配乐使用 CC BY 4.0；Mixkit 音效使用其免费音效许可。`credits.txt` 随配乐版输出，发布视频时一并保留必要署名和修改说明。

## 审片与验收

```bash
bun --no-env-file frontend/scripts/produce-video.ts --production frontend/videos/trusted-wolf/production.ts --stage review
bun --no-env-file frontend/scripts/serve-video-review.ts --review output/videos/trusted-wolf/production/review/review.json --port 5186
bun --no-env-file frontend/scripts/verify-video-artifact.ts --review output/videos/trusted-wolf/production/review/review.json --output output/videos/trusted-wolf/production/artifact-check.json
```

审片页包含实际章节、带时间全文、视频与字幕下载，以及存在时的音乐署名。服务只开放该索引明确列出的产物，支持 GET/HEAD 和 Range，不开放目录。验收命令核对 H.264/AAC、尺寸、帧率、总帧数、多个位置的音频对齐和片尾静音；不能替代对声音风格与剧情的人工观看。

已有冻结项目可通过 `--build <build.json> --video <已有MP4>` 直接生成审片页，无需重新渲染；配乐版另传 `--audio <混音母带WAV>`，用于准确验收音频。已有交付保留在 `output/session_<id>/production-v*/`，本次重组不迁移或覆盖成片；历史审片地址仍由原本的本机服务提供。

## 从临时脚本到正式工具

从 `output/two-session-production/` 提取并参数化了制作阶段编排、审片页、Range 服务、音源准备与成片验收。它们不再写死 session、端口或开发者绝对路径。`output` 中挑选剧情、一次性画面核对、历史音乐试听和发布特定旧版本的脚本保留作本机历史，不作为维护入口；后续通用能力应修改签入的 `frontend/scripts/`。

新增一局时复制作者目录结构并修改来源、标题、模型、台词、选角和画面；不得复制运行算法或将通用脚本放回 `output`。先生成原生完整稿作对照，再修改独立的完整覆盖稿；语音正文始终由 JSONL 拥有。注释只解释职责、输入输出、时序边界或必要取舍，保持仓库现有风格。
