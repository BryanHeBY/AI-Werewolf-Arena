# 普通死亡历史的独立审计边界与 Q3 实证

## 原输入、执行与版本身份

本批仅保存新输入实验和待批准方案，不修改生产、测试、schema、矩阵或进度。Root 唯一首次执行：`ca81c3` / session `27035` → `8fb248`，真实退出 0。命令及完整 raw 保存在同名前缀 receipts/output；作者没有运行生产、测试或检查。

准备时实际 HEAD 为 `b1b5a860e8556d4bc5d3cdafaf27bdcb0615f19c`，before 保存14个关键模块的完整 Git／当前原文且准备时相同。执行使用该 HEAD 加 Root 已冻结的 Ghost/C44 工作树输入，**不是隔离的完整 b1b5 Git 构建**。三份真实 Tape 都记录：

- sourceHash：`1495c831dbfe92bab6cfd34317018e374c7bdc55a13fec446f3191d25a597674`；
- lockHash：`0cec67d816fe691fd3a428baa40fdfc75d129410ac85fd2faf79f4b5a1d62288`。

脚本不替换这些身份，也不绕开严格重放兼容。Root 生成三个新字面、无模型、无私配置的完整一周期档案：六人 Cupid／Lovers-Hunter、六人 Dream／linked-Hunter、六人死亡警长交徽／首夜遗言。每个原 baseline 都先通过自身 exact replay，分别17事件／4决定、29／15、28／19；它们不是原题名、旧绿套件或 seed／transport 矩阵重跑。原写方磁盘 Tape、公开档、操作和 manifest，执行用的原 clone、四个变体、完整结果及原脚本／raw 均按字节保存，copies.json 逐项记录原 `/tmp` 路径和 SHA；原临时目录不覆盖。

## 四个实际变体与分层结果

| 手改输入 | 公开 reader | 直接18独立装配 | Tape parse（结构＋18） | exact replay实际首拒绝 |
| --- | --- | --- | --- | --- |
| Lovers 派生 Hunter2 增加枪事实 | 接受 | 拒绝：`reproduction_cupid_state_invalid` | 同左 | 同左，尚未进入重执行 |
| Dream 派生 Hunter4 增加枪事实 | 接受 | 接受 | 接受 | `reproduction_checkpoint_mismatch` |
| 徽事实交6，末 CP 仍徽5 | 接受 | 接受 | 接受 | `reproduction_events_mismatch` |
| 首夜夜死者遗言 request 来源改 Day＋WolfKill，执行仍 Day | 不适用：公开事实无此来源字段 | 接受 | 接受 | `reproduction_observation_mismatch` |

枪事实插入仅平移包含它的 CP eventCount／公开 seq。Dream 的 exact 首拒可能已由这个 CP 游标差异触发，不能进一步声称 exact 是在某个独立枪资格判断处拒绝。徽事实与 CP 矛盾、遗言请求观察矛盾也各保留真实首错，不统一改写成“规则错误”。

`readReplayDocument` 保纯数据、封装版本、玩家／事件序号及显式终局显示一致性，合理宽接受不授予运行权限。`parseReproductionRecord` 同时包含严格 Tape 结构、游标和18个 verifier，不能称它只是结构 reader；generic schema 没有另一个公开调用口。exact replay 另核真实构建、RNG／规则／声明，重执行请求、CP、事件及操作。它的拒绝是重要保证，但不是 plan§11.2 要求的独立规则推导。

Cupid 已有 Lovers 抑枪的独立规则和手写反例，不是本批新缺口。当前普通 Dream 来源枪、普通徽历史、普通遗言准入存在上述**有界独立覆盖缺口**；没有证据说生产 DR 接受了伪造枪或错误遗言。

## 可实现的完整职责：一个中立 death-history owner

建议三个实际源码路径，等待 Root 批准，不立即开发：

1. 新 `backend/src/verification/reproduction/death-history.ts`：唯一独立普通死亡后果历史审核，输入 `ReproductionRecord`，输出接受或确定的 `reproduction_death_history_invalid`。仅依赖中立契约、事实 reader／冻结政策与 Tape 类型，不调用 World、DR、生产资格／枪／遗言／徽函数或 checkpoint 写方。
2. `backend/src/verification/reproduction/assembly.ts`：保原18步及首错，最后追加一次上述审核；不把新结果反向驱动生产结算。
3. 新 `backend/tests/unit/recording/death-history.test.ts`：独立手写来源／波次／枪／遗言／徽／完整与失败 CP 数据，不从生产算法生成预期，不按角色再加 verifier。

这是一项新严格拒绝政策，不是机械搬迁。Tape schema 2 不变，公开 replay／player reader 不接新审核；旧 malformed strict 档可能在 sourceHash mismatch 之前先被该新审核拒绝，需要 Root 同意这一首错表面。新构建自然产生新 sourceHash，原实验和历史指纹不改。

### 输入与有据的推导

- **来源／波次证据**：按 phase_changed 建立日次和执行阶段；按原顺序关联 `resolution/night_damage_resolved` 的 deaths／完整 death_sources 与 `night_resolved`。结合实际放逐、自爆、决斗、关系／梦及成功枪事实，形成每个可定位死亡 episode 的来源集合、原来源阶段和根／派生波；`additional_deaths` 是名单，不单独发明死因。
- **普通枪后果**：独立冻结政策要求非空来源全部合格，不能用一个 WolfKill 掩盖 Dream／Poison／Lovers。区分原生 Hunter／WolfKing、已记录的学习枪与 ability_id 赠枪；配置的原生政策不能套到赠枪。候选回复、有效 pass／miss／blocked、资源付款、实际枪事实和目标死亡分别处理。不能要求每个死亡 Hunter 都有请求或枪事实；毒／不合格来源的静默耗枪、有效空枪和付后发表失败都是合法状态。
- **遗言准入**：读取 metadata 的真实 lastWords policy，分别独立推导默认首波及具名全波政策。LastWords 的 `death_phase` 是来源字段，request.phase 是执行阶段；该请求通常**没有 death_sources**，应从已有来源 episode 取得证据，不能新增必填要求。枪请求 `death_phase` 与可选 `death_origin_phase` 各有自己的原调用语义，不能拿一条通用 phase 比较覆盖。grant 不能代替 World 许可，也不能把缺少发言当拒绝：null／error／pending 或中断可只有 grant。
- **徽历史**：以初态／选举事实建立徽状态；逐次核原持有者、交接／销毁、已记录 holder-choice 或顺位政策及完整 CP 的最终徽／票重。用户回复不等于领域已提交；有据的事实接收者与最终 CP 不应互相矛盾。保原旧徽销毁→票重复位→接任字段／票重→特殊 frame→发表的全部失败前缀，不能要求失败 CP 每次都有成功事实。
- **CP 与失败**：用有限、具名的可达数据前缀表达普通死亡后果，合并相同前缀；不把一个 proposal／关系事实直接变成已标死。完整周期与失败周期分别约束；已付款／true 通知后晚错误仍可有完整数据或事实。决定 outcome error 可能覆盖已返回 action，必须保 opaque／部分付款接受，不能拿 action 缺席作未付证明。

这是从现有 Tape 推导**死亡后果的独立历史一致性**。`night_damage_resolved` 的来源表是录制证据，不是第二个独立夜伤害 oracle：本 owner 不声称证明所有狼刀／解药／反射／保护是否本来应产生这些初始伤害。若 op 与全部事实被一起伪造，初始夜伤害合法性仍须原具体规则审核或另一个完整夜伤害审计职责负责；不能拿此 owner 冒全部 N12／所有角色规则闭包。

### 特殊 owner 的组合

原18个 verifier仍先独立审核其具体政策、私态、受众与部分付款；新 owner 不重跑／复用它们的生产算法。Cupid／Ghost 关系、Animal 单位、Fragrant pair、Noble→Demon 的现有审计链保持各自权属；例如 Animal 与 Noble 已各自核徽，不能把它们的有限规则硬改为普通固定1.5。

新 owner 消费已经通过其相应 verifier 的中立事实／声明，并给每段证据标清 ordinary、special-owned 或未能定序。它仍核共用事实的确定矛盾，但不在证据不足处猜特殊提交、重算特殊资源、扩大角色支持闭包或静默套默认普通政策。Noble 独立 audit 目前只有 Noble→Demon 真消费者；本提案不为统一接口改18个返回类型，也不新建插件／通用框架。

## 必须保留的不可证明边界

现有 Tape 没有通用 DeathCommitReceipt 的生命原引用／版本、每个普通请求的精确事件 opening/feed cursor、每个同步字段写的提交游标。death_action_id 是录制整数，不能反建权限；CP 的 alive 是数据值，不能充当运行生命身份。事件 timestamp 也不是合法的同步因果屏障。

因此实现前须以保守证据规则判定：只有已录制约束确实矛盾才拒绝；若多个合法写前缀／候选时序都能解释输入，则保留可达集合，不任取一个排序。公共 reader 不强化；缺失原记录字段不猜造。若需求是证明完整生命版本、精确 every-await 或所有未知特殊波次，则现有 schema2 资料不足，应单列新录制契约／版本政策，不能把这个3源方案说成已做到。

## 最小独立验证与审批项

建议新 unit 以四个机制组覆盖通用规则而非只锁四个已观察变体：

- 来源全集／混合来源的普通枪正反表，原生政策与 gift／learned 区分，pass／blocked／miss 和无请求耗枪；
- 默认与具名 LastWords 的首夜／N2、Day／Voting、初始与追加波、grant-only／opaque／late-error；
- 徽初始授予／选举／多次交接／销毁，真实任意票重，以及无事实但部分写入、事实后晚错、完整 CP 矛盾；
- 关系／梦先发表后标死、重复 episode／来源合并／枪追加波和多种可达失败前缀，不伪造缺席生命版本。

原 Q3 原文只作独立已经执行的来源及新审核所需的合法／非法数据样本；不再跑原3场景或 exact replay 求数量。新 owner 和新准入范围产生真实新输入时，由 Root 一次运行其手写单元／有限3根类型和职责头，保存首失败且仅失败修；最后统一同源 C47 仍另行固定。

等待 Root 决定：①批准上述现有 Tape 可证明的死亡后果边界，而非完整夜伤害／生命版本保证；②批准 schema2 新严格拒绝与原18之后的首错位置；③明确特殊 episode 无充分中立时序时保守接受并登记未证范围，不能将这种接受称规则已独立证明。未批准前，生产／测试零修改。
