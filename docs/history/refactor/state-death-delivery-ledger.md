# 状态槽与死亡波交付登记

本批 C48 只把三笔实际功能提交的三个子项追加到[当前机制台账](generated/current-mechanism-migration.json)，不修改源码或冻结基线。

| 格 | 已提交来源 | 本次登记 |
| --- | --- | --- |
| `noble_secret_body.state` | `771a7bf4` | 原两状态的完整同引用写入、唯一 JSON 影子编码／比较／逐属性解码归实际 state owner，七个真实 writer 接入。 |
| `mist_raven.state` | `5db015df` | 唯一 raw／JSON／数组／行／targets 绑定、复验、读取和安装归状态槽，四个真实写点使用同一晚授权复验源。 |
| `wolf_beauty.lifecycle` | `40dd1e4d` | 完整牵连准备及标死后的关系事实发布归本族贡献，原 relation 权威与引擎标死、许可关闭、其他关系及 finally 保留。 |

三个原 pending 格仅改为 partial；91 行、910 格保留，状态从 **203 partial／707 pending** 变为 **206 partial／704 pending**。complete 和 not-applicable 仍为 0。原 298 个 part 与 1,120 条 remaining 要求全部保持顺序前缀，只新增三个 part 与三个具体剩余要求；其他 907 格完整不变。

本地状态槽和影子 codec 不等于整族公共类型、请求／生命／夜间许可、实际付款、独立记录 verifier 或 strict Tape 的完整验收；死亡波贡献不代表完整角色死亡链或关系胜利完成。这些既有边界继续由原 owner 持有，本次没有把未交付项目标为完成，也没有重复登记到 checkpoint、effect 或 oldExports 格。

before 捕获时 HEAD 已推进到文档审查提交 `96d3d027`；矩阵与该真实 Git blob 同字节，其前三个功能来源均是祖先。`observedCommit` 记录此次实际捕获点，不把格外文档提交登记为机制 part。三笔提交的十一处源码及各自功能证据通过实际提交中的 scope SHA 绑定；当前死亡结算器有后续枪资格工作树变更，仍保留两狼美人调用与四 getter 接线，本批不把并行变更当成已提交来源。

冻结 89 行基线 SHA 仍为 `60f1eb79143813b944abbc5f6ce7b0e6a22f4debf92a9f4e428b2d887cbb72c9`，与真实生成提交及本次基准提交的完整字节一致。基线 metadata 中的 `27a97cb` 是被测输入提交；生成 JSON 在后来的 `b56d2824` 才出现，不能把测量输入误当文件生成来源。

[证据](generated/state-death-delivery-ledger-evidence.json)保存完整原矩阵、明确新增映射、三笔真实提交／owner／文档及当前源码摘要。精确重建整个候选与当前 JSON 相同，没有改旧数组、原政策、列、行或基线字段；只更新已声明的根 metadata。初次来源／捕获时点核对器错误保留在证据中，只修检查器，未调整产品或基线迎合它。

本批不运行类型、测试、模型或结构门禁。状态数量是登记进度，不是玩法覆盖率或全目标完成率；周期准入、其他 DTO 与后续已提交／并行来源继续单独登记。独立审查后由 Root 按文档功能提交。
