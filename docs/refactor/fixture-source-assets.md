# 可执行 fixture 与归档数据

## 先迁源代码

C14 的第一笔实体迁移包括三个 ACP fixture：`acp/audit-agent.ts`、`acp/game-agent.ts`、`acp/ownership-agent.ts`，以及 C13 两个待迁支持模块：`builders/audit-summary.ts` 和 `features/mist-raven/oracles/transport.ts`。十六个真实消费者改用新的支持入口或 ACP purpose selector。

三个可执行 fixture 属于源代码资产，迁移后的职责头和 import 路径使其字节摘要变化。清单 v2 分开记录原 commit/path/SHA/size 与当前 path/SHA/size，并验证整个非 import 程序及实际 imported binding 身份；不能把它们称为与原 fixture 字节完全相同。

其余 904 个 JSON 归档在这笔提交中保持原路径和全部原字节。Root 独立通过固定 Git blob 核对全部 907 个原始摘要与当前摘要，904 份归档逐字一致。第二笔归档实体迁移另做。

## 清单与实际门禁

`bun run check:fixtures` 接入根 `check`，验证当前完整清单和物理文件，输出简短计数。CLI 默认仍输出完整清单 JSON；`--check` 仅验证和摘要。过程只读公共 allowlist，检查 root/ancestor symlink、文件类型、固定 Git、原/当前字节、源代码与 import 身份、实际 JSON metadata/cohort 和派生局部清单。

解析器对所有有限 kind/state/status/evidence 字段要求真实字符串；array coercion 不可绕过 kind 分支。source commit 必须为真实字符串，支持代码的原/当前路径都限定在支持目录。归档来源和 producer build 仍明确分开；未知来源保持 unknown，全部 suite 仍为 pending-review。

operational fixture table 从 v1 迁到 v2，旧 v1 输入明确拒绝；根 table、reader、selectors、测试与命令同时迁移。这是维护工具的格式变化，游戏 God/player/checkpoint/Tape 格式和原 payload 没有变化。根 package 的命令变化由现有源码身份扫描覆盖。

## 局部证据与限制

五项 source program、十六项 consumer 程序及 imported binding 比较通过；二十五个实际 typed 文件职责头检查通过。必要类型检查通过，四项原 source 等价负例和三项精确 parser 反例通过；交叉审查保留 array-kind 被接受的原失败记录并在相同输入上复核修复。

三个迁移后的真实 ACP fixture 进程仅运行 initialize RPC 和 EOF，全部通过；没有创建游戏/MCP 会话或调用模型。最初 pipe stdin 的 EPERM 不计为成功，file stdin 的真实通过单独记录。未重复完整对局、传输、前端或浏览器门禁。
