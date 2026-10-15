# 固定构建机械差分

C02 使用 `tooling/refactor/differential.ts`，分别冻结 Git 基线和候选公开生产源。构建目录在仓库外，旧 lock / source 指纹原样保留；每个构建运行原生 bootstrap、request capability、recording 及自身严格 replay。工具不调用真实模型，不读取本机运行配置与认证。

## 固定输入与限制

- 生产源码及 package / lock 的成员和字节在运行前后核对；新增文件也视为变化。
- 外部库仅在 resolved lock entries 相同时从已安装 `.bun` 复制到各构建；每个 owner 的 workspace links 指向自己的构建。库版本、链接真实边界及库字节都核对。不宣称借用当前库可以执行任意旧锁文件。
- 共享 driver、literal transcript、输入和可选 layout 均有前后摘要。layout 必须指向该构建内实际文件。
- `Date.now` 在加载机制前固定为 `1700000000000`，以覆盖模块捕获的时钟。native timer 保持真实，完整运输、超时和迟到 MCP 等另做验证。这组样例不证明所有期限场景。
- action 只根据 issued request DTO 与手写旧座位计划选择，不读 World、profile 或规则结算。预期 Provider fault 必须实际触发一次，且捕获同一 literal fault；更早的其他失败不能当作成功。

## 对比范围

对比全部 request、events、audience、operations、checkpoint、库存、知识、资源、胜负与 opening / settlement / operation 因果位置。原 `normalizedRequest` 只删除 deadlineAtMs；没有新增宽泛容差。逻辑时钟下的 event timestamp 严格对比。

只有 `metadata.engine.sourceHash / lockHash / commit` 和 strict replay 返回的 scratch `recordDir` 不作为玩法差异；前者独立由固定 source / lock 校验，后者是产物地址。engine.id、未来未知字段和其他诊断均保留。比较不修改原 trace 或历史 Tape。

## P0 实测

[差分报告](generated/p0-differential.json) 固定两个构建与 driver 摘要，七个输入全部 difference=null：基础六人、寻香 first_link / inherited_gun / failed Provider、动物 fox_beauty、白猫 wait / expire。各输入见 `tooling/refactor/scenarios/`。七样例成功轮 `/tmp/awa-refactor-differential-p0-final`；Provider fault JSON 正常格式化后单独重验两构建，证据 `/tmp/awa-refactor-differential-p0-format-fault`，其他六项输入字节未变。固定构建在 `/tmp/awa-refactor-differential-p0-fourth`。两种构建的 engine sourceHash 相同；各自 lockHash 不同并各自严格通过，未改写历史版本。

第一、第二轮失败日志独立保留：离线缓存 / 沙箱限制和 Node cp 默认将依赖链接绝对化；之后用完整副本与 verbatimSymlinks 修正。第三、第四轮及最终成功轮没有覆盖这些失败记录。原审查负例与修复复核见 [独立审查](differential-review.md)。

```bash
bun --no-env-file tooling/refactor/differential.ts \
  /home/hby/dev/AI-Werewolf-Arena /tmp/awa-refactor-next-empty \
  27a97cb tooling/refactor/scenarios/*.json
```

这只是已列样例的机械差分，不能代替全部角色、通信、浏览器、失败注入和独立规则 oracle。F01 / F02 语义修正需单独新预期，不能从差分里删除其字段。最终 P9 仍须同源固定输入完整验收。
