# P9d：迷雾鸦影实际阶段与玩家事实切片

状态：核心候选；两个角色仍为 planned，正式计数仍为 44/64。前置为 `47822a8` 的原生状态、原生命与唯一夜间 owner 基础。本次接入实际 bootstrap、NightPipeline、PhaseManager、共享提示和事件读取；完整独立 Tape、真实 SDK/ACP/MCP、受限多种子及浏览器验收继续完成，不能用本切片代替规则卡最后两项。

## 实现范围

公开候选板 `configs.example/boards/awa_mist_raven_12_v1.json` 只允许规则卡的精确原生十二人预设。配置解析、bootstrap、两个默认 profile 与工具使用同一有限策略；其它组合仍拒绝。Mist、Snake、鸦额外刀各有独立一次资源，明确弃用不消费。

实际夜序为雾 → 摄梦 → 狼聊／刀票 → 解封鸦额外刀 → 预言家。解封在真实夜初按实际活狼数 `<3` 判定；封印期间没有狼聊和普通刀请求。知识快照保留解封时活队友，其后死亡不删，不补先前死狼。

PhaseManager 独占待定夜；夜末冻结直接来源，延迟分支只在 Snake 后展开一次梦牵连，不再次消费 marks。正常发言尾部和白天自爆都在第一次 await 前 claim。自爆实际死亡及警徽先完成，再救治、公布最终夜死、判胜；pre-vote 不重开。失败保留已发生的死亡、警徽和已消费资源，不自动补药。

`wolf_kill_candidates` 单独表达合法刀口，避免复用女巫 `wolf_targets` 的实际多刀语义，也避免进入 Scholar 专属账本。SDK、ACP 与受限策略共享自己的独立 DTO、双语库存／历史提示和公开条件时序。公开文案只描述每夜的条件，不读私有库存披露当前分支。

七类事实使用共享严格 reader；六类仅给本人，抽签使用历史狼队受众。玩家 feed 捕获受众后，只使用同一份 detached fact 做授权及输出，避免验证之后重新复制可变源对象。私有事实不进入公开终端，前端阶段／文案均双语，全部事实没有直接死亡 effect；只有已公布死亡驱动存活状态，seek 回退可恢复。

## 交叉审查与主任务修正

三个只读代理分别进行 R、A 与 T/L/D 审查，主任务编辑；原审查者复验：

- R：失效的非弃刀目标不能降级为“全员弃刀”抽签。固定原持刀者 scope，失效原目标或撤权投刀者严格失败；非空全集皆明确弃刀才随机。原实际 PM 三个反例／正例通过。
- A：原生命替换／死复活、pipeline 出口换身、cycle/jump 重入、Snake/警徽 await 异常、资源不退款、恢复普通公布和末狼自爆延后判胜。独立真实 PM 15 项、108 断言通过：`/tmp/awa-mist-runtime-authority-review.test.ts`、`/tmp/awa-mist-runtime-authority-review-green.log`。其一次 N2 遗言假设错误已保留原日志并改为实际 badge await；不是产品故障。
- T/L/D：狼聊缺雾圈候选、提示把候选误说成女巫实际刀口、SDK/ACP 文本缺资源、公开时序、七个阶段名、渲染多余参数、后夜自救事实、校验后再次复制 payload 的 Proxy canary 均修复。原反例复验通过；不把 stdin 的帧／终端检查叫浏览器验收。
- R 对七类双语渲染、受众、非法事实和不提前死亡的最终独立复验 124 断言通过。T 另外验证读取时篡改 actor/audience 不会新增授权，非法受众关闭。

主任务把实际 PM 反例整理进维护测试，保留明确领域错误预期；必答约束验证不依赖一个不存在的 `request.requiresAction` 字段。固定种子 `mist-raven-real-runtime` 的全弃刀案例使用独立手算预期：`[seed,"night","day:1:mist-knife"]` 的 draw 为 `0.5371968341059983`，雾圈 `[10,11,12]` 固定命中 11，不从生产选择函数读取预期。

## 验证与剩余边界

最终同一代码／测试定义验收：后端 engine/config 全集 **2961 pass / 0 fail / 28091 断言 / 157 文件**（`/tmp/awa-mist-runtime-engine-final.log`）；完整前端 **528 pass / 0 fail / 5211 断言 / 64 文件**（`/tmp/awa-mist-runtime-front-accepted.log`）。root check（含两端及后端测试类型）、lint、format:check、两端 build、git diff --check 全部 exit 0；各门禁日志为 `/tmp/awa-mist-runtime-{check-final,lint-accepted,format-check,build-back,build-front}.log`。未调用真实模型，也未称本切片完成整个 P9d。初次 engine/config 全集 2959 pass / 2 fail / 157 文件，失败均为原 public_rule_contract 的二选一时序预期不包含新条件板；修订该板的独立条件文案预期后再验收，不称初次全绿。日志 `/tmp/awa-mist-runtime-engine-accepted.log` 保留。初次 frontend fact 矩阵 16 pass / 11 fail 是测试误写 Unknown event（实际既有 Unknown），修正测试词句后 29 pass；加入公告／回退后共 30 项。类型门禁发现并修正测试 callback 中的 null 流分析、只读候选传 pick 与不存在字段，不以 Bun 能运行代替类型门禁。

剩余：完整独立资源／伤害／RNG／时序账本及增量、协同篡改与失败前缀；真实三类通信、中英完整及失败对局；每类策略的 20–50 固定种子；真实记录前端 fixture 和 Chromium 验收。已读审查另发现既有角色 feed 同形重复读取 canary，安排独立后续修复，不声称当前全仓零剩余问题。
