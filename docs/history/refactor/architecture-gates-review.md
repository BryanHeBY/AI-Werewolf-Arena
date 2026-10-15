# C04/C05 独立只读审查（待修）

审查七文件：tooling/refactor/architecture/{contracts,dependency-check,comment-check,naming-check,run}.ts、architecture.test.ts、docs/refactor/generated/architecture-debt.json；以及 root runner 和 C05a 三共享包公开验证九文件。未改 repo，未执行真实通信或大套件。

独立字面 AST 反例：/tmp/awa-refactor-architecture-independent-review.test.ts
第一轮 /tmp/awa-refactor-architecture-independent-review-first-red.log：0 pass / 11 fail。
第二轮补 public-export escape/metadata cycle/test realm/bare rule link：/tmp/awa-refactor-architecture-independent-review-second-red.log：0 pass / 15 fail。
这不是应用失败数，表示门禁目前没有拒绝这些独立反例。源码在并行修改中，以复跑原反例判定关闭。

## P1：债务可以吞新增权限

- dependency-check.ts Reference 没有 binding kind/imported symbols；violation ID 只取 specifier+resolved target。
- run.ts checkArchitecture legacy matcher :234-240 匹配同 rule/path/specifier/target；old.detail 固定描述也相同，allViolations 还按相同 ID 去重。
- 实证：原禁止边 import{x} 同一目标，改成 import{x,hidden} 或 export*，有效职责头不变，report.failures 都为 0。这违反 C04 精确债务不扩大的核心要求。
- 建议 binding identity 至少含 import/export/import-type/require、type-only/value、default/named/namespace/star，以及有限 symbol 集。旧债务必须逐项相等；新出口、namespace/star 扩面不能继承旧 narrow import 债务。

## P1：正常 root 验证尚未执行候选门禁

root package.json 的 check 接线 tooling tsc/packages/backend/frontend，test:tooling 跑单元 fixture；lint 仍只 backend/front 原 lint。没有调用 architecture/run.ts check 或独立 check:architecture。

候选源码违规不会因门禁单元测试通过而报错。C04/C05 同 commit 接 root check/lint 或明确 root gate runner，并保留 JSON artifact 与 concise summary；最终 strict 模式必须有实际入口。

## P1/P2：依赖解析与 owner 约束

1. dependency-check.ts references :122-132 漏 ImportEqualsDeclaration/ExternalModuleReference；import other=require('../b/effect') 完全无 violation，已实证。
2. publicFeatureTarget :44 只按 basename index/contracts/ports；b/private/index.ts 被视为公开出口。应绑定 feature root 的确切 public entry/port，不允许任意子目录同名文件绕过私有归属。
3. owner 规则没有 domain/core→feature/engine/agents/adapter 禁止，也没有 independent recording verifier→production resolver 禁止；两条实际字面图都 zero violation。增加旧路径与目标路径的职责层映射，已有违反列固定基线债务，不放开新边。
4. workspace 查找 :248-249 仅 packages/*；backend/frontend 包名会被 consuming dependencies 声明当 external。前端 import declared backend workspace name 通过。按所有 workspace manifest name 解析，然后施加真实目标 owner/browser 边界。
5. tsconfig 只抽取当前 compilerOptions，没有 extends 或 baseUrl bare-source resolution；alias 符号与某 external 同名时可被 external 声明挡掉。在独立图中 baseUrl '..'、bare backend/src/effect + declared backend 无 violation；extends 场景仅 unknown-package 误拒。应使用受控虚拟 FS 的 TypeScript config/module resolver 或完整等价规则，不用路径字符串模拟覆盖所有语义。
6. packages/a.exports='./../b/src/private.ts' 被 resolveFile normalize 成 b 私有源，并 viaPublicPackage=true 绕过 deep-import rule；已实证。export target 必须为该 package root 内允许文件，拒 traversal、外来 pkg、private/install segment；消费者还需声明该 workspace dependency。
7. metadata package.dependencies A↔B 没有 source import 时不报，仅源码边做 cycle。应检查生产声明 package graph（dev graph 单独分类）与实际 source SCC，避免纯 manifest 环等下次导入才发现。
8. production feature→backend/tests/support/oracle 相对导入通过；新增生产依赖测试或 tooling oracle 必须拒。测试自己拥有 privileged consumer 并非允许反向进入运行实现。

## P2：C05 coverage 与链接

- contracts.ts isTypedSource :112 仅 .ts/.tsx；.mjs scripts、.mts/.cts 和 JS/JSX source 都绕过 checkComments，且 modified-head strictness 也用同 predicate。独立新 mjs/mts 无头返回 zero violation。扩自维护脚本/模块覆盖，按真实 parser kind，而不是误把非TS脚本静默略过。
- comment-check.ts :158 只检 Markdown [label](path)；计划示例的 Rule contract: docs/rules/nonexistent.md 裸本地引用不校验，已实证。支持规则卡/生成器惯用 bare path 或要求统一显式链接并拒绝未规范裸引用。
- commentCategory 依赖文件名/路径，concepts 为关键词 regex；它不证明 owner、clock/terminal、state 权限或 oracle 独立性。当前注释明确声明此限制是诚实的；不要把 shape gate 成功当内容真实性。新的 requests/lease/hook 需要人工归类审查，不因命名普通就降低生命周期要求。
- naming-check 只 development prefix/extended bag；没有全 kebab-case/PascalCase 或未知例外 gate。本阶段可以登记最终阶段负责的范围，不能将目前 lint 宣称为全部 §13 命名验收。

## 已有良好范围与仍需复核

- run.ts 读取 tracked+untracked public 输入并逐级 lstat，拒 source 与 ancestor symlink，private filter 避免真正 auth/config bytes；原 tests 提供该边界反例。没有绕过这些已存在的保护。
- CLI 从 immutable Git BASELINE_COMMIT 再生成完整 debt 与磁盘 debt 严格比较，防手改债务；checkArchitecture API 单测可用合成 debt，但正常CLI不采信自我生成的 candidate exception。
- changed/new TS heads、strict 模式、byte-identical path mapping 有现有字面测试，方向正确。精确依赖 edge identity 修复后再生成真正 baseline，不把 candidate 新坏边塞 debt。
- C04 尚无 source fingerprint reachable coverage gate，当前 production/new shared package 指纹根维护属 root 后续 C06-C09 同 commit 必做；不以 architecture import gate 替代它。

## C05a 共享包独立验证

三包新增 package.json check/test、tsconfig include src/tests、public package self import unit/compatibility 测试、root check:packages/test:packages 均已接线。Catalog 的 64/55/9、两语名称/稳定ID；Text 的完整 key/placeholder 冻结与用户原文；Replay 的既存 God/player fixture+版本+恶意 accessor+diagnostic whitelist 都是清晰小边界，不调用 backend resolver 生成 oracle。现有应用大量 owner tests 后续迁移责任仍应留列表，不声称这 13 小包测试替代它们。

实证环境限制不足：三包 tsconfig.types=['bun-types'] 同时用于 src/tests，独立 mock 浏览器 source `export const ambientNode=process; export const ambientBun=Bun;` 类型检查无 diagnostics。

/tmp/awa-refactor-shared-package-environment-review.ts 与 .log；仅引用对象，不读取任何 process.env 或 auth。

建议 production src 独立 types:[] 的浏览器 tsconfig，tests 用扩展配置提供 Bun 测试 types；或显式 C04 AST/global-runtime 规则。不需要禁止包测试使用 Bun/Node filesystem，测试与生产 runtime 权限分离。

## 修复后的最终有限复审

作者补原15反例后，独立原文件未改复跑：first-fix-confirmation.log 与 final-confirmation.log 均 **15 pass / 0 fail / 15 expect**；原first/second红轮保留。维护tests作者已加入33个case，另增TS moduleSuffixes真实owner反例；本轮我未重复其已完成整批。

逐项静态复核：ImportEquals/ExternalModuleReference已纳入；binding kind/type/value/symbols进入violation与固定debt matcher；公开feature入口绑定根；domain/verifier/test realm与所有workspace owner建立；package export必须在owner内部；生产manifest+source边做package cycle；TS受控虚拟config/module resolver处理extends/paths/baseUrl/moduleSuffixes，不读宿主依赖/私有目录。

root package.json已将lint:architecture放入check与lint的第一步。独立实际 `bun run lint:architecture` exit0，/tmp/awa-refactor-architecture-root-gate-review.log：2387 files / 1778 remainingDebt / 0 failures / 1 clearedDebt。旧债由固定27a97cb按补全规则重新推导；不是把candidate新增违规补成债，也不是全仓zero-debt。

C05 shape gate仍不证明注释语义真实；最终命名/指纹reachable覆盖与各阶段逐owner偿债按原计划推进。原15blocking范围及rootrunner缺接问题已实测关闭，无该有限审查新增blocking。
