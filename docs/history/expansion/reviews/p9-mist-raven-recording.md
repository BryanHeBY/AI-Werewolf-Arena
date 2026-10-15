# P9d：迷雾鸦影独立录制账本切片

状态：记录核心候选，两个角色仍 planned，正式计数 44/64 不变。前置运行 `5faf725` 与玩家事件副本修复 `6930ece`。本切片尚不替代玩家完整观察 feed、真实 SDK/ACP/MCP、20–50 固定种子及前端／Chromium 验收。

## 职责与实现

`mist_raven_record.ts` 从原始行动及领域事实独立验证精确板、原身份／阵营、三份库存、解封与知识快照、普通刀多数决／全弃刀命名 RNG、救治与梦境来源、公开时序和逐 checkpoint 的存活、原生能力、票权、警徽、标记、胜利归属、日次及阶段。

伤害先冻结原普通刀及连续梦的座位顺序，再追加额外刀；救治仅删除普通刀来源，同一身体的额外来源保留位置，再确认梦牵连。额外刀不受雾、梦保护和蛇影响。基于版本协议独立实现 FNV/Mulberry 抽签，不调用生产 frame、目标 selector、stock 或 damage 判定函数。

`mist_raven_requests.ts` 独立验证原始请求和未发布前缀：既有夜及从末检查点推导的下一夜 Alive／库存／解封，有限阶段与工具、角色、合法参数、唯一机会、必答约束、原生 ability、前置结算早于后继开启。缺失／pending／error 不能授权后继；非法回复仅可留在明确终止的失败 CP 中，不变成成功事实。普通发言、上警、方向和投票的既有 soft 行为保留。

`mist_raven_sheriff_record.ts` 独立核对上警、退水、警下票、单候选自动当选与一次 PK，保持与放逐票／普通刀的规则区分。放逐从原始响应推导四次内有效票或既有明确修复弃票、票权、一次 PK 及实际放逐。警徽从原选择及当时合法候选核对，保留 null／无效工具销毁、白痴翻牌自动销毁、无候选例外。有限板拒绝其它技能、赠予来源、setup 及 wall/debate/lovers 等并列组件。

## 主任务测试与独立审查

四个人工完整情景（普通刀＋额外刀同体、救回摄梦人但额外刀杀梦游者、梦护刀口付费救治、固定种子全弃刀抽签）各中英一局；共 8 个真实 bootstrap／PM／Trace／finalized record 的自然三周期终局及精确 Tape 重放。人工期望核对死亡、药量、额外刀、知识快照；抽签固定 `[10,11,12]` 命中 11。

维护测试共 58 pass、0 fail、172 断言，日志 `/tmp/awa-mist-ledger-tests-7.log`：包括 27 项从独立审查迁入的增量回归，以及库存、知识、来源、公开顺序、CP、非法跨板请求／组件／技能和原动作不一致篡改。

三个只读代理审查，主任务修正，原审查者复验：

- R：真实自爆用 `wolfId`，投票前发生在 Voting；连续梦与同体额外刀在付费后保 `[3,5]`，理由 consecutive→linked；警长双方向及 null 默认合法。6 个原实际 PM＋Trace 判例通过。
- A：原 14 个坏增量（删除／pending／error 前置、顺序倒置、已耗库存、非法自验、伪提前蛇）与 3 个合法警长顺序误拒均修正；原 27 项未修改复跑 27／69 全绿。保留正常 pending／刚 settled 未发布及公共 null／错误工具／非法票修复前缀。日志 `/tmp/awa-mist-incremental-review-v4-green-attempt.log`。
- T/L/D：原 CP 票权／徽／标记／阵营／日期阶段、原生字段及 gift、晚移梦理由、改原票却保旧放逐、假枪等 12 项全部拒绝；8 类实际错误前缀和原正常／四窗自爆／警长顺序通过。后续 guard 的 action/error/pending、跨板组件、共同篡改交徽及 CP／票重等 6 个具体反例也拒绝，10 个真实 PK／白痴／交徽／错误标记正例通过。不把这些 stdin 检查叫真实通信或浏览器验收。

迁入 A 增量回归后，新增 markers 核验一度误拒 N2 Raven 尚未发布事实时的已落普通刀；修正为在原投票已完成且后继 Rave／Seer 请求已开启时独立推导刀口，保持 CP0 的未落标记状态。原失败日志 `/tmp/awa-mist-incremental-maintained-1.log` 保留，维护复跑 27／69 全绿。测试类型先将 Camp.Good 误写普通字符串，已改 enum；不用 Bun 执行代替类型门禁。初步检查脚本曾用空 players 结束 manifest，属于临时夹具错误，维护 helper 使用真实最终玩家和操作表。

## 门禁与后续

受影响录制／重放 18 文件 **359 pass / 0 fail / 2718 断言**，日志 `/tmp/awa-mist-recording-gate.log`，命令输入 `/tmp/awa-mist-recording-gate-manifest.txt`。root check（两端及后端测试类型）、lint、format:check、git diff --check 与后端 build 均 exit 0，日志 `/tmp/awa-mist-ledger-{check-final,lint-final,format-final,build-final}.log`。全部真实通信均为既有回归的本机模拟端点；未调用真实模型。

后续补玩家观察的完整性、受众与发布因果审计；新角色真实 SDK/ACP/MCP 中英完整／失败情景；受限策略的固定种子自然对局；实际记录的前端 fixture、回退／逐帧和 Chromium。T5 迟到证明依 docs/runtime-resources.md 的精确单回合预算与到达标记，不复用全局 1 秒配置冒称真实迟到。
