# 退休零消费者的板子兼容叶

## 责任与实际来源

实际前态为 `a8bf71ec6fc26605b2897088bdcf5c2d44ad2868`。唯一删除 `backend/src/game/mechanisms/roles/board_presets.ts`；完整旧文保存在 before。原叶只重导 `boardPresetViolation`，不拥有判定。生产唯一函数仍在 `rulesets/board-support.ts`，由 `rulesets/index.ts` 公开；不新增替代包装、算法、状态或权限。

三个实际运行消费者保持原文：`runtime/config/board_definition.ts` 从规则集入口读取，`rulesets/board-parameters.ts` 和 `rulesets/supported-role-deck.ts` 直达原 owner。配置规范化后判定、纯数据校验与 schema 的失败优先级、bootstrap 先板子拒绝后牌组构造等原逻辑未改。后端 root／game／mechanisms barrel 也未改，不删除合理 core 概念出口。

## 有界引用证明

先完整阅读旧叶、owner、三个消费者和后端入口，并核当前路径文字检索；旧审计只是先前静态来源，不能把其 1,957 个源码和引用计数冒充本批重新执行结果。准备的 proof 由 Root 首次运行：读取固定 Git 与实际当前公开 JS／TS（含测试与 fixture 源），核 import、重导、namespace import、import-type、import-equals、字面 dynamic import／require。虚拟解析仍保留已删叶，使旧引用不会因缺文件而漏掉；另核 root 重导可达集合、三个实际消费者及绑定来源。

原非 generated 文档中该路径仅在 `architecture-baseline.md` 的冻结债表；不改历史表为当前运行指南。并行纯注释源在扫描时按实际字节记录，不作为全字节固定控制。九个稳定 owner／consumer／barrel／package 控制均从本批实际 Git 保存完整原文。

## 兼容与验收边界

这是有意退休旧深路径 API；未知外部深导入、非字面动态路径和任意反射不在支持保证中，不能仅凭仓内零字面引用宣称不存在。删除源码参与下一构建 sourceHash，不改指纹算法、历史档案身份或 strict 政策。

Root 唯一首执行 `8ef1f0`／session `31938` 至 `ee1472` 实际退出 0：固定 Git 1,960 源、实际当前 1,959 源，退休叶前后 incoming 均 0，root 重导可达 123 模块，九控制、三运行消费者及唯一历史文档均核真。import-equals 本次无实际站点，不声称执行其运行行为。原始 script/report/stdout 保持；没有重跑。

source-ready `e855da5783ee1294ca6d174c694c59d15244a66f642f4a36fce9091cf2dabc1a` 不变。作者未执行检查；Root 只运行上述纯 AST／引用来源核验，未加载生产、执行类型、业务、职责头或整套门禁。最终 C47 在另一个完整固定输入验收，不能由本批代替。首准备元数据以完整原文保存在 snapshot。
