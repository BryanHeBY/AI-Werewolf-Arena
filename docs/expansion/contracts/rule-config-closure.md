# 规则与配置闭环契约

本批基线为 `eb4f026`，规则集 `awa_classic/1.0.0`。目标是收口现有行为与工程门禁，并按用户后续授权实现有明确来源的有限具名变体；默认行为兼容。当前23项 verified、41项 planned；P8–P10不因本批维护而标完成。

## 已确认的当前默认

- 板子仅使用公开 v2 schema；角色参数经 profile schema/apply 进入 BoardConfig。女巫自救默认 disabled，骑士窗口默认 after_speeches；守卫 repeatPolicy 默认 awa_last_action_v1，隐狼 campInspection 默认 awa_inheritance_v1。预言家兼容默认统一为awa_required_when_legal_v1（基线NightPipeline默认requiresAction=true），显式awa_optional_v1可跳过；复核修正了profile.defaults与schema的分歧。其他现有贡献按schema/default/apply/serialize核对。
- 放逐/狼刀平票默认 min_id；警长默认票权1.5、平票 min_seat。自爆窗口和 hooks 必须一致。
- 同守同救抵消；普通守救不挡毒；猎人/狼王死亡枪要求全部复合死因通过白名单，Poison另有否决。
- 机械狼学习创建新资源模板、次夜生效、首刀夜额外刀有过期限制；两商人授赠/反噬时机保持原规则。
- 完整死亡链后判胜；winConditions 按配置顺序；胜利归属独立于角色、真实阵营与技能。

证据：`runtime/config/board_definition.ts`、`core/domain/board.ts`、`roles/witch/`、`roles/knight/`、`damage_resolution_system.ts`、`core/domain/deaths.ts`、`roles/mechanical_wolf/state.ts`、`phase_manager.ts`（路径相对backend/src，伤害系统位于core/domain/systems）。

## 必须闭环

一个现有参数须在公开解析、默认归一化、角色初始化/运行消费、反向转换、规则提示、reproduction strict schema及版本身份中有同一语义。显式值与省略默认应产生相同有效行为；保存后重新解析不能丢字段。保持角色数量与组合白名单检查，不增加 allowUnsupported。

正常CLI的默认configs位置以项目根目录为基准，不随从根目录/backend目录启动而改变；显式参数和环境路径保留可解释的相对路径语义。不得覆盖本地忽略配置或读取认证值写入报告。

源码改变会改变Tape source fingerprint；旧Tape只能由对应旧版本严格复现，不能篡改指纹或放宽兼容验证。旧公开回放继续经兼容reader读取。

## 已实现的有限变体与待实施边界

守卫增加 netease_consecutive_nights_v1，使用实际相邻夜判断；无动作/非法动作不清历史，但打断相邻夜。默认 awa_last_action_v1 保留上次合法目标直到换目标或明确空守。隐狼增加 netease_2020_good_v1，仅使阵营查验接刀前后始终为好人；具体角色查验、熊感知、真实阵营和刀权仍独立保持AWA语义。这两项不是完整网易玩法预设，来源及工程推断见 [规则证据](rule-evidence.md)。

女巫披露与三种自救已配置；原生双药按明确非主流AWA实验实现。竞选/放逐PK和死亡持徽者选择已经连通实际流程及严格Tape。原生猎人/狼王deathActionPolicy与三类inspectionPolicy已按[有限契约](role-policy-configuration.md)贯通；[公开翻牌/遗言](public-death-policies.md)具名条款已实施。0954991新源码208文件2363项全量、223前端及82浏览器通过；保护/公共信息、夜序/同时灭绝、复制库存、商人反噬、梦/魅惑按[问题名矩阵](original-review-closure.md)逐项记录实现或具体保留理由，不能全部归入P8–P10，也不冒称未新增变体已完成。采用有限具名policy及兼容默认，不开放任意优先级或布尔组合。

当前在上述基线上进一步补[摄梦/狼美人历史策略](historical-night-role-policies.md)，AWA默认保持；其余八类[具体当前行为](current-rule-behavior.md)为验收依据。

## 本批实施清单

1. 先复核并修CLI默认目录、摄梦请求前撤权、机械英文、前端完整typecheck和后端测试typecheck。
2. 统一回放事件reader、玩家关联提取与展示类型；黑市受赠中性标签、阶段映射及完备断言。
3. 收口异步scope/玩家DTO/工具描述；只删除确认无消费者且核对公开API的旧路径。保留活动迁移parser。
4. 引入项目级formatter/EditorConfig/前端lint；格式独立提交，保留原导入边界门禁。
5. 补现有witch/knight等参数的往返、提示、录制与版本回归；按后续授权闭环守卫/隐狼高置信具名策略。

每批实现与针对性回归一起提交；离线类型、单测、lint、格式、构建及假provider/浏览器验证按变更范围执行。禁止收费模型、真实对局、GitHub认证和网络推送。ObservedBot/provider测试拆分为不阻挡核心的低优先级维护。
