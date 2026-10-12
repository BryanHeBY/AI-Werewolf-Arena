# P0 数据与发现清单第三方向审查

范围：tooling/refactor/inventory.ts/tests 与 generated 五个baseline清单；固定生产起点27a97cb，不写仓库。没有运行业务、完整gate、模型、私有配置或真实auth。

## 独立确认

- 全部2343个公共Git blob逐条 SHA256、字节数、Git blob id核对；2343唯一path，无差异。匹配公开allowlist，排除本机configs/.env/auth/.codex/.aws/node_modules；public symlink明确拒绝。
- Git清单独立正则枚举：616 test/spec文件、907 fixture/snapshot、1278 TS/TSX；与JSON完全相同。
- 固定证据 cases8474，IDs8474唯一，覆盖616发现路径。backend6907=6906pass+1skip，frontend1205pass，Chromium362 listed且完整run成功；没有把browser listed伪装成逐项重新执行pass。
- AST2767含describe；1075未展开标题、1082带parameterization保持表达式与位置，和执行展开cases分列。重复title occurrence保持identity，Bun末尾skip复述不重复计入。
- 独立Git字节 hash算法得到source b603ece35929ad44b8dae7caf3738d8e2ca41e9f5ffd3020c3b105d1db55c8e0，lock a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074，与401覆盖及173未覆盖记录相符。指纹边界没有宣称全构建。
- 三包root exports/check缺失按baseline真实登记；fixture references明确为字面线索，不以无引用判可删。
- 原生成器重生成五清单values完全相同，输出/tmp/awa-refactor-p0-inventory-crossreview-regenerated.json。真实旧证据before/after2618条完全相同，公开执行2340条有效；历史日志不是本轮重跑数字。

## 发现与关闭

P2-A：旧实现只读inputs.before，忽略after；将公开after内PM sha改零仍采纳8474cases。原复现/tmp/awa-inventory-after-audit.ts、原结果/tmp/awa-refactor-inventory-after-review.json。

P2-B：before/after同时移除根package.json/bun.lock/bunfig.toml，旧coverage循环只要求四组目录，仍采纳8474cases/matched2337。原复现/tmp/awa-inventory-root-input-audit.ts、原结果/tmp/awa-refactor-inventory-root-input-review.json。

主实现已独立修正verifyFrozenExecutableInputs：before/after必需且结构严格；重复path拒绝；统一executable predicate含三个根入口；执行集合成员+SHA相等；每一项核对Git；Git执行全集强制coverage；记录双份manifest hash。真正已有baseline2340输入并未受到反例影响。

提出者复跑原两反例：分别inventory_evidence_inputs_changed和inventory_evidence_input_coverage_missing，均正确拒绝，不改原反例输入。复核日志/tmp/awa-inventory-after-audit-second-independent.log、/tmp/awa-inventory-root-input-audit-second-independent.log。补充维护反例覆盖after缺失、成员/byte变化、重复项、root同时遗漏。

## 结论

上述两个P2已关闭；数据/发现/历史证据采纳范围无剩余阻断。C01/P0本范围成立，C02差分执行另按其固定transcript与snapshot证据裁决。scan全仓新路径、新扩展名、pure契约搬迁的完整指纹属于P1持续门槛，不因本基线清单正确而自动完成。
