# 请求自有的截止时间别名传播

## C18 实施边界

runner、LLM、ACP 的十项机制继承清单迁到原请求的既有 `request_delivery` WeakMap 元数据。每个机制仅在本地请求绑定和原 guard 成功后登记自己的继承函数；同一函数按身份去重，执行顺序保持 Wall、Initial Identity、Wild Child、Lonely Girl、Ghost Bride、Demon Hunter、Demon native potion、Noble/Secret Body、Fragrant Pair、Animal Dream。

实际权限仍在各机制的原 map、envelope、scope 和 current predicate。登记路由不授予 guard、completion 或机制权限；成功的别名由机制自己登记后续路由，失败的别名没有后续传播入口。原手动继承 API 保持可用。

原 delivery guard 的 completion 继续指向同一 scope，待完成回执继续存在原 settlements WeakMap；settlement 先删除回执再调用回调。继承回调抛错时，停止后续回调，各机制原 catch 与部分写入顺序保持。Ghost Bride 仍先写本地 map，再绑定 guard；只有 guard 成功才登记路由。

## 执行与数据

runner 的截止时间计算和 budget 写入仍先于 shallow spread；`deriveBoundedRequest` 接收已经计算好的绝对期限。LLM/ACP 保留原对象表达式，先 spread 请求，再计算 deadline，之后调用 `inheritRequestAlias`，避免改变 getter 的求值顺序。计时器、重试预算、关闭及错误聚合的 owner 不变。

所有回调、权限和 completion 只存在运行时 WeakMap，不进入请求 context、MCP、JSON、checkpoint 或 Tape。本切片没有改变归档格式，也没有改变 F02 的 Noble 恢复行为；单调撤权修正在独立 C18a 实施。

## 验证范围与限制

十个 owner 和三个 consumer 的 AST 程序排除明确的 import、路由登记、清单替换和单语句分支包裹后相同。新增五项局部测试覆盖路由与权限分离、回调顺序和抛错前缀、别名链、同 completion、settlement 抛错及真实 Noble 外来 context/关闭；原十四项 characterization 保持通过。

正常入口生成的是 plain bounded clone。旧清单对没有本地绑定的 Noble/Fragrant 仍执行一次 deadline descriptor 读取，新路由跳过这两个未登记函数；不将其称为任意被修改 builtins 或任意手工 Proxy target 的完整等价。旧手工 API 保留其原读取和拒绝语义。全量对局与传输验收集中在 P3 大阶段收尾。

本切片完成统一传播及三个实际 consumer 接线。C19 的预检/实际提交职责、C20 的复杂机制状态迁移和 C44 的旧内部出口退出仍需分别实施。
