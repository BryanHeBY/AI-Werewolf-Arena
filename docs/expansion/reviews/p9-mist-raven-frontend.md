# P9d：迷雾鸦影实际前端档案与播放

前置 `676b1bb`。本批交付前端功能证据，正式角色仍planned、44/64；登记与同源支持范围门禁随后执行，不提前称P9d/P10完成。

## 实际档案来源

26个真实完成局各导出God replay、最终checkpoint及四个真实player view，共 **26 replay / 26 checkpoint / 104 player view**：

- 四份normal：linked、saved-dreamer、protected-heal、draw，各en/zh-CN，经真实SDK兼容本机端点、runner、落盘读取和严格Tape。
- 九份manual：四自爆窗口、原刀口自爆、双移徽、末狼、并行败选原刀口及第二间隙，各en/zh-CN，经真实PM、SessionRecorder.finalize、公共解析和严格Tape。

normal取runTransportGame读回的实际文件对象；manual在完整验证后、删除临时目录之前copy原session的replay/player文件，不手工伪造录制。manual传artifactDirectory同时绕过cache读写，普通缓存不被导出污染。生成命令在backend使用 `AWA_MIST_RAVEN_FIXTURES=<repo>/frontend/tests/fixtures bun test --preload ./tests/setup.ts ./tests/runtime/mist_raven_transport.test.ts ./tests/runtime/mist_raven_frontend_fixtures.test.ts --test-name-pattern 'llm|front fixtures'`。

生成门禁 **5 pass / 6554 assertions / 0 fail**，13.47秒，`/tmp/awa-mist-front-fixture-generation.log`；包含8个normal及18个manual完整局。

## 视角与时序边界

玩家最小render输入取实际readReplayPlayerView.timeline的event行；不从God事件按actor过滤模拟授权。God只借公共座位/名字/meta，其他人的role/camp改unknown，顶层终局result整体改为null。私密事件仍按真实owner和解封时间授权；普通狼/村民是非owner canary。工作台本身仍只导入God回放，席位关联筛选不是权限，最小私有画面验证不是新增玩家档导入功能。

- 104份owner组合核雾/蛇、鸦刀/解封的归属，封印前无狼聊/投刀/抽刀，解封快照只含当时已知活队友，不能补旧夜聊天。每个实际私密/夜公告节点定位presentation frame45并SSR文案，前一帧及回0重建状态；不按raw seq乘90。
- God的7个private fact没有死亡效果；夜公告才整波死亡。各关键节点首/中/末帧及上一帧核状态，所有终局前无decision，最后与实际CP存活、徽与完整胜利相等。
- 字面双徽核 **10已死持徽→5活着持徽（包括蛇时）→5夜死仍持徽→6**，不能只检查最终6。
- 并行败选者11在10自爆及Snake时仍活，原刀公告后才死；第二gap也覆盖。末狼已全部死亡后Snake/空夜公告仍无decision，最终Good，2号救回存活。
- 双语具体目标与知识文案有字面断言；原未知事件、畸形已知事件惰性降级、旧档迁移与公共stage覆盖保持兼容。

## Chromium与功能门禁

全部浏览器使用已有 `/usr/bin/chromium`，`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium bun run test:e2e -- <spec> --project=chromium --workers=1 --retries=0`，只连接本机Vite。

| 实际浏览器范围                      | 结果             | 原始日志                                         |
| ----------------------------------- | ---------------- | ------------------------------------------------ |
| 26 God档两语                        | 26 pass，3.3分钟 | `/tmp/awa-mist-front-chromium-v2.log`            |
| 炼金/狼鸦/村民最小私有movie输入两语 | 6 pass，2.3分钟  | `/tmp/awa-mist-front-private-chromium-first.log` |
| 字面双徽全过程与逆序两语            | 2 pass，2.3分钟  | `/tmp/awa-mist-front-badge-chromium-first.log`   |

合计 **34个实际Chromium用例、0失败、0重试**。God同时检查sidebar与视频席位opacity、实际徽、composition文案、slider中帧/公告前一帧/逆向回退、终局→开头、语言/UTC、reload；私有输入另外核其他身份unknown、本人角色、实际owner事件及逆向seek。双徽在每个中间点同时断言座位唯一持徽与视频holder文案/透明度。

新archive+literal **138 pass / 7042 assertions**，相关reader/旧档/stage合计 **232 pass / 7898 assertions**；前端全量 **666 pass / 12253 assertions / 66 文件 / 0 fail**，`/tmp/awa-mist-front-full-unit-first.log`。root check/lint/format、frontend build和diff通过，日志 `/tmp/awa-mist-front-check-v3.log`、`/tmp/awa-mist-front-lint-final.log`、`/tmp/awa-mist-front-format-final.log`、`/tmp/awa-mist-front-build.log`。本批不冒称已重跑全部后端或全Chromium支持范围。

## 三路交叉复查

- A：原unit132/4126与独立26 God+104 owner共6276事实审计通过，核来源顺序、owner、真实解封快照与旧夜隔离；`/tmp/awa-mist-front-archive-a-review.log`及`/tmp/awa-mist-front-fixture-audit.py`。未把God过滤当成private。
- R：指出原双徽只验最终持有人，新增字面维护及逆序浏览器后关闭；原样维护138/7042通过，`/tmp/awa-mist-frontend-r-maintained-final.log`。帧相等检查与字面oracle明确区分。
- T：指出双徽、private只frame0、browser只side seats的三个孔，均补 actual event frame、movie席位与exact seek；独立138/7042通过，`/tmp/awa-mist-front-closed-delivery-review.log`。核导出发生在实际finalize/Tape之后，未修改源码或测试输入。

第一轮Chromium缺默认headless shell，26例未进入产品验证，保留 `/tmp/awa-mist-front-chromium-first.log`；切换已有系统浏览器后实际执行。新增badge断言payload unknown类型错误已改为明确Number值，保留原check日志，不改变运行预期。新增导出专用测试正常环境有意skip，生成门禁已显式开关执行，不以skip冒充生成通过。

## 接续

完成角色登记与全支持范围同源门禁后推进其余P9d板；T6和P10长期资源仍遵守持续契约，不自动push。
