# P7：觉醒隐狼运行候选与严格失败策略（历史首审）

本记录保留交付前候选历史；最终验收以[正式审查](p7-awakened-hidden-wolf.md)为准。

首审时工作区已接入Aw角色/Profile、有限七角色规则、真实250权限/580学习/650技能/660额外刀/900激活、接刀与枪钩子。共享catalog仍planned，21 verified/43 planned；本记录不是完整验收或提交依据。

## 已完成的候选边界

- 原生资源状态沿上一笔4b15a9a，不借机械mode/反毒/穿盾/首刀夜过期。
- 250只建立一次原body权限，建立本夜权限本身算已提交前缀；同World/day不重开，时间回拨拒绝。接刀由实际整批死亡之后更新，查询只读。
- 580即时学习与具体角色伪装，900实际激活，Hunter同夜末armed，主动技能下一夜。Mirror安装自己的新native实例，不依赖模板还拥有G02能力，不双存history/窗口，转出不补。
- paid poison/guard不因闭夜/耗空撤，首次真死可保前缀，复活/换owner撤；可取消毒claim不从旧PoisonMark回落，不消掉独立普通毒。
- 枪绑定学习原对象、skill和targetId/role/day/activation/activeFrom metadata；原生Aw Mirror另绑其学习owner，独立gift/copy不被错误绑到native learning。
- 八类私有事件仅本人可见且字段白名单；状态/提示裁剪未知字段，中英console private-only/front共用标签。真实角色/阵营/胜利/人格不被模仿改写。

## 首审修正

A发现gun同ref metadata撤权遗漏，已补全快照；发现250同日重开可让复活body拿旧刀权，已改单日唯一权限前缀与whole pipeline重入拒绝。A的spent请求意见被当前状态getter及独立probe否证，已撤回。

R/T发现原生Aw Mirror共享查验没有绑定Aw学习owner，已增加特定native scope，补await/gateway/label×9撤换反例及独立gift正例。发现第三次旧reply时最后候选消失仍throw，已末尾重查当前候选：仍有才失败，无候选合法wait关闭本夜不耗学习。

A另经真正provider复现optional null把3非法提交/transport failure伪装成合法wait。候选增加显式action_failure_policy=error，缺省保持旧行为；shared ActionTurn对可归当前合法turn的拒绝计数，三次封闭不接受第四次，合法零提交wait与一/二次纠错后valid仍可。

strict请求取消传播自己发起的AbortError，close只忽略同identity的预期pending取消，继续等待物理清理并保真实清理错误。SDK onStepFinish采invalid调用的safe name/id，不复制raw input/error payload；本SDK loop的错turn协议失败也不能作为clean wait，但不耗domain预算。domain拒绝保no_valid_action/具名原因，不伪造网络诊断；顶层诊断增加action_failed。策略已加入request/Tape校验，完整failure Tape尚待验收。

## 当前证据与未完成门槛

- 候选Aw运行专项58测试/244断言0；含真正PhaseManager首夜复制枪先900、再实际刀死/枪杀末狼后最后判胜。A/R的独立owner和规则probe闭项；L/D私有字段/双语候选6测试/364断言0。
- 本地严格optional SDK/ACP×两语×七模式28/162通过；generic旧角色strict取消/默认行为及生产AiSdkClient坏JSON/错ID8/40通过。默认生命周期回归40/212通过，其中本机HTTP取消需要进程权限，第一次沙箱EPERM不算通过。
- 早期受影响引擎/记录/呈现886/10896/64文件通过，这是后续Mirror scope和strict策略改动之前的候选门槛，必须按最终源码再验，不能冒最终全绿。
- 十套字面剧本及固定随机deal seed已写。预验SDK仅9/10测试通过（每项两语）；villager剧本误写原生Guard连续自守，已改但未再验。原12镜隐组合与其它9项预验通过严格Tape，都是本机合成HTTP模型，不是外部T6。预验源码hash随后变更，不能拿作最终交付证据。
- 真实MCP schema在registry之前拒绝不合法envelope的路径尚待检查/修正；现malformed3测试直调registry，不可称为实际sidecar覆盖。
- strict取消/坏JSON/错ID的临时独立probe已在当前候选无skip，仍需正式wire、deadline、清理错误、记录/failure Tape/策略篡改门槛与最终三路复查。
- 例子配置、每板20受限seed与全部技能正分支、完整SDK/ACP/MCP/混合双语矩阵、最终catalog冻结后Tape、前端实际browser/PNG及原12交付登记尚未完成；未提交这一候选角色。

共享失败策略已独立提交1d6124e，见[正式审查](p7-strict-turn-policy.md)；MCP早拒/失败落档和绝对截止/最终交付旁路已修。此候选记录上方保留首审历史，不把早期预验当最终交付证明。例子六/十二牌组及参数/组合限制15/46通过，Aw仍未提交或verified；随后完成40seed、60双语完整局矩阵与呈现。P7黑市商人、P8–P10、64/22矩阵、长局/T6目标不变。
