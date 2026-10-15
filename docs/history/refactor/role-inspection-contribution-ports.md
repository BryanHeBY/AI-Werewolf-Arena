# 身份查验装配贡献公开边界

## 职责与范围

此 R01 切片以真实 `751604fd1d5feea8911354fee550b9ad49c262b7` 的十六消费者为输入，修改七个生产入口、九个既有测试的导入，新增两个具名公开 facet，共十八源路径。没有移动或改写查验算法、实例状态、夜阶段执行或 reader 端口。

- `role_inspection/contribution-ports.ts` 公开原配置工厂、工具、目标／校验函数及三项阶段绑定。觉醒隐狼、石像鬼、魔镜少女、通灵师 profile 与真实夜阶段计划从这里装配，仍使用同一原函数／对象。
- `role_inspection/policy-ports.ts` 只公开原政策文案查询，供配置文案注册与玩家提示指令使用，避免这两条显示路径加载规则／夜阶段装配。
- 既有 `ports.ts` 仍只承担原读取／状态接口。配置、规则、阶段、状态槽及夜 scope 六个原 owner 全字节保持；同族内部依赖仍直达原 owner，不声明原文件或其全部公开 API 已退休。

公开贡献不是库存、角色资格、来源证明或请求许可。目标、重复／必选政策、来源、租约和历史写入仍由原 owner 在原查询点处理；三阶段的优先级、provider 等待、付款及失败前缀均未改写。

四个 profile 的原配置创建、spread、工具与校验表、初始化、mock、文案与回调 receiver 保留。三个原 unused `renderInspectionPolicy` 导入删除，仅是原未消费 binding 的实际擦除，不删除角色文案或改变渲染算法。九个原测试只迁导入，输入、标题、动作、断言与 oracle 不改。

## 验证与中文说明

实际完整十六消费者的精确逆恢复原字节，完整 typed 树共 33,779 节点；实际非 import 全程序相同。只把新模块路径映射回原 owner 后，三项 unused renderer 不补回，三十二份完整 ESNext／CommonJS 输出仍相同。实际运行输出的模块路径发生变化，不声称未经路径映射的 raw 输出相同。

原四十一 named bindings 中三项是上述真实 unused renderer；其余三十八个逐一保名称、alias、type-only 标记及原物理声明端点。五个当前源码根的字面 import/export、inline import type、dynamic import／require、import-equals 盘点中，跨族私有 `rules/policies/night_stages` 引用为零；不包含其它根、计算模块名或历史快照。

- 十八根有限类型检查首次实际终态 `fccfcb` 为 0。
- 原 Catalog 的 `shared catalog distinguishes planned definitions from registered roles` 精准用例一次：1 通过、0 失败、14 断言，另 2 项过滤，终态 `96fdd1` 为 0。没有重跑九个原测试整组或新增镜像测试。
- 十八源／551 个真实 Git 文档路径的原职责注释检查 `e5e1fb` 为 0，中文头存在检查也为 0。新 facet 中文头解释引用绑定、实际装配时点、资格与写权的区别；profile 重要装配点补中文说明，配置文案 owner 原英文头译为其实际职责，夜计划头使用正式名称“鬼魂新娘”。
- 四个真实 profile 各进行 before／after 一次独立冷导入，均实际退出 0。这是四个模块端点的前后探测，不是八个不同玩法用例。

## 静态装载与限制

同一次当前传递源码采样下，旧十六消费者覆盖为保存的真实 Git 原字节构成 baseline overlay；新图只多两个公开 facet，四 profile 的实际业务 owner 可达集合保持，模块数 415 → 417。纯文案 facet 的静态值依赖闭包为 69 模块，不含查验 rules、night stages 或角色 profile。

该图与前后冷导入共用当时的其它当前传递依赖，包含并行 Time 状态槽后继，不能称完整固定 751 Git 闭包或任意冷入口等价。静态图只读取编译后顶层值 import/export，不枚举延迟 require 或计算模块名；新的聚合入口也可能改变实际模块求值路线。新 facade 的 CommonJS named re-export 属性描述与原 namespace 的任意重赋能力不作等价承诺，原函数／对象的引用与实际消费表达式保持。

本切片没有新增 schema、默认政策、资格、RNG、await、资源写、close、全局门禁、模型调用或 golden 更新；不代表 R01、身份查验完整玩法矩阵或 P9 完成。其它并行源不在十八源冻结表内。

## 证据

机器记录见 [交付证据](generated/role-inspection-contribution-ports-evidence.json)、[冻结范围](generated/role-inspection-contribution-ports-scope-final.json)、[完整程序对照](generated/role-inspection-contribution-ports-proof.json)、[绑定与静态采样](generated/role-inspection-contribution-ports-bindings.json)、[实际执行收据](generated/role-inspection-contribution-ports-receipts.json)。原始源码、精确修改、实际执行脚本和输出均保留；证据摘要不包含随后写入的独立审查，避免互相哈希引用。
