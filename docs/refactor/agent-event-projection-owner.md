# C34 全家族 Agent 事件投影 owner

实际 Git 来源 `a51fe27f`；当前 C38 提交未改变这两个原输入。三个生产源及一个新测试的固定摘要、程序证明与审查见 [固定证据](generated/agent-event-projection-owner-evidence.json)。

## 实际归属

`game/observation/agent-event-projection.ts` 持有全部既有事件家族读取、受众政策、三组白名单及字段裁剪程序。事件流与独立布尔可见性 API 真正消费相应入口，不增加未使用 registry。

事件流继续拥有原 Node 安全快照和局部连续 seq；registry 继续拥有原 custom rules 指针。共用 owner 只导入公共契约 ID／事实 reader，不直接持有 World、角色或资源写权限。恶魔身份查询、自定义规则及来源剪裁通过原分支的窄回调晚执行。

## 接受范围与顺序

两种旧模式保持：feed 先 Node Proxy／descriptor／密集数组／深度检查，再取得同一副本；direct boolean 仍读取原 typed GameEvent，不新增 unknown 零 trap 承诺。Animal／Fragrant／Noble／Radiant／Mist 的 feed 早返回和 Mist 等原模式差异保留，不统一为更严格 schema gate。

历史 audience 不按当前阵营重算；不可见事件不留下全局序号缺口。自定义规则保持原 plain function receiver 和 World／event／actor 参数；feed 的 custom 得到同一脱离事件，其既有副作用仍在后续投影可见。来源裁剪保原 callee 查找先于 source／sourceDisclosed 读取。

所有既有字段、原文、第一拒绝与实际重复 reader 调用保持。本批归并所有权，不为减少次数改成提前校验或缓存。

## 有限验收与审查

- 初新 6 + 原 feed 5：实际 `11 pass / 0 fail / 56 assertions`。
- 同事件／来源调用顺序新增案例单独 `1 pass / 0 fail / 3 assertions`，未重前 11；不称最后全部 12 重新运行。
- 严格有限类型 session `44355` 作者实际终态 `0`；初 typeRoots 与新 getter 返回类型诊断分别修临时配置／显式函数类型，执行输入和预期不改。
- 完整 snapshot、seq、全部家族程序、字段裁剪、三白名单与两 consumer 展开有 11 个完整核对；22 中立 helper 与真实 Git 同源。
- 展开 feed 的 ESNext／CJS 原字节同；registry 仅 time_consort 两条件的行折叠不同，raw=false 原样保留，完整 emitted tokens／AST 同。初两证明脚本问题保留，不通过屏蔽字段／literal／数组取绿。
- 四职责头和关键数据／回调／安全说明中文；Root 读实际入口、owner 和全部新测试，独立方向全源码及最终四 SHA 审查无待修项。

新 owner 自动进入现有完整源码指纹，schema2、strict 准入与公共文件形状不变。未运行完整对局、全仓门禁、网络或模型。

## 后续范围

当前全事件投影程序归并完成；C33 玩家知识／能力完整捕获、C36 内建纯展示、wire 解析及整个 C34／P6 仍需后续交付与验收，不据本批标记全阶段完成。
