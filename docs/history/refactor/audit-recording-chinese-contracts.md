# 审计与录制聚合中文契约

## 范围

真实基线 `ce0353ce7bc9fa3ab9be9b34df3266848f5d6c05`，五源和两个实际 caller controls 在写前均与 Git 全字节相同。本批只改 `audit/debug_summary_generator.ts`、`deterministic_checks.ts`、`fallback_summary_renderer.ts`、`recording/replay_document.ts`、`session_aggregate.ts` 的 48 条说明。语句、字段、签名、导出、机器名、消息 key、用户／模型原文、保护指令和类型 tags 不变。

## 实际职责说明

- 摘要只在报告和目录／数组条件满足时尝试可选 AI pipeline；空数组仍满足存在性门槛。只采用真值 Markdown，已捕获 AI 失败先告警后回退；告警格式化、日志和回退自身不受该 catch 保护，不承诺所有失败可回退或汇总。
- 确定性检测是历史标签、关键词和局部模式下的候选，不读当前 World 或隐藏库存、不重判对局。硬信号优先于策略噪声；非空 evidence 是原门槛，不等于已验证事件。相邻 phase 变更和当天夜报存在性不验证夜报先于发言。拒绝标记两类分别累加，同一 turn 可计两次。
- 原报告、自动事件疑点与玩家元数据疑点按原次序组合，只有待办复制后按严重度排序，不跨来源去重或改严重度。播放器／诊断文字仍由原 i18n 和展示函数渲染，不修改产品文本。
- 公共事件 seq、逻辑操作 seq、每个玩家的混合 timeline seq、仅 turn 的 turn_seq 是不同序列；玩家 evidence 不在这些检查中映射为公共序号。公开／逻辑 seq 先递增，后续时间转换等未捕获失败可以保留已消耗序号；此聚合不补号或退款。
- JSON stringify／parse 会沿原规则执行 getter/toJSON 和转换值；失败 sentinel 是普通数据，既不是 schema 成功也不是许可或错误身份品牌，不回滚已发生副作用。其余时间转换、断言、structuredClone 等失败原样传播。
- 玩家首建 view 捕获当时 role/camp；后续沿同一历史，不跟随现场角色阵营重写旧元数据。初始提示、显式 delta 与默认派生轨迹的优先级保原，文本按原字段上限截取。规范化只新建外层包装，timeline 及部分字段保引用，canonical2 断言不深复制／冻结历史。
- 离线 God 文档先核 seq 与位置一致、player_id 无重复，再组装和完整断言。events 保原数组，player 行新建，decision structuredClone；不排序、丢事件、猜缺项或写盘。文件发布、严格身份、生命周期与必需失败账本仍由原管理器／codec 持有。

两个完整 controls 是 `recording/session_recorder.ts` 和 `runtime/game_runner.ts`：它们实际消费聚合／离线文档与调试摘要，证明必需终档与可选诊断仍沿原调用链。旁读了 `audit/contracts.ts`、`pipeline.ts`、`summary_format.ts` 与公共 replay assert；这些旁读不是额外 immutable 闭包。F02 作者确认其六 controls 和八生产源均无此五源，不混入其后继工作树。

## 唯一有限检查

- `ec99ba / exit 0`：五个完整程序精确 comment forward，同 5420 typed nodes、6495 非注释语法叶，JSDoc tags／保护说明均为 0；ES2022 ESNext／CommonJS 共十份完整移除注释输出逐字相同。脚本完整遍历 NodeArray、叶文本，不仅比较空 JS 或头部。
- `eaaeb1 / exit 0`：五源职责头，当次 Git 索引文档路径名 668，诊断／中文头缺失 0。检查不证明说明真实性，交非作者完整读源审。
- `b649b0 / exit 0`：五路径 diff check。

首执行脚本及原 `proof.json` 的 `limits[0]` 留有模板旧标签“六个完整 ACP／任务端口模块”，这是范围措辞误名；实际 `programs`／`source` 为上列五个审计／记录路径，完整程序计数与十份输出均按这五路径产生。原执行脚本、报告、日志、头检查和收据保原字节，不重新执行或改写历史报告。

均为首轮，采样后五源码未变。全部 Bun 使用 `--no-env-file`；没有加载生产、测试、类型、模型、网络、私有配置或全门禁，绿色项未重复。源码 SHA 确实改变并参与当前源码构建指纹，历史 strict 身份和校验政策不改写、不加豁免。此批只维护说明，不将已明确的候选／旧接受面改为新 schema，也不宣称整个记录、AI 权限或玩法目标完成。
