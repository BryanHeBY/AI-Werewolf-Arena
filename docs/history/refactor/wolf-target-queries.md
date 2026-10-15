# 普通狼刀目标查询

## C24 四个真实贡献

Mist、Noble、Evil Knight、Nightmare 各自公共 port 拥有原目标限制；Wolf port 只通过 boolean/ID-array 贡献和 alive-ID roster 按原顺序组合。六处真实调用覆盖 hint、gateway、投票后复检、当前刀源、最终目标及 stale knife cleanup。旧 `wolf/target_policy.ts` 无消费者后删除，没有兼容第二算法。

每次候选依次读取 Mist circle、Noble、alive roster、Evil、Nightmare。Noble/Nightmare 首次 Role 匹配时仍执行原第二次 Role/state 读取，不能缓存或按配置是否启用跳过。这保持普通 World 上 live role replacement 的原拒绝规则。Mist 无板子/无circle/关闭与已安装原体撤销的不同结果保持，外来 ID 不强制转换。

绑定不读取 World、actor/frame、clock/RNG；查询端口只接受目标 ID，返回 boolean 或 readonly primitive IDs，不暴露 state、life、stock writer 或 commit。实际 World/target 参数求值位置、await 后资格、captured life、失败政策与 paid mark 顺序均保持。冻结对象只限新创建的 port shell，不冻结调用方状态。

## 证据与限制

七项有限 owner 测试、37 次断言和原实际 Mist knife 一项、19 次断言通过；必要有限类型检查通过。四原表达式、四完整 consumer 的六处调用和 import 目标保真，既有 Nightmare fear 接口未动，十个当前职责头通过。五个原函数字面/getter/error输入保相同结果及顺序。

独立 cold hint/catalog/bootstrap 原现同成功及出口；direct WolfStage/validation 原现均在原 WOLF 常量位置发生既有 TDZ。原删除 leaf 的 VFS 首次解析错误是审查 harness 缺输入，保留红日志后只在 `/tmp` 恢复同一纯 leaf 和七个相同目标进口完成原版复核，未修生产代码或把原冷错误冒称全绿。

完整 C24 的 native/source dispatch、Seer/Guard/Lucky 政策和 Time Consort mixed receipt 继续单独迁移。完整 RulePlan 与工具一致性不由本查询切片完成。
