# 第三方软件与素材声明

AWA 自有内容采用根目录的 [MIT License](LICENSE)，标准文本来源为 [Open Source Initiative](https://opensource.org/license/mit)。第三方软件、字体和音频保留各自的版权与许可；本页索引主要内容，完整软件依赖以 [bun.lock](bun.lock) 和各依赖包随附的许可证为准。

## Remotion

复盘播放器与视频工具使用 `remotion`、`@remotion/player` 及相关渲染包。当前锁定版本 `4.0.529` 采用 **Remotion License**，条款见[该版本的官方许可证](https://github.com/remotion-dev/remotion/blob/v4.0.529/LICENSE.md)。

该版本提供 Free License 与 Company License，适用范围取决于使用主体。个人、最多三名员工的营利组织、非营利组织等可按 Free License 的条件使用；其他主体按 Company License 的要求处理。部署播放器、打包分发或使用渲染工具时，均应保留对应包的许可声明并核对实际适用条款。后续升级时同步核对上游许可证。

## 本地字体

| 字体          | 版本  | 许可证                                                                              |
| ------------- | ----- | ----------------------------------------------------------------------------------- |
| Noto Sans SC  | 2.004 | [SIL Open Font License 1.1](packages/game-media/src/themes/fonts/OFL-NotoSans.txt)  |
| Noto Serif SC | 2.003 | [SIL Open Font License 1.1](packages/game-media/src/themes/fonts/OFL-NotoSerif.txt) |

字体来自 Noto CJK，原始版权信息、固定版本、转换方式与文件摘要保留在[字体说明](packages/game-media/src/themes/fonts/README.md)和[来源清单](packages/game-media/src/themes/fonts/manifest.json)中。分发这些字体时一并保留原许可证与版权声明。

## 视频配乐与音效

仓库中的 [asset/audio/ambient-sources.json](asset/audio/ambient-sources.json) 记录音源、作者、许可链接、处理参数和摘要。音频二进制保存在本地 `output/video-audio-library/`；当前清单中的许可如下：

| 素材                         | 作者／提供方  | 许可证与来源                                                                                                                                    |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Wisps of Whorls              | Kevin MacLeod | [作品来源](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200082) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| River Flute                  | Kevin MacLeod | [作品来源](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900005) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| 狼刀、枪声、查验、警徽等音效 | Mixkit        | [Sound Effects Free License](https://mixkit.co/license/modal/sfxFree/)；各素材条目见音源清单                                                    |

使用上述 CC BY 配乐的成片保留作者署名、来源、许可证链接及修改说明。制作工具生成的 `credits.txt` 应随配乐版发布；裁切、滤波和循环等处理记录在音源清单中。

Mixkit 音效按其许可融入最终作品；许可限制将音效单独、作为素材库／模板或连同源文件再分发。具体范围以[官方条款](https://mixkit.co/license/modal/sfxFree/)为准。

完整制作与署名流程见[视频制作指南](docs/guides/video-production.md)和[语音与配乐指南](docs/guides/offline-speech.md)。新增或替换素材时，同步维护来源、作者、许可、处理记录与实际随附文件。
