# 会话录制、checkpoint与独立复现

## 记录负责人

会话lifecycle持初始化、刷盘、closing／flush／finalize与资源关闭；session context隔离并行异步对局。内存aggregate不持磁盘封装；文件store只写单文件.tmp／rename，不承诺多文件事务或自己补终档。

JSON.stringify在宽写入catch外的既有位置，编码失败仍传播；宽catch不含任意后续日志／诊断throw。必需核心产品写入失败不得降成可选警告。运行和清理／保存同时失败按原owner保留原对象或AggregateError，不能靠统一cleanup吞掉一边。

## checkpoint与Trace

现场 checkpoint 捕获与装配已在 `2b6f24c8` 归 `app/checkpoint` 的 contributions、authority-snapshots、identity-setups、player-snapshots、private-state-codec 五个完整 owner；纯 animal-format、player-format、animal-audit、noble-body-format、fragrant-pair-format 留在 `recording/reproduction/checkpoint`。

捕获按既有特殊 authority 优先和实际选择链取数据，保原引用／getter／JSON 时点；Demon 整 players 特殊贡献保外层优先，ordinary 完整 private 容器 clone 不按角色删扩展字段。玩家 DTO 的裁剪白名单不能用作 God checkpoint codec。

Trace记录issued request、selection／operation／完成及真实失败CP。completion只在真正全部领域付款后true；partial false仍保存已经发生的世界前缀。当前Tape3在实际false结算时保存已安全复制的`returnedCandidate`，outcome仍为error；真Provider抛错或交付检查早拒不保存该字段。历史Tape2保持原shape，不补候选；字段缺席不能推成null。候选与付款分别核对，具体版本见[档案兼容](archive-compatibility.md)。

## 三层不同保证

1. 公共reader：格式／已声明版本／payload和玩家关联合法，可读历史公开档；不执行规则。
2. 独立verifier：以档案可见字段做有限算术、写序和因果拒绝，不导生产owner、World或伪造life／lease精确证据。
3. exact replay：使用同一真实source／lock／RNG／ruleset原生执行，逐请求／事实／CP对比。

Cupid／Hybrid独立校验以同族最后decision约束末CP；已知回复必须匹配目标，只有未记录候选的末error／pending才可在明确范围内承载unknown partial。Tape3显式null、错工具或目标冲突不能由CP、更早选择遮蔽；合法候选也不证明付款。单有God事实不证明对象已死或合法资格。普通死亡历史校验同样不能替exact运行提供完整生命证明。

verifier按实际assembly原顺序追加贡献；board support保持独立的有限预设，不import生产支持算法充oracle。`recording/verification/<feature>`与生产features故意独立。

## 隐私与归档

God公开replay、私有manifest／reproduction及逐玩家档案的字段与身份分开。[档案兼容](archive-compatibility.md)列四类当前格式；完整原字段与原始prompt／thinking／tool内容不由文档整理或显示层再编码清洗。

普通死亡后果独立审核的已提交来源见[Q3 范围与失败前缀](../history/refactor/ordinary-death-history.md)；具体消费者为 `recording/verification/assembly.ts` → `death-history/validate.ts`，不是运行许可或完整生命重演。
