# 鬼魂新娘旧测试的配置身份修正

## 原因与唯一改动

实际基线 `40e411d04229b675a24d2a20f65eaf661c6e4976`。仅修改 `backend/tests/scenarios/features/ghost-bride/native-setup-night-and-private-relations.test.ts` 的一处共享调用：`GhostBrideSetupWindow.execute(g.config, …)` 改为 `execute(g.boardConfig, …)`。

fixture 的 `config` 是原始输入。bootstrap 编译后用 `BoardParameters.board` 同一实例安装婚礼 authority，返回的 `boardConfig` 是该实例；`beginWeddingSetup` 明确要求它与原安装 `b.config` 同引用。raw config 会在请求工厂 getter／任何选择之前触发 `ghost_bride_setup_unavailable`，不是新构造依赖导致的失败。

原 raw config 与其余用途保留。原四组新郎／见证人、全部标题、角色／库存引用、动作、回调、断言和已提交 constructor getter 接线不变。不放宽生产校验，也不改 golden 或新增玩法。已有中文场景职责头保持原字节，本次原因与权限边界在这里说明。

## 定向验收

- 此前真实红保留：旧批 `8be2ab`，隔离原 `8940e3cf…` Git 的 `6b70de`，均为 `ghost_bride_setup_unavailable` 且发生在新 getter 之前；来源见原 `night-and-wedding-request-construction-receipts.json`。没有重跑历史红。
- 仅复查原失败标题 `actual bootstrap/factory/setup preserves native 2/3 and final independent goals`：`f868b1` exit 0，1 pass／0 fail／57 断言，10 filtered。其余三个共享循环 case 和已绿例不重复。
- 有限一个源类型：`f575f5`／session 94930 → `167793`，exit 0。
- 同一源真实职责头检查：`6b7731`，575 个当时 Git 文档路径，诊断与中文头缺失均 0。
- 精确唯一实参逆向：`7c86c7` exit 0，原完整程序 2,152 个 typed 节点、2,788 个非注释语法叶；仅一个 identifier `config → boardConfig` 改变。逆后完整源与两份 ESNext／CJS 输出相同。实际输出确实改变输入，不声称前后运行字节相同。
- 原 before 全文与真实 Git 相同；bootstrap、婚礼 authority、setup 三个控制源均保持完整 Git／当前字节。仅测试源 diff-check 通过。

这是测试输入合法化的一笔独立功能修复，不是生产授权调整、全组测试或全玩法／P9 验收。全部受控原动作和预期保留，原配置 identity 校验仍负责拒绝不同对象。
