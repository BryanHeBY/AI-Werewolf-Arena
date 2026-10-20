# 正式视频作者稿

每个目录以简短英文主题命名，session ID 与来源指纹保留在 `production.ts`、JSONL 和画面稿中，用于锁定录像，不用于命名作者目录。

| 目录                                           | 视频                                                       | 模型        | 原始归档                       |
| ---------------------------------------------- | ---------------------------------------------------------- | ----------- | ------------------------------ |
| [trusted-wolf](trusted-wolf/production.ts)     | 真预言家首验查杀，为什么全场都信那只狼？                   | gpt-6.1-sol | `session_1792238100351_z77m4h` |
| [catgirl-knight](catgirl-knight/production.ts) | 12 个 GPT 猫娘玩狼人杀                                     | gpt-6.1-sol | `session_1792391429963_4bygw6` |
| [glm-comeback](glm-comeback/production.ts)     | 12 个 GLM 猫娘玩狼人杀：连出两狼占尽先机，骑士一剑风向骤变 | GLM-5.3     | `session_1792443889532_ltr2qg` |

## 文件所有权

| 文件                | 内容                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `production.ts`     | 标题、模型、原局来源、可选配乐稿；通用工厂推导本机输入和产物路径           |
| `speech.jsonl`      | 唯一口播全文、稳定台词 ID、来源、停顿和字幕覆盖                            |
| `overrides.ts`      | 可直接编辑的完整画面副本；正文与配音通过场景 ID 引用 JSONL                 |
| `casting.ts`        | 固定席位与音色；共享的主持人和默认参数由 `scripts/video/casting.ts` 装配   |
| `dialogue.ts`       | 将 JSONL 与选角装成合成项目，不合成语音                                    |
| `visual.project.ts` | 独立画面对照；不依赖已经准备的语音                                         |
| `project.ts`        | 按 JSONL 估时的无声预览，不生成估算字幕                                    |
| `voiced.ts`         | 从本机清单读取已备语音并按实际采样数编排，缺失或过期时报错                 |
| `soundtrack.ts`     | 本局昼夜配乐、固定音量和动作音效的场景／台词锚点，存在配乐的项目才有此文件 |
| `history.ts`        | 标题、文案、节奏及版本修订；历史交付地址保留，不追改旧成片                 |
| `audition.ts`       | 可选的固定节选试听，与正式整片清单分开                                     |

本目录不保存音频、视频、哈希命名的语音明细或自动冻结快照。它们位于忽略的 `output/videos/<theme>/`，其中缓存和编译版本仍使用内容摘要，避免不同版本相互覆盖。`output/tts-cache/` 继续共享独立合成块和整条配音。

原生完整展开稿属于对照产物：可通过 `video:script` 重新生成到 `output/videos/<theme>/snapshots/`。本机已经生成的 `native.generated.ts` 和初次 `skeleton.project.ts` 已移入这里。教学演示在 `apps/video/examples/`，通用制作实现在 `apps/video/scripts/video/`，浏览器时间线与渲染在 `packages/game-media/src/`。

原始录像、语音缓存和音乐不随 Git 分发。首次恢复项目时，需自行提供对应的本地归档和授权素材；语音只通过显式的准备命令生成。完整分阶段命令见[视频制作指南](../../../docs/guides/video-production.md)，服务商、缓存和字幕说明见[离线语音与字幕](../../../docs/guides/offline-speech.md)。
