# 完整复现因果轨迹所有者

ReproductionTrace、normalizedRequest 和 Node 安全数据复制三份完整实现归独立 reproduction-trace 所有者。旧 reproduction 叶只保留 schema 2、版本／错误名称、解析与独立机制审核，不反向导出 Trace。SessionRecorder 和 replay 的两个真实生产消费者、其它静态消费者及一个动态路径全部接到新所有者。

本实例唯一持有 metadata 与七个可变载体：decisions、checkpoints、events、settled、invalid、errors、turns。请求开启先写 turn／pending，再在 try 外通知；通知失败不会调用 Provider 或回滚前缀。选择结果复制并检查原请求后，由相同 delivery scope 登记结算；decide 可以先返回行动，稍后回调才结束 pending，回执不表示资源付款。

同步结算通知抛错仍按原 catch 写 error、再次推进 settled 并再通知；延期回调异常不会重入此前的 try。两次 ownedEventCursor getter 保持原位置。checkpoint 长度失配在写入前拒绝；build 保留 live 事件长度检查、构造／复制、invalid 优先 pending、最终完整 parse 与 verifier 的原顺序。错误原文和运行句柄不进入归档。

## 实际证据

[固定证据](generated/reproduction-trace-owner-evidence.json)保存 20 路径：四个生产 source 和 16 个测试／support。三份迁出声明、完整剩余 schema／parser／verifier、17 个完整消费者程序、原静态绑定和动态路径经过真实 Git／独立双格式证明；全部数据字段、数组、字面断言与 callback 保留。

原 15 项有限用例在首独立执行和随后混合执行均通过、每次 35 断言；统计只计算这 15 个独立用例。新六项最初缺少必需 checkpoint，修正手写 fixture 后五项通过；只重最后一项，并恢复原中文初始化名字，最终六个独立用例通过、26 断言。合计 21 个独立用例、61 断言，不把首混合失败执行写成整体通过。首次新测试创建目录的工具错误以及可选数组类型诊断保留。最终有限 20 个入口类型进程 13383 退出码 0；最后中文说明修正不重类型或测试。

Source／lock／RNG／schema 2 字段和严格复现兼容边界不变。Node 数据入口在任何反射前拒绝 Proxy，不将 node:util 引入浏览器。没有新清理框架、私有配置访问、计费模型或全量复盘执行；完整 C38／C39 与最终同输入验收继续。
