# P6 石像鬼交叉审查

范围：[冻结卡](../../rules/awa-gargoyle-v1.md)、[契约](../gargoyle.md)、具体查验实例/流程/原生命/刀权、受众和共享提示、中英回放。主代理实现，三名独立代理只读审查。

## 发现、修正及复查

| 审查   | 发现                                                | 修正及证据                                                                                             |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| R      | 同 ID 重复限制和转移旧知识政策需明确                | 冻结按实例 history，transfer 保完整 typed 知识并授权接收者，copy/gift 独立；来源版本与 AWA 细则分开    |
| A、L/D | transfer 可清空 history，重新验旧 ID                | 完整 state 语义校验，拒绝重置；源实例与事件不变                                                        |
| A      | JSON 字符串等值误拒完整状态的字段重排               | isDeepStrictEqual，重排正向和清空负向仓库回归                                                          |
| A      | 第三次等待后最后目标死亡，不报告/不耗用却未完成流程 | 最终 no-target 再验完成，第二/第三次耗尽均有回归                                                       |
| A      | 替换原生 GargoyleState 后旧回复授权新状态           | 捕获并终验原 native state 引用，无报告/use/刀资格                                                      |
| R/T    | 缺显式熊/放逐石像鬼墓反馈、查后再撤权断言           | 真实 PM 两夜熊、实际 Garg exile 后墓 camp Wolf；完成后六类撤权，零 Garg 请求/票，history/资源/事实保留 |

A 独立探针复验：原 actor 复活/组件/状态/能力替换/取消、同 World/day 重入与 World 隔离、次夜禁用、转移撤旧刀权、独立 gift/copy、完整知识脱离均通过。L/D 独立54条两语断言覆盖 Hidden 规则伪装、不回写旧报告、actor-only、目标/pack 无报告、DTO/JSON、gift 真实身份、bound 实例目标和共享完整规则；修后复跑16/115关闭原两项。R 最终独立 core/config34/243与额外只读6/49，补齐仓库回归后复查0阻断。

强化提示 oracle 中曾错误把十二人第二夜查验前当已接刀，已改为实际第二夜猎枪波次后；生产保持 awake day2。两个原始失败日志保留，未通过提前修改游戏规则来配合测试。

## 功能证据

- core **32/229**，`/tmp/awa-p6-garg-core7.log`；新能力独立账本、Mask/Knight/熊/墓、White/Beauty/Dream/王枪、查后六撤权均属手写预期。
- 初轮 **36本机双语整局＋4gift任务，22/5427**，`/tmp/awa-p6-garg-wire1.log`；所有完整局严格 Tape，逐演员脚本消费、受众/终局、MCP schema与 PID ESRCH。新增 gift 重复拒绝/纠正4/48，`/tmp/awa-p6-garg-gift2.log`；强化提示十二人 probe 1/939，`/tmp/awa-p6-garg-wire-prompt2.log`。
- 受影响 engine/config/catalog＋40 seed/Tape **471/8369**，`/tmp/awa-p6-garg-foundation2.log`，较早 source；新 core 与功能终端契约21/2207单独再验。
- 前端 **103/953**，type/build通过，`/tmp/awa-p6-garg-front-{tests3,type,build}.log`；真实God档具体角色标签不变 seats，接刀/真实死亡/胜利成员分开，unknown typed fallback、raw 与纯 frame 保持。
- actual Chromium **42通过**，`/tmp/awa-p6-garg-e2e.log`；新增六case验证中英查验/接刀、零提前 winner、全字幕与席位 bbox。

## 最终门槛

目录登记16 verified／48 planned后，最终冻结 source 的 `release:check` **1176 tests／105387断言／131文件，0失败、exit0**，含类型、依赖、边界、i18n57精确例外及smoke，`/tmp/awa-p6-release-verified.log`。所有已支持 **542本机双语SDK/ACP/混合完整局及全部严格Tape**、受限观察板子回归与接入故障/资源回收共同通过；source 未在活跃对局中修改。较早 implemented首轮同计数完整release记录为`/tmp/awa-p6-release-final.log`，不替代verified最终证据。

前端103/953、最终type/build exit0，42实际Chromium通过；两张实际PNG `/tmp/awa-p6-garg-zh.png`（frame820、接后王枪前）和 `/tmp/awa-p6-garg-en.png`（frame190、十二人首夜role:Seer）渲染exit0，主代理与L独立目检字幕/席位完整且无提前winner。未另外宣称本批重新编码MP4，现有纯frame/render管道保持。

R／A／L+D 三路角色及P6阶段复查0剩余阻断。L独立front12/86、config2/14、fixture与SDK语义核对14断言、文档链接及两PNG；阶段计数按源码核验，未冒称子代理重复整个542矩阵。最新文档本地链接140项与`git diff --check`通过。

[P6整阶段验收](p6-activation.md)关闭，完整目标仍继续P7–P10／48角色／组合矩阵／长局／T6。未调用外部模型、访问用户认证或修改用户configs。
