# 普通五族的数据所有权

## 完成范围

24 路径，22 份既有源、2 份新增源，无删除。骑士、白痴、白狼王、熊和守墓人保留实际 `state.ts` 为唯一数据 owner；没有为了命名增加槽 facade、镜像或通用框架。

| 族 | 数据 owner 收口 | 保留的业务／权限 owner |
| --- | --- | --- |
| 骑士 | 原同引用 get/set、捕获库存消耗、完整初始化和玩家 canDuel 投影 | 窗口生命／资格复验，commit 付款→事实→死亡提案 |
| 白痴 | 原同引用 get/set、完整初始化和玩家 revealed 投影 | 规则原 native audit／普通翻牌→票权→警徽→事件 |
| 白狼王 | 原同引用 get/set、捕获库存消耗、初始化和 canDetonate 投影 | 原自爆目标死亡提案→付款→事件和窗口资格 |
| 熊 | 初始化、get/set、普通 push、黎明纯数据接受算法／受控历史写和玩家历史投影 | 原 frame 生命／采样／World-夜发布状态、事件写入与 finally |
| 守墓人 | 初始化、get/set、原反馈历史 spread/push、完整观察报告块 | 标签捕获、前日／接收日去重、参与者与事件阶段 |

公共数据及 readonly 类型继续归 game-contract。普通 get/set 没有运行 schema，不新增 getter／原型／Proxy 拒绝或冻结；原 live 引用与不透明容器保持。这里没有旧 JSON 身份 codec，未新增伪编码器；普通 checkpoint 仍由录制侧完整克隆 privateState。本批不宣称所有状态／生命周期或 P9 完成。

## 共享边界与实际前样

最初族内 16 份完整前样来自实际 Git `4e0d25c88e4aa70a0f942b8361d43986ebed8893`。Cupid／Hybrid 提交后，逐字验证这 16 份同实际 `bec1f8854fd12c479a1a1098cc08313096c88f08`；另六份共享旧源从这个后继 Git 捕获。最终 base 为 bec，原首采记录保留，不将前一批两观察路由逆成这批的成果。

原四个 shared player_state projector 全体归本族，旧出口退休。守墓人 get/history／Array.isArray／flatMap／严格报告 reader 的完整观察块归本族 `projectGravekeeperState`；直接 history getter 与严格 reader 的不同接受面保留。

原 playerDataField、positiveInteger、rows 三完整纯算法归零 import 的 `player-state-data.ts`，没有复制第二份。旧 playerDataField 出口退休；实际 Cupid、杠精、Mist 三个消费者直达同新 owner，其余 player_state 方法亦用同绑定。共同观察和旧共享单元仅改实际路由／守墓人块，原 oracle、请求与其它族流程保持。

## 读写与失败顺序

五个 profile 的完整原 init 体成为本族具名 initializer，原 set callee→角色参数与默认对象→安装函数内 privateState 左值及同引用写入的顺序保持。原安装、consume 和普通 history commands 全部保留，没有二次状态读取、授权或退款。

熊的 ownData、appendable、unpublishedHistory 三个实际纯数据算法移到 Bear state；Node Proxy 拒绝、Array.prototype／length／extensibility 和快照 catch→false 仍各按原宽度。普通发布仍 history.push→event；黎明仍 event defineProperty→原 history defineProperty→published，第二写失败保留第一事件，finally 将 checking 撤销。World／夜号发布记录、重入撤销、历史清空不恢复许可及原生命／重新采样全留 frame。history 与 report 原引用不重建。

中文职责头和重要结构说明同时补准确的初始化、live 宽接受与玩家 descriptor 过滤、只读类型不是许可、夜初／黎明采样及非事务失败前缀。共享 Debater 正式中文名按实际 profile 为“杠精”，机器 id 与文案不改。

## 完整证明与有界绑定

22 份旧完整程序精确正演／逆向，10031 typed 形状节点、12043 非注释语法叶和 44 份完整 ESNext／CommonJS 逆向输出保持。另独立读实际 14 个保留函数、5 个完整 init、4 个移入 projector、3 个 Bear 数据算法、黎明写体、守墓人观察块及3个共同 helper；每个实际完整体的两份输出分别核对。没有把旧整个 owner 身体放回新函数冒充等价。

七个源码根完整 AST 库存 1904 个 TS/TSX/MTS/CTS/JS/CJS/MJS 文件，before 以 22 真 Git 源覆盖、排除新 helper／unit；原14状态函数＋5搬移公开符号：59站点／77 bindings，当前61／79。61原绑定保持、8搬移绑定直达真实新声明、8旧caller binding随初始化／未消费specifiers／守墓人块迁出。所有 namespace/star/inline type/importEquals／字面 dynamic/require均遍历，相关实际站点为 named import/export。计算路径、eval及仓外API不在库存内。24源中的12新callee另直接核实际声明／公开路线，共20命名绑定；不将这项有界核对冒全仓所有symbol。

原4控制（Knight commit、自爆commit、Idiot规则、Grave反馈）全文保持。新 initializer 引用、函数身份／调用栈和模块加载组织实际改变；Bear Node util/plain_data 值依赖归 state，Grave reader 归本族。轻 helper 无初始化依赖，但不承诺任意 CommonJS namespace 重绑定或完整 cold 图／初始化等价。

## 真实检查阶段

- 新2风险首次：最后 Bun 命令 `abc641` 2成功／0失败／22断言；同组合命令的前置 Python wrongcwd错误发生在源码写入前，preparation-history明确保留。这两个绿例未重跑。
- 原6精准用例首次 `a48882`：6成功／0失败／72断言，42过滤；两run共8个不同成功用例、94断言。
- 有限24根类型 `1edddc`，session29149→`7f5b92` 实际0。新unit事先加一个纯 Extract 事件视图，前样与两完整擦除输出保持；不是运行输入修复或再次green。
- 主proof首 `9b9ded` 为 Bear profile首变量误锚 parameters 的工具红；改比较器实际锚 `*_ROLE_PROFILE` 后 `10cee4` 实际0，不改产品求绿。
- 首24头 `1a72cc`：647文档，WW时点词项1诊断、Debater中文头1失败。仅failed2 `8f2416`，Debater已闭、WW“提交前”仍不合旧关键词；等义“提交之前”后只failed1 `a1bcea` 0，648文档。原22初绿不重。
- 主proof／类型采样后的 Debater两中文说明、WW等义词及正式“杠精”单词，以单源完整非注释叶／各两完整输出桥承接（3717ec、c235f5、cbb0a3均0），原输出与采样SHA不回填。主proof的新unit类型树明确不同，只有运行擦除同。

完整前样、精确编辑、脚本、首失败、实际终态和各阶段SHA见同前缀 evidence／receipts。未执行全门禁、模型或重复已绿验证；后继独立 Hybrid fixture 不在本源范围／控制中。
