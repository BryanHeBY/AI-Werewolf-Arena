# C06 game-contract prototype 只读复审

范围 packages/game-contract/**，旧 backend identity 与 catalog 原点 27a97cb；未提前迁 source/bridges，未改 package 或依赖链接。

## 已实测

- /tmp/awa-game-contract-readonly-review.ts 直接 Git 读取固定基线的 enum AST，按实际字符串 initializers 与新runtime Object.entries逐项比对：9种enum的键、值、插入次序完全相同。
- 从实际基线catalog metadata字面 id提取64序列，新ROLE_IDS完全同序；55 executable Role，不添加9 planned枚举成员。
- 实际ROLE_IDS.splice mutation 不影响canonical guard，与基线guard不读取公开ROLE_IDS数组的语义相同。LOCALES runtime数组mutation后isLocale读其公开数组，保留既有不冻结API；测试末尾恢复原值，不改归档。
- src五文件 AST import/export targets均本包相对路径；无catalog/text/World/rules/Node/React依赖。
- package 5小测试 / 0 fail / 130 expect，/tmp/awa-game-contract-independent-reviewed-tests.log。
- production types:[] source检查exit0，/tmp/awa-game-contract-review-source-types-second.log。

## Candidate装配剩余

新包当前node_modules/.bin/tsc未建立，tests tsconfig用既有backend tsc实际返回TS2688找不到bun-types（/tmp/awa-game-contract-review-test-types-second.log）。声明scripts/devDependencies/exports齐全、rootfilter可发现，但在同commit安装/链接与package原生命令通过前，不能将新包验证完成。

## 桥接检查点（尚未执行，不把设计当证据）

- backend旧 enum/source必须迁成同一个contract enum的具名重导出，才能保持旧Enum成员类型与运行对象身份；不能同commit留下两手维护enum。
- catalog RoleId显式消费contract raw string union（当前new `${canonical[number]}` 写法保留 raw literals），不要迁ROLE_DEFINITIONS.id为enum values后再derive nominal enum union。
- catalog64 metadata完整性按contract ID sequence检查；stable ID authority不能继续从metadata定义，但roleName/status/rulecard归catalog。
- ROLE_IDS/LOCALES现有mutable runtime API保持；不能为“安全”隐式freeze或让metadata查找消费外来修改的ROLE_IDS。
- 原ROLE_DEFINITIONS类型readonly但JS runtime实际未freeze，恶意cast改metadata会影响旧isRoleId。若新guard改由canonical contract而不再响应这种非法metadata mutation，应注明边界/政策，而非声称所有非正常对象变异完全等价；目前仓内未发现这种业务consumer。
- 本包source/tests类型环境分开正确；tests的Bun node类型不进入source。待真实package-owned check/test与应用桥接受影响门禁。

原enum/member/raw RoleId证据良好，无值或顺序blocking问题；上述安装与桥接是本候选实际未完成步骤。
