# P3 I03 私有记录与请求交叉审查

日期：2026-10-08。范围：私有player记录机器phase/stage与v2/sharedreader、引擎请求MessageRef、Tape ref schema及旧原文。

| 代理 | 首轮发现 | 修正及最终复查 |
| --- | --- | --- |
| `review_scope_rules` R/T | String枚举校验接受数组；继承Ref压掉显式custom文本 | typeofstring后枚举，旧/2坏嵌套回归；raw/empty优先且保空白与占位。独立36测试3371断言含中英人工对局与50局复现；收尾8测试75断言，0阻断 |
| `review_arch_tests` A/T | 新retry ref仍与调用方共享；kind反例应使用prompt而非user | retry/summary均clone，新input key/parameters变更请求不变；role=user/kind=prompt分别拒coercion。独立8测试75断言，owner/API/生命周期复查0阻断 |
| `review_i18n_delivery` L/D | raw并存/empty政策和private schema/构造器/Tape需准确说明 | private-record-v2+i18n写独立schema、元字段only、unknown/day诊断、Ctor去localizer、原文/empty优先与严格兼容，最终复查0阻断 |

## 验证

- 后端release291测试0失败；类型/依赖/边界/完整对局/实际SDK/ACP/MCP/离线动作复现/烟测通过。
- 前端类型及34测试通过，公共v2与旧browser读取保持兼容。
- 新8定向测试75断言：工厂两locale请求相同、显示语言不同、自定/spread/empty原文优先，key/params深拷贝；真实两localeplayer写盘检查机器IDs/schema/locale/原文。
- 手工legacy-player-view fixture核对只元字段转换，未知及day异常保留，原输入/payload/prompt/thinking/tool result不变；v2不反推中文，未来版和嵌套数组/对象坏类型拒绝。
- 当前录制Tape中unknown message key、缺参数与多余参数真实parse拒绝；整体旧source hash/RNG政策不放宽。
- 没有外部模型/认证调用。规则/资源/受众不改；英文runner/reproduction gate保留。I04、剩余日志与P3整体双语验收仍后续，不宣称整个扩展完成。

三路最终复查剩余阻断：0。
