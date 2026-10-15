# 夜阶段注册表旧出口退出

## 来源与改动

基线实际 `b1b5a860e8556d4bc5d3cdafaf27bdcb0615f19c`。20 份完整 Git 原文为 19 现行 consumer 与 1 旧叶；mode／blob／SHA／bytes、5 个稳定控制均保存在 before。只改18测试的具名 import 与机制聚合口的原 clause，随后删除 `game/mechanisms/stages/night/night_stage_registry.ts`。19 条精确编辑不改变测试标题、输入、断言或角色算法，未批量翻译18头。

唯一 owner 始终是 `rulesets/night-stage-plan.ts`，其类、默认 getter、收集／排序和默认实例全文不变。旧叶只有 `NightStageRegistry` 与 `getDefaultNightStageRegistry` 两值。机制 index 在原位置改成这同两值的具名重导，不把 owner 的额外 `NightStageMetadata`／`NightStagePlan` 类型泄漏到原根 API；game／backend 根两个聚合整文和原导出顺序保持。

## 库存与公开边界

consumers 是本次 Git tracked **现行** 1960 公开 TS／JS 的 all-form AST 采样，包含 Ghost 等并行 WIP；不是1960文件全为固定Git。只有上述20源与5controls明确逐实际Git比对。已解析旧叶19 incoming（18测试及机制barrel），覆盖import、namespace、重导、import type／equals、字面require／dynamic；唯一非字面trace加载只登记不执行，不冒未知动态或仓库外无消费者。

原公开两值仍直达同一物理class／getter；旧 deep module path与中间模块节点有意退休，不留新wrapper。不承诺未知外部深导、任意CJS缓存／反射、stack／文件URL或所有cold图等价。源码身份随删除和模块字节变化；历史strict/sourceHash及归档不豁免、不重写。Q2关键21来源、Demon／Ghost／core／共同框架不写。

## 实际唯一检查

Root `b4bf64 / session 61274 → 737c93 / exit 0`，原stdout／stderr重定向保留。19整程序、19精确clause正逆；39727 typed nodes、7338 NodeArrays、51548非注释叶，38份完整逆输出相同。18测试另核36份真实binding-route映射输出；19 current输出有意因module/import/export改变，不冒两树raw整体相同。18具名绑定均指向唯一owner原声明；barrel两值／原clause位置、其余statement顺序、5controls保持，当前1959公开源旧incoming及旧字符串引用均0。

SourceReady `14f92ef4` 未变；其中no-checks仅首静态捕获时点，真实后继收据见receipts。未运行types、heads、业务、生产加载、模型或架构gate，有限类型留Root后继物理cohort统一执行，不能称已绿。纯路由证明不代替语义同行审查；review／author／handoff不进入作者artifacts以免循环。
