# C06 engine fingerprint 独立审查

候选文件 backend/src/recording/engine-fingerprint.ts、backend/tests/architecture/engine-fingerprint.test.ts、runtime/simulation/reproduction_context.ts 的 currentEngineVersion。
我只写新授权 backend/tests/architecture/engine-fingerprint-review.test.ts；生产及作者原测试不修改。

## 原反例与修复实证

/tmp/awa-engine-fingerprint-independent-review.test.ts 第一轮 0/5，first-red.log；同一原输入第二轮 5/0/6 expect，second.log：

1. backend ancestor symlink
2. packages root symlink
3. bun.lock symlink
4. 同源/同 lock 下 package exports 选择现有另一入口
5. 正常 .internal.ts 模块修改

这五类作者已修并由独立实际重跑关闭，未仅凭静态看补丁标绿。

## 新维护测试

backend/tests/architecture/engine-fingerprint-review.test.ts 12 个测试：原五类、backend/package compiler config 与 bunfig 三个 metadata case、真实继承 compiler config、创建顺序与 TSX/JSON/cts/mts/mjs membership、私有canary、旧严格fingerprint拒绝。

第一轮（8 cases）/tmp/awa-engine-fingerprint-review-maint-first.log 8/0/12 expect；加 metadata/private/extends 后 second.log 10/2/19 expect。当前仍有两实际失败：

- 放开普通 dot modules 后，.codex/.aws/.git 私有目录中的 JSON 会参与 hash；与明确私人认证/配置排除要求不同。所有反例均 /tmp 自造 sentinel，无真实 credentials。
- backend/tsconfig.json extends 本机 tsconfig.base.json；修改 inherited baseUrl/paths 不改 sourceHash。只纳 primary tsconfig 不覆盖实际 inherited resolution input，需同步 fingerprint/snapshot/input inventory；若存在 Node-installed extends，明确归外部锁责任，不读取本地私有越界路径。

两额外原独立测试在 /tmp/awa-engine-fingerprint-metadata-private-review.test.ts 与 first.log（0/2）。

## CP、RNG 与严格版本边界

独立 AST 正文比较 HEAD 的 reproduction_context.ts 与候选：auditData、captureCheckpoint、beginGameReproduction 完全相同，唯一函数体变化 currentEngineVersion，无新增函数。程序/日志 /tmp/awa-fingerprint-checkpoint-body-review.ts / .log。

新严格拒绝测试仅原生初始化六人 World/初始checkpoint，不运行完整对局或模型。它独立按历史六目录算法构造 finalized 初始 runtime_timeout trace，sourceHash 保留旧政策值、lockHash 保留实际锁；actual replayReproduction 拒绝 reproduction_engine_or_lock_incompatible；input JSON 完全不变，输出目录不存在。不是改写真正历史Tape，也不声称生成了新对局golden。

CP/RNG算法未改变；扩大source identity导致旧strict拒绝是明确的版本策略变化，应与C06同commit说明。旧 public replay reader 与严格内部 Tape 不等同。

## 验证与剩余范围

修复我自己的 reviewer helper shadow/type Camp 错误后，backend tsconfig.tests 检查退出0，/tmp/awa-engine-fingerprint-review-types-third.log 为空；原两个类型失败输出 second.log 保留。Prettier 已格式化当前新review文件。

创建顺序独立测试不强行添加排序新政策：它比较相同有限输入逆序创建后的成员顺序，并核对 literal member set；新算法当前全局字节排序稳定。

runtime/AI/recording/new package/TSX/JSON 都已成为候选范围；package/primary compiler/bunfig metadata 也已加入，P0 snapshot sourcePath 同步由作者负责。无需重新生成历史Tape，不把旧构建已有fingerprint更新成新策略。

## 最终修复复审

作者补私有目录与有限compiler家族后，同一12case实际复跑 **12 pass / 0 fail / 19 expect**，/tmp/awa-engine-fingerprint-review-maint-final.log。进一步把所有私有 mock canary 文件设为 mode 000，仍为12/0/19，/tmp/awa-engine-fingerprint-review-maint-private-unreadable.log；读取路径静态复核为目录/文件名先排除后才readFile，未读取真实auth。当前测试不依赖这些字节可读，也没有私有内容进入hash。

最终 tests tsc exit0，/tmp/awa-engine-fingerprint-review-types-final.log为空；新review文件Prettier check0。

compiler metadata 政策明确为 root/backend/frontend/各shared-package 的 tsconfig*.json有限家族，含本仓维护的base/tests配置；不是遍历任意全系统extends。现有repo local extends在该家族内；installed external compiler packages由lock承担，未来非标准文件名或outside-family配置需要独立门禁/扩展识别，不能以本轮12case宣称已覆盖。

原5红与追加2红现全部由实际维护反例覆盖并关闭。历史失败轮保留，不重生成old Tape，也不把其fingerprint改为v2；CP/RNG正文保持证据仍有效。
