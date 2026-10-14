# 玩家 AI 中文契约说明

## 范围

真实写前 Git 为 `7c8456949e3370a0d8585d40826763aff1b30f3a`。六个 `ai/agents/player` 源码与两个实际 caller 在捕获时均与该 Git 全字节相同：`action-turn.ts`、`contracts.ts`、`player_observer.ts`、`player_prompt_policy.ts`、`prompt_templates.ts`、`turn_constraints.ts`。本批维护 32 条注释，不改语句、类型、函数、导出、签名、机器／模型／i18n 文案、保护指令或类型 tags。

## 实际边界

- 行动窗口保存原请求与已选候选引用，访问 `action` 才逐次克隆。授权先读 locale，再检查 closed／selected／原截止条件、严格失败上限和 turnId；没有新增计时器或期限校验。预检返回拒绝才按原分支计数，直接抛错不被这里吞掉。成功候选先保存，再读回包名称，后续 getter／序列化失败保留选择前缀。`accepted:true / applied:false` 不是领域付款回执，`close()` 只设置本窗口关闭，不取消模型、清会话或补提交。
- 共用结构描述提示消息、可见事件游标、传输历史窗口与轮次诊断。消息数组可写，声明不克隆／冻结；SDK 历史切片和 ACP 零值窗口是各自实现。turnId、attempt、工具接受与 finalAction 都不授予现场许可。回退 `used` 为真仍可没有动作，不能据其认定付款或生效。
- 日志观察先记入并裁剪最近 80 条原 trace，再按选项输出；装饰／console 失败不撤销缓冲前缀。原提示、回应与思考工具轨迹按原顺序显示，可见范围由上游负责。只有诊断摘要截断，不把模型文字解释成工具或资源结果。
- 提示策略保存装配／registry 原引用和构造时公开配比，不以配比推断当前存活、觉醒或库存。人设回调收到原 request／role。role、板子展示、可选配置、模板参数及目标提示保持原求值次序；后续回调错误不回滚已发生副作用。工具与目标文案是知识，提交仍经实际 Gateway／机制复验。
- `retry_notice !== undefined` 保持空串优先，之后 `filter(Boolean)` 去空也不回退消息引用。约束 `summary !== undefined` 同样优先，空串不从 MessageRef 补文案；用户 hint 的基础文本先形成，格式化失败原样抛出。
- 模板保持人格两次 trim、Role 枚举顺序、Map 与回调的晚读取。角色列表只固定本次正配比筛选，不保证后续 Map／展示回调是统一快照。缺失或空 effective tools 显示原 none，不自行复制 allowed tools。重试文字与工具说明不执行预算、注册、schema 或行动。

完整 caller controls 为 `ai/agents/llm/llm_turn_orchestrator.ts` 与 `ai/agents/acp/acp_action_provider.ts`，仍由原编排器／传输持有超时、请求别名、调度租约、回退、会话清理和记录时点。旁读实际 ActionReception、SDK 工具循环与 ACP registry，以核实候选／提交区别；这些旁读不宣称整个传递模块图冻结。

## 唯一有限检查

- `f69680 / exit 0`：六个完整程序精确 comment forward，3853 typed nodes、4574 非注释语法叶（叶 kind 与文本逐项比较）、NodeArray 长度／尾逗号、JSDoc tags 与保护注释均保持；ES2022 ESNext／CommonJS 共 12 份完整移除注释输出逐字相同。不是只比较空 JS、头部或局部摘录。
- `1d4535 / exit 0`：六源中文职责头、当次 Git 索引 673 个文档路径，原诊断与中文头缺失均 0。头形状检查不替代非作者语义审查。
- `377bd2 / exit 0`：六路径 diff check。

均首轮成功，采样后六源不再修改。所有 Bun 启动含 `--no-env-file`；没有加载生产、运行 tests／types／模型／网络／私有配置／全门禁，也没有重复绿色项。实际工具返回终态为关闭依据，日志只保存输出。源码 SHA 改变并参与新构建来源指纹；历史 strict 身份与校验政策不改写、不增豁免。本批不修 F02／F03／F04／Camp 或宣称整个 AI、记录与玩法目标完成。
