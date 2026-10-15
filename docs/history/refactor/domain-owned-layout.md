# 领域所有者的物理目录迁移

## 范围与来源

实际基线 `6cb97e6acc52f35bc094fb67e9badb681230ec6a`。将42个 `core/domain` 模块移至 `domain`，各文件与目录按 kebab 命名，删除只有单条重导的 `core/index.ts`。当前调用方直接引用唯一领域所有者，不保留两层中转。协议ID、枚举值、角色slug、错误码与公开具名绑定不改。

1148份完整原Git源码、6控制的真实blob/mode/完整字节均固定。1144个路由程序有2836条精确模块编辑；最终1147现行源、43删除，新增物理路径不是新增领域实现。首ready `9d53c8af` 保留，最终只接一份独立审查后的inventory说明小桥，其余1146现行源不变。旧空目录是工作树残留，Git中没有旧源；不凭目录对象本身存在报告双实现。

## 公开 API 与状态归属

根barrel仍保原clause顺序，领域原barrel在新位置保原声明及顺序。42模块的领域正文保留，原WeakMap、默认实例与类不复制。实际探针核根／领域／直达World同引用，根bootstrap装配的World是该类实例；跨根与直达request-delivery登记守卫、拒绝、传播别名、一次结算共享原弱表。这里只验证装配和交付元数据，不推进对局或代替全部运行路径测试。

旧deep路径、模块中间节点、文件URL和源码身份有意退休，不承诺仓库外未知动态加载、CJS缓存反射或stack路径原样。路径和注释会改变精确身份，禁止伪装成旧构建。

## 六处显式适配

1. wall-note职责头把旧core称谓改为领域公共API，类型导出保持。
2. 后端根职责头同步领域称谓，重导入口指向唯一domain。
3. 历史指纹测试读取已固定的 `27a97cb` 六根指标，严格断言来源提交、原根与原摘要；不再遍历已退休core。此为读取冻结历史身份，不冒本次重算历史算法。
4. 导入边界检查同时识别domain和历史core，保持合成旧输入可用，禁止通过目录改名绕过领域依赖限制。
5. inventory识别新领域入口及kebab声明。六根历史盘点算法不改，独立审查后把owner和boundary明确为历史指标，补中文注释，不能称它现行engineFingerprint。
6. 两构建trace保原originalLayout，新增仅领域入口不同的有限domainLayout；默认自动选择拒绝双入口、缺失或非文件。显式layout仍是原调用方覆盖入口，不冒它也受自动选择约束。

以上适配不藏在整程序等价断言中，均须语义同行审查。没有新的清理框架、事件总线或权限影子状态。

## 路由与证据边界

主证明核1144整程序的精确正逆编辑、实际物理目标8868对、1222585 typed nodes、210935 NodeArrays、1537834 token leaves。2288份真实整文逆输出与原程序相同；1141个无显式适配的路由程序另核归一实际ESNext输出。新旧模块字面和CJS生成局部别名可变，不声称新旧raw输出相同。6显式适配另列，3工具/测试根未纳入路由程序等价。

1955公开现行TS/JS的字面all-form module扫描旧core incoming为0。module AST之外另有9项普通历史/合成/工具字面；第10项为 `check_seer_baseline.mjs` 生成probe模板中的旧core导入，它先提取固定 `eb4f026a` 历史Git再运行，原字节保留。该有限库存不承诺任意计算字符串或仓库外零消费者。历史文档、生成证明、原fixture及manifest没有批量替换。

ACP fixture support只改外部类型的模块路由；其完整 `ActorTransportPlan` 导出声明仍符合原manifest摘要 `bb3d3bb9…`，真实game-agent样本原字节不变。没有以迁移名义豁免fixture。

## 实际检查

Root唯一执行：全后端source/tests/scripts类型0，tooling类型0；完整路由证明0；唯一受影响历史测试1 pass/0 fail/11 filtered/6 asserts；真实API／交付弱表／指纹／fixture声明探针0；同行说明窄桥0。原stdout/stderr、首ready与后继桥分别保留，未重复绿色检查。

v2指纹按真实路径自动覆盖42新owner并退出43旧路径，无需改枚举器。独立实际Git树与blob还重算旧v2输入876项、旧hash `1495c831…`；新输入875项、新hash `a7497137…`，锁仍 `0cec67d8…`。这是两套源码身份，不允许strictReplay忽略差异。

本批只完成C41/C42的领域部分。AI/runtime、engine/features、recording及全仓命名仍待相应批次；全量门禁和两构建七样例差分按用户要求在物理大阶段汇合后集中后台运行。本批不标记P8/P9完成。
