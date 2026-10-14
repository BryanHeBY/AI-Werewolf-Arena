# 组件槽与行动网关中文契约

实际前态为 `9df9dd0344f99db150996632d793f2c4c6485a11`。范围仅 component-map、model、DebatePenalty、WinConditionSystem、core index 和 ToolGateway 六个现有源；完整 Git 原文和 World／ActionValidator／DebaterAuthority／ConditionRegistry 四个实际控制已保存。首21条精确注释编辑与后继3条头说明修正均不改变声明、类型、导入导出、运行语句、机器字符串或 schema。

## 职责与顺序

Role 与 Camp 是两个独立具名槽，原“Role 包含 Camp”说明已纠正。ComponentMap 仍关联十一种原组件；ComponentWrite 的其它公开字段排除、optional never 和 never 分支仅约束编译期，允许原自定义扩展，不增加运行 shape 校验、存储镜像或权限。model 与 core index 保各原公共出口、实际消费者及加载关系，不承诺其叶模块都无顶层初始化。

DebatePenalty 的公开日次、来源和生命版本只描述数据；原处罚 record 与原生命引用由辩论 authority 保存和复验，缺省 day 接受面不在接口处统一到期。WinConditionSystem 保旧两参数委托和原评估器 receiver，结果与异常直接返回，不加检查点或封盘写权。

ToolGateway 先清洗后调用原 validator；JSON Schema 由 ActionReception 持有。两种发言产生外层及 args 的浅副本，其它调用仍用原对象。文字清洗只删开头的原保留前缀并 trim，不删内嵌文字或认证身份；字段 getter、spread、清洗和校验可抛错。狼聊 end_chat 在原两个 spread 与 text 后才读取并取 Boolean truthiness，未加强为严格布尔。预检不等于付款、请求完成或领域提交。

## 真实有限验证

首冻结 source-ready `a2b040d7…` 在检查前捕获，checksRun:false保当时事实。唯一六完整程序证明 `719d05` 实际退出0：21条全文精确正逆，515 typed节点／74 NodeArray／638非注释叶；JSDoc tags和保护指令保持（实际均0），十二份 ESNext／CJS 整输出逐字相同，四控制字节保持。

首次六职责头 `d6c347` 实际退出1，两条诊断为 model 缺输入、DebatePenalty 缺输出；四根首次通过。只补其真实输入／接口输出，并按Root语义审查说明core出口的领域调用方；这三源首检查前文与原reports/ready均保存。末三源comment桥 `7080e3` 实际退出0：3条精确注释、32 typed节点／5 NodeArray／55叶与六份整输出同。仅两个真实失败根 `a05b0b` 复头退出0，712个当前Git文档路径；其余四个绿色头和首完整证明不重复。core头语义增量仅由窄桥承接，不冒最终六头重新执行。

注释编辑器首次 `31c171` 因旧WinConditionSystem缩进锚匹配错误停止该替换；此前十处注释已落四源，完整partial阶段保存在preparation-history。原实际Git before不变，十条原替换按原文重建并逐源对照partial后才继续，`9c6ba5` 完成其余注释。准备器匹配错误不是产品、类型、证明或行为红；原错误和输入锚保留。

本批仅执行上述注释程序证明与职责头形状；没有类型、业务、模型、全门禁或进度更改。源码摘要真实改变，不重写历史档案或来源算法、不增豁免；不宣称完整机制、全部中文或P9完成。作者资料不含同行／Root报告，以免digest循环。六源码与正式资料冻结交独立审查，Git与进度仅Root持有。
