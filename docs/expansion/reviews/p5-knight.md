# P5 骑士交叉审查

## 范围与已运行证据

[冻结卡](../../rules/awa-knight-v1.md)与[接入契约](../knight.md)：普通骑士、一次决斗、三个离散窗口、真实 camp、非狼不额外揭牌、Duel/DuelFailure、遗言/徽章/完整链后判胜、中英及真实传输/记录/复盘。没有提前启用觉醒骑士或狼美人。

- 最后人工 core23／204 通过，日志 `/tmp/awa-p5-knight-core-final2.log`；含伪装、第三方、翻牌白痴、末神/末狼、双末窗/关闭、自爆优先、原错不耗和并发最终验证。
- 旧死亡链/普通自爆回归40／351通过，日志 `/tmp/awa-p5-knight-foundation.log`；新公开配置加载/解析、未知参数与实际 planned 守墓人拒绝已覆盖。
- 增强本人机会1→0后 8 case×SDK/ACP/混合×两语＝48实际完整局，24／5410及逐局Tape通过，日志 `/tmp/awa-p5-knight-wire3.log`。固定seed/动作/结果，不从引擎计算模型预期，初步wire英文role marker句末误写句号而实际逗号，修正 fixture 字面后保完整断言，无生产行为变更。
- 两板各16 explicit active 受限 seed 自然结束、零拒绝/回退、实际决斗正覆盖及逐局重放通过，连core20/config2共24／254，日志 `/tmp/awa-p5-knight-core4-random.log`。
- 前端77／614及type通过，日志 `/tmp/awa-p5-knight-front-{tests,type}.log`；真实浏览器/渲染与最终release终态见下方完成门槛。

## 三路审查与处理

| 路线                      | 发现/要求                                                                             | 处理                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R/T：review_scope_rules   | 普通/觉醒区分、末神先遗言/徽再判胜；伪装/白痴/双末窗/自爆优先；本人机会实际wire1→0    | 规则卡与独立core判例全部补齐；逐turn字面资源期待由SDK/ACP共同fixture校验                                    |
| A：review_arch_tests      | 状态与消费/DeathResolution/PhaseManager唯一所有权、异步撤权、API/Tape及测试可信度     | 原生命/角色/camp/资源引用最终再验；命名participant snapshot代替类型条件技巧；收尾复查结论随后登记           |
| L/D：review_i18n_delivery | prompt明确末位/双独立窗口；刊载方案不当普遍赛事规则；无callback与accepted≠applied契约 | 两语文本补序；来源写社群“孤独中的狼群”、正文2017-01-10含征稿；契约明确callback结果/缺失抛错和接收不等于消费 |

三路最终0剩余阻断：A实际独立core20／192，确认collector/同步消费/resolver/manager所有权与异步再验，未把主代理后加3例当自己运行；R独立core23／204，核算48矩阵人工结果/成员/存活/遗言/徽章/判胜点及新增伪装/白痴/双窗/优先级判例；L初轮core16／162，随后只读复查模板/规则来源/逐turn计数及契约、最终目录10／54。代理不重复完整接入/浏览器矩阵，门槛由主代理实际执行另列。

R指出主代理汇报曾把十二人Day2 checkpoint机会0误称模型提示0；该骑士Night2已死亡，无Day2请求。已明确资源0 wire正例为六人miss/last_god_miss的遗言，十二局只CP验证，不改生产规则或为了表述新增请求。

第一版全量769通过／1失败，唯一失败为旧规则摘要测试仍断言“仅首夜死亡者和真正放逐者”有遗言，遗漏新骑士失误例外。更新该字面断言并新增成功决斗目标无遗言断言，定向5／19通过；不修改生产规则、deadline或减少校验，随后重新跑完整发布检查。

## 最终完成门槛

最终 release:check **770／51514／103文件，0失败、exit0**，包含type/deps/boundaries/i18n（57精确例外）/全部test/smoke；日志 `/tmp/awa-p5-knight-release-complete.log`。原134＋骑士48＝**182实际本机中英SDK/ACP/混合完整局**与全部严格Tape按最后source运行；未在对局中修改生产源码。

- core23／204，terminal5／321、公开配置与严格窗口、每板20／共40受限seed及逐局重放2／50通过（`/tmp/awa-p5-knight-{core-final2,console,random-final}.log`）。
- frontend77／614、type及build exit0；日志 `/tmp/awa-p5-knight-front-{tests,type-final,build}.log`。最后目录只登记状态，不改变展示名字/规则或frame，展示代码与已验源码一致。
- 真Chromium **18通过**，两语实际hit/miss回放恰好只杀败者→终局，日志 `/tmp/awa-p5-knight-e2e.log`。
- 实际中文命中frame1360 PNG `/tmp/awa-p5-knight-zh.png`、英文失误frame1540 PNG `/tmp/awa-p5-knight-miss-en.png`生成exit0并目视正确：夜死5保dead，前者目标2死/骑士1活，后者骑士1死/非狼4活且当时徽章尚待下一事件转移；未提前winner，原名不翻译。未重复未变的MP4编码器，P3/G04实际视频门槛保留。
- 三路最终0剩余阻断，当前目录**10 verified／54 planned**，规则/配置/英文入口/进度一致；changed本地链接与git diff --check通过。

本角色交付完成；P5尚余守墓人，P6–P10及54角色/发布级组合/有界真实模型质量门槛保持目标。未访问真实模型、认证或改用户configs。
