# P9b 猎魔人单一 FaultPlan 实际引擎边界

接a8666cb。仅既定`awa_fault_plan_v1`、`before_night_source_freeze`、提交后原actor/target的`replace_alive_component`操作。开局独立输入冻结，不从取消fact反推计划，不增加操作、脚本、字段路径或公开board参数。

实际NightPipeline完成原choice及原生库存提交后，PM以真实committed choice进入边界；真实World创建替换Alive，独立God `fault_applied` op记录版本/完整step，随后引擎自行复验并生成一次具名取消，hunt伤害为零。原accepted op/history及Witch真实消费保留。空选择/错边界/未消费终局拒绝，替换后成功CP及后续Night仍拒绝，失败CP读取原roster/原生命及合法库存前缀。

只读复核发现已关闭SessionRecordManager的普通recordLogicOp静默返回，会使mandatory故障事实漏录；已增加recordRequiredLogicOp，closing/closed同步抛错锁存计划失败，真实替换与历史仍保留，不发布成功来源冻结。新增实际closing/closed回归并由原审查者复验关闭；其余链路/规则组本批无P1/P2。

14项新增实际engine/录制回归，连同既有FaultPlan数据边界定向48 pass/203断言/2文件，`/tmp/awa-p9-demon-fault-focused3.log`。后端source+tests type4/lintdeps2/boundaries2/i18n2/build2通过。受影响engine/recording/AI agents/integrations/runtime Recorder回归2386 pass/22774断言/132文件，`/tmp/awa-p9-demon-fault-regression2.log`，0失败。早期测试误用privateState.witch和不存在的demon_hunt op名，已按原native:potion与validate_tool_call实际结构修正；补齐RoleComponent类型导入。

本批只证明实际故障执行与失败审计，尚未声称fault-plan strict Tape完成。剩余必要依赖是独立metadata持久化/Replay同输入、严格Demon因果审计、四板公开登记与正常/失败/迟到三transport、200Observed逐Tape/1000World及完整前后端门禁。目录仍23verified/8implemented/33planned，继续角色闭环，整体待用户验收。
