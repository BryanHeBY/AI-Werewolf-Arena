# P4 G03：统一基础死亡收尾

本子批统一基础夜间、放逐、默认放逐前自爆和猎人追加死亡的写入/收尾，沿用[基础规则卡](../rules/awa-classic-v1.md)与[死亡窗口授权](death-action-authority.md)。接续实现已完成[四个公开窗口](self-destruct-windows.md)、[警长/白痴资格](public-participation.md)与[G04结果](victory-record-display.md)，原子批边界不代表当前仍待修。

## 顺序与状态负责人

PhaseManager 持有唯一 DeathResolution；它控制阶段推进与最终胜负判断。DeathResolution 的流程为：

1. 去重当前生命的死亡名单，整波先写 Alive=false。
2. 初批按明确来源/日次申请遗言并收集；普通自爆与追加死亡不申请。
3. 处理这一波所有死亡警徽。
4. 按名单顺序逐演员分发角色死亡钩子，窗口覆盖实际技能消费。
5. 每个角色hook返回追加死亡事实后，分发器同步调用DeathResolution提供的commitAdditionalDeaths，立即标记追加目标死亡，然后才运行后面的hook/初批演员。成功的前缀提案不会因后面hook抛错整包丢失。追加目标不能再被后来的枪当成存活目标。
6. 全部追加目标作为下一波处理警徽/死亡钩子。追加波次没有基础遗言。
7. 波次清空后返回 PhaseManager，由它判胜。

Hunter Hook仍负责本技能资格、弹药和事件提案；生产owner实际mark后发布枪击，但只返回带Shot来源及原生命范围的追加死亡提案，不直接修改目标 Alive；普通 onVotedOut 也只返回待死亡名单，自爆窗口只选定演员/公开中断事实。三条路径的实际死亡写入统一到 DeathResolution。白痴翻牌免死属于存活技能分支，没有送进死亡流程。

同一 DeathResolution 在markPlayersDead时登记生命，不等待所有钩子成功。失败是录制/收尾终止路径，保留已完成动作与追加死亡及原错；不支持失败后在同实例简单resolve重试，也不因此引入恢复框架。正常路径下，同一 DeathResolution 保存已处理的Alive组件引用和生命版本；相同生命的重复resolve/追加名单不再发遗言或调用死亡钩子，复活或组件替换则为新生命。初批去重保留输入顺序，追加波次保留首次产生顺序；角色钩子按单个演员分发，定制hook应按这个输入处理。循环、自身重复、已处理生命及不存在目标不重复执行。多个hook对同一目标的来源合并去重并复制，不覆盖毒等原因。

## 遗言与自爆

LastWordsMechanism 现在显式接收DeathSources。基础遗言只授予首夜初批狼刀/毒死，或Voting初批放逐；空/未知原因、枪击、自爆以及含自爆的复合来源不靠phase猜测成遗言。纯phase调用者需要迁移来源输入。

默认放逐前自爆经过同一死亡收尾：死亡、警徽、死亡钩子与完整追加波次完成后才判胜；继续游戏时切到day+1/Night。多个同时选择仍仅采纳最小稳定玩家ID，其他玩家不被错误杀死。最终一狼自爆也先处理警徽再封盘，死亡警长不残留。

初始死亡链子批未单独放开扩展窗口；接续[四窗口](self-destruct-windows.md)已同时交付OnDaybreak/OnPreElection/OnPerSpeechGap及对应首日待死亡收尾，保留首日警长先于夜间信息的兼容流程。

## API、事件与验证

调用 onVotedOut 或 SelfDestructWindow 不再等于Alive已改变；引擎由PhaseManager统一把结果交给DeathResolution。EventRegistry/HookRegistry.onDeath新增可选commitAdditionalDeaths用于逐hook提交成功提案，生产resolver始终提供；手工钩子消费者应应用返回提案，不能依据公共枪事件假定低层hook已经杀死目标。DeathResolution是逐局唯一实例，重复创建实例绕过已处理生命账本不属于正常入口。

事件类型/payload字段与公开复盘v2未变。放逐警徽仍使用voted_out reason，自爆为self_destruct，其他波次使用实际deathPhase的_death标签；顺序按新规范记录，旧事件原顺序保留。内部Tape继续严格source/lock/rules门槛，新增行为没有假装与旧源码兼容。

[人工完整判例](../../backend/tests/engine/rules/death_chain.test.ts)核对双猎人整波死、先遗言后警徽和枪、先前枪目标不能被二次枪击、实际放逐连环警徽再胜利、两轮真实自爆自然终局/入夜/票权和无遗言、相同生命重入/复活、循环/坏目标及复合来源隔离，实际Hunter后置hook失败仍保留目标死亡/原错/窗口0。既有中英SDK/ACP/混合完整对局和逐局严格Tape作为完整传输门槛；不以只跑低层hook替代完整验收。

P7枪目标按每次request的原life/version绑定，新的合法重试可绑定新life。生产pendingShots在实际owner提交点复验后发publichit，失效Shot不抹其它独立合法死亡原因；非枪实际追加死亡有匿名additional_deaths同步。低层legacy选择仍快照目标，细则见[原生命枪基础](reviews/p7-death-shot-life.md)。
