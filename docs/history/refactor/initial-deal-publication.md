# 初始身份公共牌组事实的所有权

## 四源完整边界

实际基线 `c9e7a3c876a532c880308edb9b8cb71a9773c88b`：PM、原 initial_identity ports、新 `initial-deal-publication.ts` 和新单元，共四源，两个原源与两个控制源核真实 Git。

PM 构造器的完整两语句算法归具体角色所有者：先查原 deal，再查 kind；有 deal 才再次复制角色数组、读人数、按 kind 生成同一事件种类／政策。ports 仅公开实际同函数绑定。PM 在原位置调用，仍保私密完整玩家牌表 → 公共整副牌组 → phase_changed → 继承／初始警长顺序。

这是整副公共牌组，不含手牌／玩家对应表。原 deal、初始库存、设置、夜间许可与生命周期不搬动；查询和公开数据不是行动许可，也不增去重、序列号或框架。

## 读取与失败前缀

即便无 deal，仍进行第二次 World／kind 查询；原两次查询不缓存。deal reader 已先 map 副本，此处仍 spread 第二份副本，再读 boardSize。事件数组与 push callee 在 clock／政策之前读取，原 push receiver 为同一数组。getter、迭代、clock 或发布失败仍原样传播，不回滚已发布的前面事实；后续阶段广播尚未执行。

运行输入只提供在原表达式处读取的 World／事件／人数；新公共函数、回调输入、调用栈和模块初始化路线是明确 API 变化，不承诺任意 namespace 重绑定或完整 cold 图等价。没有提前拍摄 World、复制手牌库存或导入 engine；新 owner 唯一值依赖为原本族 deal。

## 实际有限验证

- 新首运行 `533acf`：1 pass／2 fail／2 断言。两失败源于新 fixture 缺 Victory，原安装器 `copyEventData(undefined)` 在发布之前拒绝；原日志和 fixture 全文保存。仅补真实领域 Victory 创建，不修改生产或字面预期。
- 只复两失败用例 `3b84ac`：2／0／12，另 1 filtered；原无 deal 成功用例未重复。新三不同用例共 14 断言，涵盖无 deal 的第二查询、两个 kind 的事件／receiver／clock顺序、push 查询失败前缀。
- 原开局精准 `945de6`：1／0／3，另 1 filtered。共四个不同成功用例、17 断言，分三次运行；未运行完整阶段／对局。
- 四根有限类型首 `13b0ac`／session 50141 → `fb4d7a` exit 2，仅新断言三个字面 Role 与 Bun matcher 类型诊断。仅 subject 以 unknown 做内存比较，字面预期和输入不改；`ad282e` exit 0，完整新单元两个输出同。失败根一根 `0e1b83`／session 75390 → `b9dda1` actual exit 0；原其余三个根未重跑。
- 原职责头 `80c2e1` exit 0：四源、586 个当时 Git 文档，诊断／中文头缺失 0；type-only末桥不重头绿。
- `de9e4e` exit 0：两个完整消费者和实际 owner 两语句，5,317 typed 节点／6,644 非注释叶，六个完整 ESNext／CJS 映射输出同。完整 PM 的精确逆与 owner 独立逆分别核，不恢复旧整个 PM 体掩盖新函数。

原本族 deal 和事件投影控制源全部字节保持；生产原 import／角色政策／产品字符串和阶段时钟行为不变。中文头与关键晚读／公开知识／失败说明沿实际职责补充。

新源／路线／注释参与当前 sourceHash，历史档案身份原文保留，未提供跨构建复现豁免。未改动物权威、Voting、其它代理测试、台账或矩阵；未跑全量门禁／类型／suite、模型或私有配置。固定 f0ed 的 289 债只是选取切片的历史输入，不是现树诊断或完成声明。
