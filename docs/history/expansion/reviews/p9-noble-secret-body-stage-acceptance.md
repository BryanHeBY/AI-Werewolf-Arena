# P9d 觉醒之夜有限板完整技术验收

本批登记夜之贵族与觉醒愚者为 implemented，仅支持[规则卡](../../rules/awa-noble-secret-body-twelve-v1.md)的四份精确原生十二人政策组合。目录达到23 verified、27 implemented、14 planned，50/64。P9d寻香魅影／觉醒预言家、P9e六项、P9f余六项及P10继续；不推送，不把功能门禁当用户最终验收。

## 功能与独立交叉审查

- [运行](p9-noble-secret-body-runtime.md)：真实夜序／原生命／库存，跨夜夜仆、猎魔清除、同步到期、秘密之身单来源抵伤及活人翻牌；两项政策四组合、错误而非虚构兜底。
- [独立录制](p9-noble-secret-body-recording.md)：从原决定／操作／请求开启游标推导契约、来源及知识，逐CP校验和严格Tape；死者与未来回合资格反例，原夜序自爆跳夜CP补修。
- [实际通信](p9-noble-secret-body-transport.md)：15字面族／四组合，SDK HTTP、ACP子进程／MCP、mixed双语，必答missing／late、实际完整messages／初始化／历史／schema及知情延迟。
- [观察模拟](p9-noble-secret-body-observed-simulation.md)：四政策×两策略×中英160局、逐局Tape，非空选择／抵伤／闭约及纯DTO边界；各轮重叠不相加成唯一种子数。
- [前端](p9-noble-secret-body-frontend.md)：实际64档、God工作台与最小授权玩家movie、frame／seek、Chromium及中英Remotion截图。公开翻牌不误记死亡，玩家公开警长summary赋徽。
- [窗口与撤权](p9-noble-secret-body-windows.md)：24真自爆、12拒绝更正、20真实回复后提交前换原生命失败；严格失败Tape只重放标准前缀，不重演隐藏supervisor替换因果。
- [最终提示／空过收尾](p9-noble-secret-body-badge-repeat.md)：修公共警徽矛盾，六局跨传输实际提示及64重新导出档；四政策八局select→pass→原目标重选，R/T原意见已闭。
- [模拟端点所有权](p9-noble-secret-body-loopback-fixture.md)：每局模型fixture随机token，在解析之前拒旧控制探针；确定性真实同端口复用，strict probe及生产控制server未修改。

R、A、T/L/D分别核冻结规则、资源／原生命／独立账本、schema／初始化／current／历史／错误／实际玩家档及文案。原发现与字面反例在各切片维护，修正由原审查者复验；最后R空过缺口、T警徽P2及A端点交互均闭合。临时目录的下一板纯状态草稿不计入本板证据或角色完成数。

## 最终冻结输入与实际门禁

HEAD `c5bf3b173f12af4536e43372b7e4c1b83c174c26` 加两项目录的status／规则卡候选，源码、测试、64新档、公开配置和docs全部冻结2200文件。输入before／after／after-on-exit字节一致：

`285d0c8ec4386536469c39b2bd4ee5fbe389d29c53fa8bd418100214c59b4ff4`

目录 `/tmp/awa-p9d-noble-candidate-full-fourth`，驱动 `/tmp/run-awa-p9d-noble-candidate-full-fourth.py`，Bun1.4.2、系统Chromium153.0.8010.52。driver SHA `4c1a4763ee12f151b2aee555775663ef51debdbcc673efcbb7af3aa4ef5f152b`，collector SHA `6d8861ed3400883f675d1f7052a5f0b79b459d198beb8f5bcce7c263cc6ec88d`。实际逐文件耗时输入SHA `4498db96cc64d0c3ed1473a2bf57d6c9cf31b3e63bfa54e9c625b97b66755a93` 仅作分片均衡，不改变范围。两个强制复用端口的文件在原七份资源文件前串行，分片完成后才启动。

| 门禁                           | 实际结果                                                |
| ------------------------------ | ------------------------------------------------------- |
| root类型／lint／格式／diff     | 全部退出0                                               |
| backend三分片154／154／154文件 | 2001／2168／2129通过，0失败，1条件skip                  |
| 九文件串行时序／端点／资源     | 55通过，0失败                                           |
| backend合计                    | 6353通过、0失败、1条件导出skip，471唯一文件，864120断言 |
| frontend全量unit               | 872通过、0失败，75文件，33623断言                       |
| mock smoke／双端build          | 全部退出0                                               |
| Chromium                       | 324通过，21spec，单worker／retries=0，5.6分钟           |

唯一skip为需显式开关的历史导出测试，不算导出执行通过。本板64档真实生成／重新生成另有明确日志及逐字节核验。整轮无重试、无失败后补跑混算。A最终独立审计 `/tmp/awa-p9d-noble-candidate-full-fourth/a-review-fourth-terminal.json` 核完整raw执行行／单次footer及命令，471后端与75前端文件各恰一次，Chrome原序号1–324各一次、全部21spec覆盖，13门禁退出0；三个manifest与重新采集的当前公开输入四方字节完全一致，driver／collector／timing指纹匹配。没有剩余本板技术验收阻断。

## 原失败留档与交付边界

第一轮在格式处退出；新增玩家JSON尚未被历史fixture排除规则覆盖，c9f17a0精确补排除且保字节。第二轮6296通过／1目录一致性失败／1skip，460文件，后续门槛未启动；同步候选目录后重起。第三轮6308通过／2模拟服务交互失败／1skip，463文件，后续未启动；旧控制端点有机会被无鉴权模拟SDK接管造成双向误报。日志不含端口，不声称已证明两项同socket；代码链及确定性回归在端点修正文档。三轮各自原日志和输入闭环保留，均不冒称最终第四轮通过。

验收后新增登记文档字节不冒称仍属于上述冻结指纹；另核角色目录、规则卡引用及格式／差异。本板支持固定屠边、初始波遗言、四组合和两自爆窗口，不放开额外复制、复活、第三方、任意新角色混搭。工作台仍是God视角；席位过滤不是权限切换，最小玩家movie使用真实授权timeline。编辑器由P10交付，JSON往返不算编辑器。

本批无用户configs／认证读取、计费模型或推送。真实模型T6需明确隔离配置和预算。P10另将收口公开ACP文件／环境隔离：裸宿主进程cwd并非文件边界；已确认的公开实现缺口不等于用户私人launcher已泄漏。立即继续下一有限板和其余角色，保持完整64项及P10目标。
