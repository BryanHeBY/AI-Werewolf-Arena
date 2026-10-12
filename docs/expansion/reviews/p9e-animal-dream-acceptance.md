# P9e 动物梦境原生十二人验收

本批白猫、子狐、河豚完成完整技术验收，限定[联合规则卡](../rules/awa-animal-dream-twelve-v1.md)的原生十二人范围，登记 implemented。当前 **55/64：23 verified、32 implemented、9 planned**。原长期目标保持暂停，按用户限定的三角色收口任务结束，等待后续重构指令。

## 功能范围

见[交付契约](../animal-dream.md)：唯一原体与三库存 owner、最早截止请求授权、子狐禁整队刀/美人清约、白猫真实活人延期和两个跳票政策、河豚完整原选民反击和两个票轮政策、独立刀死被动、熊天亮活邻、完整遗言/徽章/魅惑链及 wolf priority。旧熊默认保持。

四公开 board/game 示例可严格加载与 roundtrip；新增 CLI 安全错误码、三角色 Observation/动态提示、13 个共享严格事实与中英展示。

## 人工预期与实际通路

- 六独立字面族：Fox/Beauty 封锁及跨夜重选、Cat 警长跳票两政策、Puffer 首夜刀死被动及熊实际邻位、PK 首/末轮、末狼/末神追加链、完整反击含自票与 Cat 延期。
- 四政策×六族×SDK/ACP/mixed×两语＝144 个完整本地通路局；72 tests、63702 assertions，原日志 `/tmp/awa-animal-independent-wire-matrix-first.log`。独立 turns 由手写日次生命/阶段/词徽表生成，没有生产 PM 预演回填。
- 四政策×两语×20 固定 seeds＝160 个受限观察自然完整局，全部零拒绝/回退、逐局 exact Tape；8 tests、184 assertions，`/tmp/awa-animal-observed-full-second.log`。种子不挑选、不重算调试重复数。
- 两必答技能×missing/invalid/late×SDK/ACP×两语＝24 失败局，12/0/4670；拒绝后合法更正8完整局，4/0/2618；真实保留MCP四任务旧ID/1秒截止/2200ms到达/关闭拒绝及物理退出，4/0/60。普通10秒、故障1秒与迟到2200ms没有放宽。
- 四政策×六字面族的直接真实 Record→独立账本→exact Tape，24/0/72。成功和模型必答失败能精确复现。付款后通知故障与 Cat 公告故障保原 canonical/生命/已发布知情，四实际记录 parser、finalize、落盘通过；未列入 faultPlan 的注入不冒称 exact 可重放。

## 独立审查与原发现

R、A、T 分别负责规则/原生命/失败、配置与独立账本、实际信息/双语/传输/展示；均只读，生产补丁由 root 完成。

- Runtime 五个 P2：正常取消未收 owner、旧熊绕过有限 Dawn、原体失效后继续请求、未追加事件推进知情、初始化新旧熊说明矛盾，均原样复验关闭。A 11/0/74；R 原7/0/33及取消1/0/3；T 封存/受众13/0/974。
- 标签八族多余参数及反击在Night翻牌，两原例关闭；最终33/0/240，真实来源Night/公告Day及动态prompt补查8/0/606。原错误测试中英文正向字面和玩家timeline写盘次序的误用如实保留，不当成生产问题。
- 独立 ledger 原13篡改反例与合法软重试23/0/84；另原狼队原受众/终局snapshot/徽与票权三反例4/0/19关闭。原行动与接受票/op输出、PK候选/完整选民、原Beauty通知共篡改、库存/事件/决定共删、游标、未开夜请求等均有维护回归。
- 未发布 Fox 越界999、failed CP Cat 伪死/复活原例关闭；合法付款/Cat失败前缀6/0/70。失败绝不从 pending/error 推付款，不补选择事实或玩家知情。

原各轮红日志、改正后日志与报告保留在 `/tmp/awa-animal-*`；关键反例已维护接纳到 `backend/tests/recording/animal_dream_*`、runtime、engine、真实MCP与frontend测试。

## 前端与视觉候选证据

48 实际 God replay、192 最小授权 player 档保存在 frontend fixtures。269 unit、24520 assertions 全绿，覆盖四政策两语、原死亡公告边界、God事实零Alive effect、活人公开身份、正/逆seek、私有遮蔽。20实际Chromium工作台/最小movie测试通过；这些证据不宣称工作台直接加载player JSON。

实际最小村民视角的中英 1280×720 PNG 与 180 帧／6 秒 MP4 已由生产 renderReplay、实际 Remotion/Chromium 输出并目视核对：白猫翻牌仍活、仍持警徽，除本人及已公开白猫外保持 unknown；字幕没有遮挡下排座位。视频使用真实 frameRange 截取公开边界，未模拟渲染器。

- `/tmp/awa-animal-zh-CN-cat-publication.png`：`d7bd133ee3e712370f3fe8492a6d3a2268a64c5661a62ef612fc187b2854f16d`
- `/tmp/awa-animal-en-cat-publication.png`：`050c56026a60b29df2ee02b0ee8474392eb3e3f811bd5b29346e6577e3a9c4a8`
- `/tmp/awa-animal-en-cat-boundary.mp4`：`0655cd8378b5a7f04a0e6596403a9dc09246c537fb7297cf94733f2526c8836b`

## 最终冻结输入与全支持门禁

`main@8a8d4bedc33c21e4b5beddfb06253b07b36fadd0` 加本轮完整候选，2618 项公开源码／测试／240实际档／配置／文档输入，before、after、on-exit 与 A 独立 current 清单逐字节一致：

`c3fe60689f9d2c28c8afb673e65e1bf13399d794e35e8a0c6d1263f477c5b0fa`

目录 `/tmp/awa-p9e-animal-complete-full-first`；驱动 `/tmp/run-awa-p9e-animal-complete-full-first.py`。Bun1.4.2、Chromium153.0.8010.52，driver SHA `5504ed813e9f4134973da03d3809be8109b5d116e12b0246b2243bf6c94f767e`，collector SHA `6d8861ed3400883f675d1f7052a5f0b79b459d198beb8f5bcce7c263cc6ec88d`。沿用既有耗时输入只均衡分片，不决定测试覆盖。

| 门禁                                 | 实际结果                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| 根 check／lint／format／diff         | 全部退出0                                                   |
| 六后端分片84／84／83／86／84／84文件 | 1029／1193／1232／1270／1049／1078通过，零失败              |
| 九敏感文件串行                       | 55通过，零失败                                              |
| 后端合计                             | **6906通过、0失败、1条件导出skip**；514唯一文件、966421断言 |
| 前端全量 unit                        | **1205通过、0失败**；79文件、82030断言                      |
| mock smoke、双端 build               | 全部退出0                                                   |
| Chromium                             | **362通过、0失败**；23spec、1worker、零重试，417.54秒       |

16 门禁各执行一次，全量第一轮完整通过，没有用定向结果补齐失败轮。唯一 skip 为旧 Mist fixture 环境导出开关，不算执行通过；本批 240 实际档有独立实际生成与播放证据。A 最终 `/tmp/awa-animal-first-final-independent-audit.json` 审计原 headers/footer、514文件恰一次、Chrome原序号1–362、输入清单与工具链 hash，结论无阻断。

分片 CLI 传 `--timeout 30000`，真实 preload 的 `jest.setTimeout(10000)` 探针仍表明不能宣称所有跨文件 hook 获得30秒。原普通行动10秒／精确故障1秒／迟到2200ms及显式模拟180秒均未更改；本批不宣告 P10 性能验收完成。

此验收正文、progress、roles、规则卡完成登记及暂停契约是门禁后的文档字节，另验格式／差异／链接，不冒称属于以上冻结指纹。

## 收口边界

本轮没有调用计费模型、读写用户 configs/认证或推送。三个角色已在四预设及所述有限范围完整交付，不承诺任意混搭或其它平台未冻结细则。其余禁言长老／乌鸦／典狱长、P9f六项、P10机制矩阵／编辑器／长局资源／真实ACP环境隔离／T6及用户最终验收保持暂停。

## 原调试失败轮

前期原日志全部保留：首次golden误读winningFaction、缺新audience白名单、未发布付款/failed生命前缀、原票/PK/原知情共同篡改、CP owner effect被phase标签提前清空等均经具体反例修正。首次ACP矩阵因测试脚本依赖 process.cwd()/tests/fixtures 从repo根运行而丢脚本，改为 import.meta.dir 的实际路径；无生产接入策略变更。没有把定向复验混算成某次全量门禁。

## 功能提交

- `614aa98`：原生三角色及必要联合机制、共享协议/双语、原体与请求授权、独立严格记录/失败前缀、四配置和后端/实际通路回归。
- `33be242`：前端共享事实接入、严格解码与逐帧投影、48God/192player实际档、正逆播放及真实浏览器回归。
- 验收登记、暂停边界与重构交接说明另笔文档提交。没有迁移用户私有配置或推送。
