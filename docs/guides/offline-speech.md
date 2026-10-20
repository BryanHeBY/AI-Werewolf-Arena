# 离线语音与字幕

视频制作分为脚本、语音准备、时间绑定和渲染。目录组织、统一分阶段命令及从临时制作脚本提取的工具见[视频制作指南](video-production.md)。只在显式运行 `prepare-voices.ts` 时调用云服务；预览、导出、时长估算和SRT导出只消费本地素材。

## 通用契约

| 所在文件                                  | 职责                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `frontend/src/speech.ts`                  | 台词、按人物选角、服务商声线联合类型、已备语音清单、绑定实际音频时长          |
| `frontend/src/speech-script.ts`           | JSONL语音稿、原始出处校验、语音驱动的局部与累计时间                           |
| `frontend/scripts/video/speech-script.ts` | 本地JSONL读取、独立选角加载与配音项目装配                                     |
| `frontend/scripts/video/authoring.ts`     | 本地录像读取、来源锁定及声明式语音项目装配                                    |
| `frontend/scripts/tts/provider.ts`        | `SpeechProvider` 合成端口与 `SpeechAligner` 对齐端口                          |
| `frontend/src/speech-timing.ts`           | `SpeechAlignment` 和相对于音频起点的 `{ text, startMs, endMs }`，以及字幕断句 |
| `frontend/scripts/tts/providers.ts`       | 按声线选择腾讯云或火山引擎，允许同片混用                                      |
| `frontend/src/video/subtitles.ts`         | 将局部毫秒平移为全局帧、按帧查询和SRT导出                                     |
| `frontend/src/video/VideoSubtitles.tsx`   | 独立底部字幕层，不随镜头缩放、不替换中央全文                                  |

合成输出为单声道16位PCM WAV，以及可选的字词时间。时间源区分 `provider/aligned/manual`。合成块的采样边界只用于拼接，不充当逐字时间戳；全部合成块都有时间信息时才发布整段对齐。拼接静音纳入字幕偏移，后续镜头调整由编译器同步平移声音和字幕。

音频缓存包含服务商、API版本、音色、采样率、原生语速参数、风格指令、文字、分块、take和间隔。字幕排版、显示文字与时间微调不改变音频缓存。旧缓存缺少时间戳时仍可复用，不为了获取字幕重新计费合成。需要后备对齐时可在准备函数中注入 `SpeechAligner`；端口已经支持补齐缓存音频，具体本地模型尚未接入。

默认缓存目录为仓库内的 `output/tts-cache/`。`chunks/<段摘要>/` 独立保存每段WAV和真实时间，段摘要仅含文本、规范化声线、API版本与take，不含整条发言或拼接间隔；整行装配仍使用内容寻址的 `audio.wav/record.json`。旧的整行缓存继续复用，旧分段会在本地校验后迁入独立缓存。中途失败后重新执行同一准备命令会复用已完成的分块，不依赖 `/tmp` 或进程内存。素材清单的相对路径也指向该目录；备份时同时保留 `frontend/videos/<对局>/`、`output/tts-cache/` 和该局 `output/` 产物。它们不随机器重启消失，但 `output/` 不纳入Git，不能只备份代码仓库。

豆包2.0按字符统计合成文本：汉字、英文字母、数字、标点、特殊符号、空格和换行都计入，与UTF-8字节数无关；`context_texts`语音指令不参与计费。[计费口径](https://docs.volcengine.com/docs/DoubaoVoice/Billinginstructions-21?lang=zh)、[语音指令参数](https://docs.volcengine.com/docs/DoubaoVoice/unidirectional-streaming-text-to-speech-http?lang=zh)

命令的 `characters` 是全部合成正文字符数，使用 `spokenText` 时按修正文本计算，不代表本次新增发送量；`missingCharacters` 是未缓存整行的字符估算，行内成功分块仍会复用。播放本地音频、`--dry-run` 和 `--check` 均不调用云端。本局六段试听正文的352字符包含287个汉字、5个字母、19个数字、37个标点和4个空格。

## 完整JSONL稿与语音驱动编排

本局的正式旁白与发言保存在 `frontend/videos/catgirl-knight/speech.jsonl`。第一行是版本、录像指纹与合成分块间隔，后续每行是一个完整场景，`lines` 按朗读顺序排列。97个场景包含101段台词，其中46段玩家发言、狼聊和遗言保持原文；上帝使用复盘播报，如“狼人选择击杀9号”，不增加选择口令与等待。片头只简短介绍开源框架、板型和关键例外，完整规则与模型、人设在画面呈现。

```jsonl
{"type":"script","version":1,"source":{"sessionId":"示例局","fingerprint":"示例指纹"},"chunkGapMs":0}
{"type":"scene","id":"fact:2","title":"狼刀确认","source":{"eventSeqs":[],"factSeqs":[2]},"lines":[{"id":"fact-2-0","kind":"narration","speaker":"god","text":"狼人选择击杀9号。","cue":"impact"}]}
```

`id/speaker/text` 直接进入既有TTS缓存和选角流程。`spokenText` 只修正读音，`take` 保留重录版本，`voice` 可覆盖单行声线，`subtitles` 可手改真实字幕边界。`synthesisChunks` 可固定局部重录边界，每段最多140个Unicode字符，拼接必须等于完整合成文字；不指定时沿用自动分句，局部改字可能影响相邻分段。正文为玩家台词时同步舞台全文；上帝旁白独立于规则、票型和技能画面。`source` 必须与原生镜头出处一致，漏场景、乱序或错局在准备阶段报错。

`speaker` 区分 `narrator`（作者旁白）、`god`（游戏上帝）和 `player:<id>`（玩家）。作者旁白与上帝都使用 `kind: "narration"`，分别在 `casting.narrator/casting.god` 配置音色；玩家使用 `kind: "dialogue"`。本局开头标题和规则两页由作者旁白介绍，身份页开始交给上帝主持。音轨、字幕和通读稿保留各自标识，更换一种角色的音色不会改动其他角色的选角。

作者不填写整片绝对起点。每行时长从WAV采样数计算，场景时长由统一的 `src/speech-clock.ts` 累加行时长和额外留白，下一场景从上一场景末尾开始。`cue: "impact"` 在该句起点揭晓动作或结算，`cue: "result"` 对应原生合段的正式结果；只有result标记时，整段结果在这句起点一起揭晓。底部字幕和事实揭晓随之平移，不保留旧页面时长下限。旧绑定器与估时器共用此时钟：兼容项目默认 `LEGACY_SPEECH_TIMING`（每行200ms、镜头尾400ms），JSONL缺省为连续播放，可在header.timing显式选择策略。实测和估时的区别仅在行时长来源，最终均对齐视频帧。

本局第二版在JSONL首行配置以下额外留白；它们叠加在语音自带的停顿之上，不改变TTS倍速。玩家直接换人36处，实际可听间隙中位数由约0.70秒增加至约1.30秒。

| 场合                   | 额外留白 |
| ---------------------- | -------- |
| 玩家结束后换人         | 600ms    |
| 其他角色切换           | 400ms    |
| 普通上帝场景切换       | 250ms    |
| 阶段转换               | 900ms    |
| 正式结果／结算之后     | 800ms    |
| 同场景连续播报         | 0ms      |
| 最后一段结束后保留终局 | 3000ms   |

跨场景的结算或阶段留白优先于普通换人；每行 `pauseAfterMs` 优先于策略，包括显式的0。片尾保留终局画面，字幕仍只延后400ms，不保留到视频结束。

镜头关键帧和图层支持独立的 `clock`：`anchor` 为 `start/impact/result/end/speech:<lineId>`，`from/frame` 为该锚点后的偏移；`position` 和 `duration` 分别为 `fixed/stretch`。默认保留固定帧长。比如 `clock: { anchor: "result", duration: "fixed" }` 的9帧闪光跟随结果句开始，但不会因长配音拉长；需要覆盖整段的图层显式使用 `duration: "stretch"`。

本局 `visual.project.ts/overrides.ts` 保留完整可编辑的画面对照，玩家全文和口播通过稳定场景ID引用JSONL，不重复维护；`project.ts` 用JSONL生成无声估时预览，`voiced.ts` 严格消费已备语音。无声预览不产生估算字幕，也不代表成片实测时长。为得到一条连续人声轨，可在语音准备后运行下面的离线编译；其补足视频帧的采样对齐和header.timing／行级pauseAfterMs声明的留白。各声线建议统一为24000Hz，合并时遇到采样率不一致会拒绝，不隐式变速。

```bash
# 直接从JSONL检查整稿，不需要凭据，不联网
bun --no-env-file frontend/scripts/prepare-voices.ts --script frontend/videos/catgirl-knight/speech.jsonl --casting frontend/videos/catgirl-knight/casting.ts --dry-run
# 阅读对照：仅生成本地HTML
bun --no-env-file frontend/scripts/generate-speech-script.ts --script frontend/videos/catgirl-knight/speech.jsonl --report output/session_1792391429963_4bygw6/speech-review.html
# 确定台词与选角后显式运行；本步骤会向配置的服务商发送台词并生成音频
bun --env-file=.env.tts.local frontend/scripts/prepare-voices.ts --script frontend/videos/catgirl-knight/speech.jsonl --casting frontend/videos/catgirl-knight/casting.ts --manifest output/videos/catgirl-knight/dialogue/speech.generated.ts
# 已备素材→连续WAV、真实时间报告、字幕状态和可直接渲染的项目；不联网
bun --no-env-file frontend/scripts/compile-speech-video.ts --project frontend/videos/catgirl-knight/visual.project.ts --script frontend/videos/catgirl-knight/speech.jsonl --casting frontend/videos/catgirl-knight/casting.ts --manifest output/videos/catgirl-knight/dialogue/speech.generated.ts --output output/session_1792391429963_4bygw6/voiced
```

最后一条命令返回实际项目路径，`build-<摘要>/` 内包含连续音频、项目、`speech-timeline.json`、`subtitle-status.json` 和SRT。全部候选生成并通过最终计划校验后才原子发布目录，失败清理候选；同一内容重复编译会校验并复用既有版本，不覆盖不一致的产物。`publication.json` 标记编译产物组已完成，整片渲染另由production-status记录。音频使用内容寻址WAV；项目及SRT也带版本号，改字幕不覆盖旧版音频。全部台词具备真实对齐时才发布完整SRT；缺少对齐时列出缺失行，不发布部分字幕冒充整片字幕。需要强制字幕齐全可加 `--require-subtitles`。之后把返回的项目路径交给现有 `render-video.ts/preview-video.ts` 即可。

新局可用 `generate-speech-script.ts --project <项目.ts> --output <speech.jsonl>` 初次导出完整原稿，已存在的JSONL不会覆盖；后续直接编辑台词并刷新HTML对照。

## 豆包语音2.0接入

本项目采用豆包语音合成2.0预置音色，资源ID为 `seed-tts-2.0`，通过HTTP SSE单向流式接口一次提交一个合成块，在收到完整音频、字幕和结束事件后才提交缓存。官方提示流式WAV可能反复带文件头，因此请求PCM，再在本地封装WAV。[接口与协议说明](https://docs.volcengine.com/docs/DoubaoVoice/HTTPChunkedSSEUnidirectionalStreaming-V3?lang=zh)

在豆包语音新版控制台的「开通管理」开通语音合成2.0，再到「API Key管理」创建密钥。服务与密钥需要处于同一项目。凭据放入仓库根目录已忽略的 `.env.tts.local`：[控制台指引](https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh)、[新版控制台快速开始](https://docs.volcengine.com/docs/DoubaoVoice/QuickStartNewConsole?lang=zh)。

```dotenv
VOLCENGINE_TTS_API_KEY=在这里填写豆包语音控制台的API_Key
```

这里使用豆包语音控制台的API Key，不使用通用云账号AK/SK。适配器也兼容旧版语音控制台的 `VOLCENGINE_TTS_APP_ID` 与 `VOLCENGINE_TTS_ACCESS_TOKEN`；新版API Key优先，旧版App ID对应请求头 `X-Api-App-Id`，Access Token对应 `X-Api-Access-Key`。[旧版鉴权说明](https://docs.volcengine.com/docs/DoubaoVoice/old-version-console-authentication-reference-example?lang=zh)

声线在 `casting.ts` 或试听稿中配置，凭据不放进去：

```ts
const voice: VolcengineVoiceProfile = {
  provider: "volcengine",
  resourceId: "seed-tts-2.0",
  voiceId: "zh_male_m191_uranus_bigtts",
  name: "云舟 2.0",
  sampleRate: 24000,
  speechRate: 20,
  contextTexts: ["用平静、自然的语气说话。"],
};
```

`speechRate` 对应接口 `speech_rate`，范围 `[-50,100]`，`0/20/50/100` 分别为正常、1.2、1.5、2倍语速；与腾讯云 `Speed=1/2` 的刻度不同。`contextTexts` 对应附加参数的语音指令，改变指令会产生新的缓存身份。适配器使用 `enable_subtitle: true` 获取字级字幕，目前官方支持中文、英文；返回的秒时间统一转换为毫秒，同一请求后续句子的时间已经相对于整段请求，不再次累加句起点。[音频和字幕参数](https://docs.volcengine.com/docs/DoubaoVoice/unidirectional-streaming-text-to-speech-http?lang=zh)

已经准备三种预置音色的通用短句试听稿，不包含这局玩家原话：[试听配置](../../frontend/examples/speech/doubao-audition/dialogue.ts)。音色ID来自[官方音色列表](https://docs.volcengine.com/docs/DoubaoVoice/Tonelist-1?lang=zh)，实际授权以控制台为准。

本局[正式选角](../../frontend/videos/catgirl-knight/casting.ts)已全部切换豆包2.0：作者旁白为解说小明，上帝为魅力女友，12位猫娘玩家使用12种不同女声，以青春、清新、甜美与元气为主，预言家为小何、骑士为Vivi。所有角色统一 `speechRate: 20`（1.2倍）。本局[六段试听稿](../../frontend/videos/catgirl-knight/audition.ts)保存开场、首夜及四位玩家的固定原话节选，独立于正式整片素材清单；新版6段WAV与真实字幕共63.190秒，试听页位于 `output/session_1792391429963_4bygw6/doubao-audition-v2/index.html`，v1产物保留。

```bash
# 本局6段试听的离线缓存检查，不调用云端
bun --no-env-file frontend/scripts/prepare-voices.ts --project frontend/videos/catgirl-knight/audition.ts --check
# 修改试听稿或选角后，显式准备这6段；素材清单单独保存
bun --env-file=.env.tts.local frontend/scripts/prepare-voices.ts --project frontend/videos/catgirl-knight/audition.ts --manifest output/session_1792391429963_4bygw6/doubao-audition-v2/speech.generated.ts
```

```bash
# 以下均在仓库根目录运行；先检查选角和字数，不需要凭据
bun --no-env-file frontend/scripts/prepare-voices.ts --project frontend/examples/speech/doubao-audition/dialogue.ts --dry-run
# 填好凭据并决定生成后，显式合成；可先只试听云舟
bun --env-file=.env.tts.local frontend/scripts/prepare-voices.ts --project frontend/examples/speech/doubao-audition/dialogue.ts --only yunzhou
# 完整试听生成后，可离线检查所有缓存
bun --no-env-file frontend/scripts/prepare-voices.ts --project frontend/examples/speech/doubao-audition/dialogue.ts --check
```

联网错误或业务错误不自动重试，截断的流不视为成功；已成功提交的合成块可在下次显式执行时复用。测试使用模拟HTTP响应，真实音质、音色授权和字幕覆盖仍需首次云端试听确认。

## 手动微调字幕

项目的 `subtitles: { maxCharacters: 24, maxGapMs: 450, requireTiming: true }` 控制默认分段和有声绑定检查。自动分段只选择已有时间边界，不按字数线性分摊时间；单个时间片过长时保留真实边界。可覆盖某段台词的显示文字、断句和起止时间：

```ts
line.subtitles = [
  { text: "五号的发言存在一个问题。", startMs: 180, endMs: 2400 },
  { text: "我需要他解释一下。", startMs: 2550, endMs: 3900 },
];
```

时间相对于这一行准备好的完整配音，包含长台词分块之间的静音。字幕不得重叠、倒序或超出实际音频。服务商将数字、标点单独标成不足一帧时，绑定阶段会在字数和停顿限制内与邻句合并，保留全部文字与真实边界；无法合并或手动覆盖中仍不足一帧的段落会报错。设置 `line.subtitles = false` 可只关闭该段字幕，`project.subtitles = false` 关闭全部。`requireTiming` 在 `preparedSpeech/bindVideoSpeech` 绑定有声计划时检查；`--check` 仅验证素材缓存，命令报告的 `timed` 为已有对齐的行数。

可在画面脚本中配置 `subtitles: { lingerMs: 400 }`，让每条字幕在真实朗读结束后最多延长0.4秒。下一条字幕开始或视频结束时立即截止，较长静默仍会清空字幕。此设置只调整底部字幕和SRT的显示尾部，不修改服务商时间、不拉长音频或镜头，也不会重新调用TTS。本局首版采用400毫秒，整片时长以实际配音为准，不设75分钟硬上限。

字幕跟随实际朗读文字；读音修正导致屏幕写法不同，可在字幕覆盖中恢复展示写法。规则全文保留在中央，底部仅呈现当时说出的简短讲解。修改语速或台词会让旧音频清单失效，需重新准备对应行，手动字幕也要按新音频重新核对。

```bash
# 从已经绑定声音的正式项目导出字幕；与Remotion底部显示使用相同帧时间
bun run --cwd frontend video:subtitles -- --project videos/catgirl-knight/voiced.ts --output ../output/session_1792391429963_4bygw6/subtitles.srt
```

本局正式配音与真实字幕已全部准备，101段台词编排为97个场景、1849条字幕，实际时间线为3955.933秒，约65分56秒。连续WAV、SRT、时间报告及首版成片保存在 `output/session_1792391429963_4bygw6/production-v1/`；该目录的README记录检查页启动与断点恢复命令。原生和制作稿预览继续保持独立，不使用估算字幕。

## 作者稿与准备阶段

JSONL拥有口播文本、读音、逐行停顿和字幕覆盖；完整TS稿拥有镜头、图层、画面说明及强调。`native.generated.ts` 是冻结的原生对照，放在本机 `output/videos/<theme>/snapshots/`，不覆盖日常编辑。正文的 `bodySource: "event" | "script"` 表示来源，`bodyLayout: "structured" | "text"` 表示展示方式，二者分别设置，不再通过文字是否相等猜测版式。编辑完整副本时，如需自由正文，同时指定 `bodySource: "script", bodyLayout: "text"`；结构化展示仍只使用记录中的事实。`lifeFacts` 仅允许用于支持合并的event edit，intro、hold、factEdit和shotEdit传入时直接报错。

`loadVideoProject` 加载定义与记录，`compileLoadedVideo` 编译并校验计划，`prepareVideoAssets` 才读取并摘要素材字节。`createSpeechVideoProject` 仅声明语音编排，不在模块导入时读取录像或编译计划。配音后仍重新编译最终计划，以校验新的事实揭晓时间；不复用过期的状态节点。估时、结构检查、导出字幕和流程稿使用plan阶段，预览和渲染再准备完整素材。

本机 `output/videos/<theme>/dialogue/speech.generated.ts` 仅保留类型化索引、JSON引用及来源摘要，详细对齐存入内容寻址的JSON附属文件。合成与绑定都使用 `src/speech-identity.ts` 的规范化身份，显示名及省略的默认参数不会令音频过期；改变文本、合成边界、有效声线参数或take仍需重新准备对应素材。字幕和开场样式归主题的 `subtitle/opening` tokens，正文、字幕与页脚区域归统一layout。

## 完整长片渲染

通用 `render-production-video.ts` 支持按一分钟画面分段恢复，核对分段帧数后统一编码连续人声，避免逐段AAC拼接间隙。渲染目录保留计划签名、运行时代码摘要、冻结bundle和进度。输出MP4校验后独占发布，已有成片不覆盖。

```bash
mkdir -p output/render-tmp
TMPDIR="$PWD/output/render-tmp" bun --no-env-file frontend/scripts/render-production-video.ts --project output/<session>/production/build-<摘要>/voiced-<摘要>.project.ts --output output/<session>/production/movie.mp4 --workers 6
```

本局第二版实际为4016.8秒（66分56.8秒），120504帧，97场景、101段台词和1849条字幕；复用全部原始配音，新增60.867秒留白，片尾额外保留3秒。产物位于 `output/session_1792391429963_4bygw6/production-v2/`，首版保留在production-v1。

## 背景音乐与音效

`videos/<theme>/soundtrack.ts` 拥有本局的配乐选择、音量和声音节点，通用离线混音在 `scripts/video/soundtrack.ts`。音乐切换引用场景ID，投票结果等音效也可引用该场景内的口播行ID；从实际 `speech-timeline.json` 解析采样位置，不手写全局秒数。修改台词后需重新编译语音时间线和混音，未改变场景时长时可直接复用已渲染画面。

音乐用固定RMS音量，音效用峰值音量，二者均在作者稿显式设置。当前不使用人声侧链压低；只在音乐循环、昼夜边界和片尾淡化。混音逐块叠加，避免给每个延迟音效分配整片静音缓存。输出音乐、音效和混音母带、许可清单、音量与节点报告，校验后成组发布。音源必须是本地文件且摘要匹配；许可和素材页随素材登记，正式二进制音源保存在持久的output目录。

`musicTransition` 默认采用交叉淡化；设为 `{ mode: "sequential", gapMs: 600 }` 时，前一首在场景边界之前淡出，下一首在边界之后淡入，中间留600毫秒，避免不同旋律同时出现。此间隔只作用于音乐，不改变口播、音效、字幕或镜头时间。

```bash
bun --no-env-file frontend/scripts/mix-video-soundtrack.ts --timeline output/<session>/production/build-<摘要>/speech-timeline.json --soundtrack frontend/videos/<theme>/soundtrack.ts --output output/<session>/production/audio-versions
bun --no-env-file frontend/scripts/mux-video-soundtrack.ts --video output/<session>/production/movie.mp4 --mix output/<session>/production/audio-versions/soundtrack-<摘要>/mix-report.json --output output/<session>/production/music-versions
```

封装命令复制原画面码流，仅编码新的AAC音轨；检查帧数、时长、画面码流摘要和多处音频对齐后发布独立版本，保留纯配音版。`mix-report.json` 和 `export.json` 分别记录音频来源、时间、素材许可及画面复用证据。当前配乐采用Kevin MacLeod的CC BY 4.0素材，音效采用Mixkit免费音效许可。音源二进制不提交，来源、处理参数和摘要保存在 `asset/audio/ambient-sources.json`；配乐版附带署名文件。
