# 首夜请求测试的板子输入修正

基线为 `5a5c7542d649689f9b07d288a83e658bc2b58684`。只修改野孩子与孤独少女的两个既有测试文件，不改生产代码。

C18 的两个请求传播用例原先传入 raw `g.config`，在创建请求之前便因板子引用与准备绑定不一致而失败。十一份真实旧程序的有限 overlay 也报相同 `*_setup_unavailable`；原红灯、原输入和对照范围保存在 [C18 收据](generated/request-lease-propagation-receipts.json)，没有重跑或抹去。

本批只把这两个调用的板子参数换成 bootstrap 返回的同一 `boardConfig`；World、事件、provider、动作、工具与拒绝预期均保留。野孩子 helper 的输入类型收窄为其实际读取的三个字段，以接纳只读板子；孤独少女已有该类型。其它 raw 配置输入保持原文。就地中文注释说明为何本例先满足板子身份，再核请求传播。

仅重跑此前两个失败标题，一次 `eae2de` 退出 0：2 pass、0 fail、9 断言、80 filtered。两个有限类型根 `046dee / session58650 → 0b86d5` 退出 0；职责头 `d16fc5` 两源、663 个实际 Git 文档路径、诊断 0。没有新增镜像测试或复跑其它绿案例。

精确五处编辑完整正逆，159 个原 `expect` 表达式逐字保持；四个生产控制文件的实际 Git/current 字节一致。两个文件各两份完整逆向输出保持，实际 JavaScript 因两个输入适配改变，不能称原运行输入等价。证明首次 `813686` 退出 0。没有运行全套门禁、修改期限政策、请求付款或历史复现身份。

[范围](generated/setup-request-fixture-board-scope-final.json)、[证明](generated/setup-request-fixture-board-proof.json)、[收据](generated/setup-request-fixture-board-receipts.json)。
