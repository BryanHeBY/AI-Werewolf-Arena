# P3 I04：工作台与离线渲染交叉审查

日期：2026-10-08。范围：共享replay文案、loader结构化错误、显式展示输入/时区、工作台播放与筛选、Remotion逐帧投影、PNG/MP4离线入口及发布/资源所有权。

## 三路审查与修正

| 代理                     | 独立重点                                                            | 发现与关闭                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R `review_scope_rules`   | 事件payload/原文/unknown、存活与警徽、最终结果、canonical不变       | null winner曾固定显示Unfinished，max_days实际已终局；现以终止事实/有限终止原因显示No winner，in_progress保持Unfinished。双语人工4frame警徽/死亡oracle通过，0剩余阻断                                                                    |
| A `review_arch_tests`    | 显式props/frame、Player状态、渲染输入/源保护、资源与失败、参数/测试 | SDK内部close未明确await；现显式browser owner、统一实例、等待close、保留多个错误。直接最终路径渲染存在晚到symlink覆盖源的实际复现；现owned artifact→同FS link独占发布，原探针确认源/竞争目标未变、EEXIST拒绝、browser关闭一次。0剩余阻断 |
| L `review_i18n_delivery` | 字典/控制/错误/语言hint/日期、历史数据与文档                        | 原型形状unknown reason、缺失timezone、固定英文kicker、loading仅改时区误锁locale均已修。原话/未知保留；原生固定英文controls改自有双语交互。文档限定Date解析失败保原文，不宣称严格历法校验。0剩余阻断                                     |

A建议补播放中切换；现实际E2E断言Pause状态保留且进入下一个事件。L建议File I/O也使用MessageRef；现`readOfflineReplay`归一异常，合成私密异常标记不展示。新输出父目录可创建；只清本次拥有的临时目录，不删除竞争方目标。

## 主代理验收

- `bun run --cwd backend release:check`：291通过，0失败；最终状态日志 `/tmp/awa-p3-i04-release-final.log`。没有调用外部模型。
- 前端单测：45通过，0失败，包含手工事件/终局/日期DST/raw oracle、同frame markup和clone，以及open/select/render/close故障、已有/晚到普通文件与source symlink保护。
- 前端类型检查包含新增unit/E2E和离线脚本；通过。`build:frontend`通过，`git diff --check`通过。
- 实际 Chromium E2E：6通过，包含暂停seek/筛选后的双语/时区切换、source hint/raw名字发言、错误/空状态、加载仅改timezone、播放中语言切换、null终局。最终命令使用本地Bun Playwright CLI及`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`；日志 `/tmp/awa-p3-i04-e2e-final4.log`。
- 实际中文PNG（上海时区）、英文PNG（UTC）与英文MP4成功；人工查看中文PNG和MP4的第100frame解码截图，角色/死亡/事件/语言/日期正确，底部席位不与说明卡重叠。
- 相同canonical fixture、英文/UTC/frame100两次最终PNG SHA256均为 `464f2b2d2211afcda66367f370e9b641085d230b199dbfdbe97934ae0d941067`。这是同环境固定输入的确定性证据，不承诺不同字体/浏览器/编码器版本的像素相同。
- MP4探测：H.264，1280×720，30/1 fps，180frame，6.000000秒；有损视频不以PNG逐字节相等作为门槛。

渲染测试产物与浏览器报告不提交；仅源、锁文件、文档和测试交付。来源为已有基础fixture，不能代表全部计划角色矩阵验证。

## 阶段边界

[replay-display.md](../replay-display.md)说明显式输入、API兼容与历史政策、CLI、独占发布和清理限制。P3剩余日志及整体英文运行门槛仍继续；英文runner/Tape gate未解除。没有更改领域规则、传输接受策略、受众或计划角色执行许可；P4–P10仍按完整持续目标推进。
