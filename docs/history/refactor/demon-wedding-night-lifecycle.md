# Demon 与 Ghost Bride 的夜间清理归属

## 具体状态 owner

`DemonNightUnit` 拥有原 pipeline 的 acquired 与 handedOff 两个标记。原 begin 成功返回后才取得清理权；失败前缀不新增 close。成功路径仍在原后段移交，pipeline 的 finally 只关闭已取得且未移交的原夜间状态。

`WeddingNightUnit` 拥有原 handedOff 标记，并保留最早已观察的 ownsWedding 值。它与 Demon 的获取语义分别表达：Ghost Bride 捕获失败后，只要原 owns 为真，仍执行原 finally close。捕获及私有事实的 World、events、push、时钟、spread、actorIds 复制与 audience 顺序保持。

manager 的中断与特殊结算 finally 共四个关闭调用仍无条件执行，顺序保持 Demon 再 Wedding。具体 terminal 边界只调用原 authority 函数；没有新 acquired、closed、一次性保护、错误汇总或通用清理框架。付费效果、原生命、关系与阶段推进继续归原 owner。

两个功能 ports 具名重导出实际 engine 查询所用的原 authority 函数。函数引用与参数保持，旧 deep import 的绑定集合不通过债务豁免放开。Unit 构造不读取 World、events 或时钟，runtime getters 在原使用点委托到 pipeline。

## 有限验证

七个源码／测试路径以固定提交输入验证。两个完整 engine 程序只经过明确登记的调用和局部标记替换；两个新 opening 主体的 token、重复读取、操作及序列与原块匹配，未忽略数组、操作符或绑定。

三个 Demon 局部用例分别检查失败不获取、未交接关闭及交接后保留原 scope；三个 Wedding 用例检查失败仍关闭、原捕获事实及交接后 manager 撤权。初新 fixture 的错误记录保留：遗漏原 request binding、用了初始化输入而不是绑定 config、遗漏原 chat delivery。修复均补齐原许可和输入流程，没有修改生产规则。Wedding 最终仅重跑相关三项，通过、32 次断言；没有重复完整对局。

固定源码候选的七文件类型检查实际退出 0；七个职责头和新增依赖检查通过，47 条旧债保留。初新测试类型诊断及职责头诊断保留；只收窄实际事件类型、保留原请求对象并明确职责说明。原 controller、setup、stage、记录 schema 与 checkpoint 控制保持；独立入口审查另核对固定前后构建的真实冷导入和 binding 身份。

[证据摘要](generated/demon-wedding-lifecycle-evidence.json) 记录实际输入与范围。本批只关闭这两个普通 pipeline／manager 交接子项；完整 Demon、Ghost Bride 权限、来源、付费效果、死亡链、编码和所有旧入口仍按矩阵继续。
