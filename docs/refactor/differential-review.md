# P0 harness 修复复审

本轮仅修改新授权的 tooling/refactor/build-snapshot.test.ts；既有工具与生产实现均为只读。

## 实测关闭项

- /tmp/awa-refactor-harness-review-adapted-first.log：10 pass / 2 fail / 18 expect；当时新增 owner-local dependency link 与 stale installed version 两项仍红。
- /tmp/awa-refactor-harness-review-adapted-second.log：作者修复后原同一 adapted oracle 12 pass / 0 fail / 18 expect；稳定 engine.id/未知字段不再被 comparator 删除，原 source membership/byte/private canary/目标 symlink/所有 workspace mapping/物理依赖复制/自身 byte hash 均已实际覆盖。
- 维护测试 tooling/refactor/build-snapshot.test.ts：最终 /tmp/awa-refactor-build-snapshot-tests-second.log 为 **15 pass / 0 fail / 25 expect**。包含上述 snapshot 修复以及 relative store symlink 正向、escaping absolute link 反向、dependencyDigest membership/destination 和 subprocess layout/clock 三项；全部用临时字面 mock，不依赖真实安装或 /tmp 既有构建。
- 工具类型命令 ./backend/node_modules/.bin/tsc -p tooling/tsconfig.json --noEmit 最终退出码 0，/tmp/awa-refactor-snapshot-review-types-final.log 为空；build-snapshot.test.ts Prettier check 0。原另 lane comment-check 类型失败输出保留 first types log，未覆盖。
- driver /tmp 独立实测第三轮 /tmp/awa-refactor-driver-boundaries-review-third.log：4 pass / 0 fail / 8 expect。traversal/layout symlink、顶层 captured Date.now、真实 Animal 首夜 unplanned charm 错误不能冒充 never-reached fault；最后一项实际返回 differential_unexpected_failure。

clock 测试只证明导入前逻辑 Date.now 固定，native setTimeout 未改写。不声明真实 deadline、late MCP、资源回收已由本离线批验收。

## 真实物理构建只读核验

实际第三轮根目录 /tmp/awa-refactor-differential-p0-third/{baseline,candidate}；独立程序 /tmp/awa-refactor-real-build-review.ts、输出 /tmp/awa-refactor-real-build-review-second.log。

- 每 build 563 manifest source files，逐项对象类型和 SHA256 与真实字节一致。
- 所有 owner 的 dependency symlink 分别 1319 / 1325 个，真实目标全部在其各自 snapshot 内；没有 checkout app/package 混入。
- 独立按原严格指纹算法重新 hash 真实源码：两边 sourceHash 都 b603ece35929ad44b8dae7caf3738d8e2ca41e9f5ffd3020c3b105d1db55c8e0。
- baseline lockHash a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074；candidate lockHash 5df9eaf6558dbc07fa3ddfce9926d9192b89cd52591c120806eebc5ebd42f3e2；均与自己的 Tape metadata 匹配。没有改写历史 fingerprint。
- basic-six：两边 53 events / 34 decisions，strict replay 的实际 replay.json archive 也 53 events；报告 difference=null。该第三轮在核验时仅 basic case 报告已完成，不据此声称其余 family 已完成。
- 原独立核验误假定 strict replay 会生成第二份 reproduction.json，因此 first log 为 ENOENT；已修正：native strict replay 当前生成 replay/logic_ops/manifest archive，未把不存在的 Tape 当作已经生成。

## 剩余范围

已实测的 P0 harness 原审查问题可以关闭。后续全阶段受影响组合和本机真实 adapter/time gates 按计划执行。driver/layout digest 前后检查经静态复核存在；本轮没有人为并发改它们，所以不把 concurrency mutation case 标为已跑。真实第三轮不代表更新后全七场景的最终同输入/同工具摘要验收；以作者最终轮 fingerprint/report 为准。
