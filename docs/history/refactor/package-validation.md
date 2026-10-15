# C05a 三个既有共享包独立验证候选

## 写入职责

初始候选9文件，集成后追加3份tests tsconfig：packages/{game-catalog,game-text,replay-contract}/{package.json,tsconfig.json,tests/package-contract.test.ts}。未改包生产源、根runner、锁、应用测试、fixture或真实配置。

- 每包 public exports 保持 `.` 指向 `src/index.ts`，测试通过 package name 消费实际公开出口，不绕入另一个包src。
- 每包声明 `check: tsc -p tsconfig.json --noEmit`、`test: bun test tests`。
- 独立source tsconfig禁止Bun/Node ambient；tests项目单独types:[bun-types]并覆盖src/tests；strict、ES2022+DOM、ESNext/Bundler、noEmit；没有extends backend/frontend项目或固定backend typeRoots。
- devDependencies沿用已安装版本范围 typescript ^5.9.3、bun-types ^1.4.2；根整合统一install/lock及scripts由主实现拥有。
- 新测试具名责任注释、清楚说明独立literal oracle和应用尚保留的接线职责，不读取engine、真实auth/网络/paid模型。

## 验证责任

Catalog 4项：64唯一IDs与23/32/9状态，角色双语+规则卡元数据，unknown/raw名字与exact locale，机器事件/胜负/错误码。
Text 4项：所有1513 message key/placeholder完整对照与冻结，literal bilingual formatting/public MessageRef，失配参数/未知key明确拒绝，用户原文与locale交错。
Replay 5项：既有公开God和player fixture原文保持/只转metadata，未声明version稳定分类，invalid尾部/sequence/形状/accessor零getter（God inert入口），稳定诊断白名单复制/拒原始错误。没有宣称对任意浏览器Proxy零trap或已迁Node入口。

现有app tests保持，发现集合不减。本切片先成立owner验证入口，以下按原断言迁归职责，不能盲目整文件移动：

| 当前文件                                                      | 包owner部分                            | app应保留                                                                   |
| ------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| backend/tests/runtime/role_catalog.test.ts                    | catalog ids/status/names元数据         | Role enum一致、runtime profiles/custom/register/工具权限、实际rules链接读盘 |
| backend/tests/runtime/i18n_contract.test.ts                   | 全词典key/placeholder与formatter纯契约 | core各机器ID覆盖、custom RoleCatalog override                               |
| backend/tests/replay/replay_version_migration.test.ts         | reader兼容pure cases                   | exporter/actualwriter与文件系统失败边界                                     |
| backend/tests/recording/private_record_contract.test.ts       | player pure reader版本/shape           | actualPlayerRoundRecorder/SessionRecordManager消费与录制                    |
| frontend/tests/unit/replay/offline-replay.test.ts             | shared archive reader本体              | loader/eventLabel/浏览器消费                                                |
| frontend/tests/unit/replay/_facts_.test.ts及scholar两个深导入 | 各pure fact reader/preset实际职责      | frontend rendering/projection integration；preset算法迁ruleset不是contract  |

后续C08/C09与P2/C11应在discovery映射中分批去重迁入owner；本候选未把新增13项称作既有全部解析测试迁移完成。

## 执行与失败轮

- 3包独立 `bun test tests`：catalog首轮4/0/409；text第二轮4/0/3170；replay第二轮5/0/48。
- 同时固定候选运行 `bun test packages/game-catalog/tests packages/game-text/tests packages/replay-contract/tests`：13 pass/0 fail/3627 expect，日志 `/tmp/awa-refactor-existing-packages-candidate.log`。
- 使用既有本地compiler（尚待root包install）分别执行 `./backend/node_modules/.bin/tsc -p packages/<name>/tsconfig.json --noEmit --typeRoots ./backend/node_modules`；catalog/replay第二轮、text第一轮均退出0，源码和本包tests被覆盖。临时CLI typeRoots用于未安装候选验证，没有落进tsconfig。
- 九文件prettier check退出0。
- 原失败日志全部保留：text首轮错用新测试MessageRef params字段（生产parameters）；replay首轮新expect误认旧reason与Error message字段（稳定kind在error.kind）；catalog/replay types首轮Bun新matcher泛型与enum/rawJSON类型不兼容。修正仅本批新增tests，未改生产/golden/历史预期。
- rootscripts与offline install前，尚未声称 `bun --filter <package> check` 已实际完成；需主实现闭合并交叉审查后提交C05a。

## 根集成与审查

主代理完成offline --lockfile-only / frozen-lockfile install（禁网络和scripts），根check/test分别接入包过滤runner。实际check:packages三包0、test:packages13 / 0；原日志 `/tmp/awa-refactor-c05a-root-{check,test}.log`。独立review指出Bun ambient不能赋给浏览器生产源；据此split source types:[]与tests类型项目，并在最终日志另验，不把测试runtime当生产可用global。公开fixture原始字节未改，生产source/exports未改。

最终浏览器类型配置：三包source+tests两个project分别check都0（/tmp/awa-refactor-c05a-browser-{catalog,text,replay}.log）。提出者原global反例复跑，types=[]且process/Bun两项TS错误稳定拒绝（/tmp/awa-refactor-shared-package-environment-fixed.log；原反例exit1是预期拒绝，不计为项目check失败）。
