# P4 G03 死亡窗口授权子批交叉审查

## 范围

World持有的死亡授权、actor/tool/day/phase/generation与生命版本、实际消费点再次授权、SDK/ACP共同接收和最终gateway、stage变化关闭、原错与异常清理、内部Tape关联字段及受限DTO隐私。接口见[死亡窗口契约](../death-action-authority.md)。Alive死亡写入集中、初批遗言/徽章/追加波次及自爆收尾继续下一子批。

## 验证

- 初步专项33/548通过；初版完整门槛520/30811通过（类型/deps/边界/i18n/test/smoke），日志 `/tmp/awa-p4-g03-authority-release.log`。不把初版全绿当作独立竞态/生命周期/隐私缺陷已关闭。
- 三路审查修正后人工与既有专项50/845通过，日志 `/tmp/awa-p4-g03-authority-revision-targets.log`：真实resolver/gateway微任务撤销5类×shot/null，死→活→死中途无查询与组件替换，隐藏他人0/1/7窗口下DTO相同，原输入仍有效且预检不消费。
- 类型再次通过；前端54/365及类型通过，日志 `/tmp/awa-p4-g03-authority-front-{tests,type}.log`。未改画面/事件格式，没有重复视频或E2E门槛。
- 最终完整release门槛526测试/30955断言通过（类型/deps/边界/i18n/test/smoke），日志 `/tmp/awa-p4-g03-authority-release-complete.log`；含34实际SDK/ACP/混合双语六/十二基础完整对局及每局严格Tape。全部模型服务是合成本机服务，没有调用外部模型或用户认证。

## 独立审查与修正

| 审查者                     | 发现                                                            | 修正及复查                                                                                                      |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A / review_arch_tests      | callback finally早于Hook消费关闭，最终gateway后微任务撤销仍枪击 | 持有窗口直到完整onDeath完成，shot/pass带本次ID，同步消费点再次验World授权/运行clock；独立14/347，最终0阻断      |
| R+T / review_scope_rules   | 旧窗在复活再死后能再次通过，窗口generation未绑定生命            | Alive转换WeakMap内部版本及组件ref，永久失效旧窗，不依赖中途查询；新窗不受旧close影响，复查最终0阻断             |
| L+D / review_i18n_delivery | 全局递增授权ID原样进入Observation.request，泄露他人隐藏窗口数量 | 受限副本去ID、引擎/Tape留关联；两语不同hiddenCount观察全等，callback/生命周期API说明同步；独立14/347，最终0阻断 |

上述全部为本批实际问题，没有通过扩张scope或收窄保证绕过。版本信息在严格源码gate内，新增字段不自动兼容旧内部Tape。

三路最终0剩余阻断；复活再死、消费前竞态和隐藏窗口序号三项实际发现均关闭。
