# P9d 寻香识命：共享序列化契约

前置 `fa588f9`；正式仍50/64，两角色planned。本批仅建立独立前端／后端可导入的数据契约，未注册领域事件、工具、角色、阶段、提示渲染或公开板子。

`packages/game-text/src/fragrant-pair-seer.ts` 持有唯一policy、目标对／聚合双查类型、已授权知识类型与reader，以及选择、双查、真实夜初通知、God到期／实际触发五种严格单条事实。领域 `state.ts` 复用共享policy／Pair，`knowledge.ts` 保留状态推进和Node原始输入边界，先用 `snapshotPlainData` 拒绝Proxy／访问器，再调用共享knowledge reader；不在两处维护相同schema。

事实解析只证明单条数据形状。God触发仍含私有root／追加目标、来源phase和initialWave，后续受众转换不得直接把该fact用于公开播报或玩家状态。核心事件注册、权限、实际发生和独立账本未由这些reader证明。

## 契约范围与有意差异

- 双查仅两名不同且升序号码、day和一个boolean，拒绝数量、单体阵营／角色／result或第三目标。
- 知识保留历史已知单狼、真实开夜、选择与activeBinding、已公开消费及knifeNotices；拒绝God触发字段、全狼表和剩余狼数量。所有返回数据与输入分离。
- 首夜eligible=true对任何历史位置均非法；领域通知转换也拒绝。完整活人夜初通知要求连续1..day刀资格历史，本板无复活且原活人每真实夜都通知。独立knowledge reader仍保留已开夜待抽取／待通知，以及死者后夜到期而不新增notice的合法前缀。
- 历史数组上限由256有意扩大至65536，与双查／绑定历史的有限上限统一，避免日次超过256时知识链单独不可读。没有声称接受集完全不变。
- 共享包浏览器reader处理序列化数据和普通getter，但不声明浏览器Proxy trap免执行；Node领域边界保留明确Proxy拒绝。共享包没有Node/domain反向依赖。

## 交叉审查与验证

A迁移差分／副本／getter／Node嵌套Proxy **5／0／117断言**，收紧前104个有限样本一致；整个game-text index浏览器打包43模块成功，见 `/tmp/awa-fragrant-shared-protocol-a-review.log`。有意收紧后再独立 **4／0／24断言**，`/tmp/awa-fragrant-shared-tightening-a-review.log`；上述两个时点区分记录。

R和T发现N1非法接刀可藏入N2历史，唯一共享schema修复并迁入维护。R原输入 **3／0／4断言**，`/tmp/awa-fragrant-r-wire-history-fixed.log`；T原输入 **4／0／13断言**，`/tmp/awa-fragrant-wire-history-review-fixed.log`。另核通知前／死者到期前缀未误拒，三路无剩余本片阻断。

搬迁初稿误把领域knife转换移入共享文件，首轮24pass／1fail／1模块error保留 `/tmp/awa-fragrant-shared-tests-first.log`；纠正后55pass／0，收紧后最终 **55pass／0fail／266断言**，`/tmp/awa-fragrant-shared-tests-final.log`。后端源码／测试及前端类型、源码lint、模块边界、格式另核。

测试类型检查另发现字面trigger被推断为可变number[]／string，修为显式共享fact类型；原类型错误日志 `/tmp/awa-fragrant-shared-types-final.log` 保留，最终源码／测试类型日志 `/tmp/awa-fragrant-shared-types-accepted.log`。

下一批独立原生双查能力／请求与配置、真实夜序／死亡链、各受众双语渲染、独立录制／Tape与实际通信／前端继续；不以纯协议测试替代完整角色交付，不推送。
