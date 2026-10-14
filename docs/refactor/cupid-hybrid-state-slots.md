# 丘比特／混血儿完整选择数据槽

## 来源与范围

真实基线 `4e0d25c88e4aa70a0f942b8361d43986ebed8893`。联合16路径包含14现行源和两个真实删除的旧 `state.ts`：作者负责两族 profile、night_stage、ports、新 state-slot、三个旧测试路由和一个新单元；Root 负责 Observation 与共用读边界测试的四处精确导入。13个旧源码全文均来自该 Git，三个新源无历史。

新槽收齐原完整数据程序：Cupid 的原槽读取与 descriptor 玩家投影、profile 完整初始化、stage 的剩余次数／配对选择两写；Hybrid 的初态、读取、选择条件和投影、完整初始化、stage 两写。旧 state 入口删除，不留兼容桥。公开 ports 仍直接导出四个实际读函数；profile 和 stage 分别调用新 owner 的完整初始化、提交函数。

## 所有权与原顺序

初始化保持原查槽条件。Cupid 先求值赋值左值的容器，再读取上下文政策并安装；Hybrid 先求值左值容器，再调用原 fresh 初态。已有槽保原引用，不复制／冻结角色容器。

Cupid 夜阶段仍持请求、目标、生命、容器和 Victory 复验，最后先 `bindLovers`，再消费次数、复制 pairIds 和写 choice，随后逐成员安装归属并发布事实。新命令内的复制或 setter 失败不撤回已经绑定的关系、已消费次数，也不补发后续事件。Hybrid 仍先构造胜利归属对象，随后消费次数／写 choice，再安装组件、记录夜提交并发布事实；失败保留原逐步前缀。

原两阶段的 await、三个尝试、裸调用／receiver、policy、当前性、目标生命、事实和随机流程不变。init 原箭头回调退休为真实槽函数绑定，调用栈、模块入口及函数身份有变化；不承诺任意 CJS 重绑定或私有反射环境等价。

## 数据接受与剩余边界

live getter 仍原宽读取／cast 集合；Cupid 玩家投影保原 descriptor 过滤与政策归一，Hybrid 保原选择副本。没有借迁移新增严格 schema。玩家视图不是私有档案 codec，普通 checkpoint 仍由录制 owner 完整克隆 privateState；不改历史格式、指纹算法或旧身份，新源码自然参与新构建指纹。

两族原本没有独立 state JSON 指纹、clear／death 数据命令或退款。状态、容器、生命、成员和 phase 的失效检查继续归阶段／关系 owner；Cupid 的 JSON 比较仍针对 Victory membership，不改成槽授权。尚未交付的 schema、归档 codec、复制／转移或完整生命周期边界不冒充完成，本批不代表 C17 整族 complete。

## 有限验证与真实失败

新三例 `775d85` 首次退出0、26断言，覆盖晚政策读取失败、Cupid 关系已绑定后 choice setter 失败、Hybrid 两字段提交后 Victory 安装失败。原双 pending Hybrid 案例 `ca0c8e` 首次退出0、1例6断言、34过滤。合计四个不同成功案例、32断言、两次执行，未重跑绿色案例。

14根类型首查 `e0dfaa`／session31060 → `faef25` 真实退出2，唯一诊断是旧 `affiliation-authority.test.ts:96` 上下文缺必填 requestFactory。本批保持该测试正文，仅改 state 路由；**typeAllGreen=false**。有限原输入覆盖 `94461c`／session60129 → `d0af31` 工具断言退出0：原 Git 测试与两旧 state 叶覆盖下仍有同一 TS2741；只有 Hybrid 旧叶实际被读取，其余依赖沿当前源码读取，不称完整固定 Git 编译或类型通过。合法夹具补全由后继独立批负责。

唯一完整程序证明首 `cdad8f` 因工具对空 after 反演计数失败，保存原脚本／输出；只修原类型 import 的明确锚点，`43c7bf` 退出0。四个当前实际新函数体完整展开后，13原程序精确还原，14212非JSDoc节点、17744非注释叶、26完整映射输出同；当前26输出本身不同，未宣称原程序 raw 等价。运行／首类型之后的一条 LHS 中文精度修正纳入这次唯一成功证明及首头检查，单 comment 两 raw 输出相同，未重跑原绿。

14源头／中文检查 `072f13` 首次退出0，646公开 Git 文档，零诊断。静态绑定库存首工具误把实际 player_state.ts 写成 index.ts；保存该失败输出，首组合 shell 终态不能代表子工具成功。只修真实目标预期后 `e2201f`／session32752 → `6c2a2a` 退出0：1911当次源码、15旧 clause／11 consumer、当前退休引用0，四读绑定和四实际初始化／提交消费者均指向唯一槽。Cupid 仅保原 player_state 值导入，Hybrid 零值导入；没有执行完整冷图或冷启动。扫描形态仅含 import／export、ImportType、字面 dynamic import／require，不包含 ImportEquals 或计算字符串；退休引用0仅指本次实际扫描形态。

六个明确控制源保真实 Git 全字节。未执行全门禁、模型、完整旧套件或录制重现；原类型红、工具失败和后继共享源批次分别保真实范围，不借结构或有限绿色结果验收全部角色。
