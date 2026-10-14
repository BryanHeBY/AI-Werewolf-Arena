# 猎魔夜间来源折叠与事实发布

本笔将 PhaseManager 两个完整猎魔专用业务段归到 `roles/demon_hunter/night-damage-contribution.ts`：毒来源覆盖、守／救碰撞与狩猎来源追加，以及最终取消／免疫事实和可选诊断发布。经理保留两个原调用位置，仍拥有夜间时钟、生命周期收尾、真实死亡和判胜。

## 范围与并行来源

五个源码：PhaseManager、NightPipeline、猎魔 `ports.ts`、新业务 owner、一个新增单元测试。没有修改原生控制器、authority、保护付款或死亡结算。

先保存了真实 `d964fa2b` Git 与当时工作字节；PM／NightPipeline 的工作字节包含另一笔恶夜骑士候选，未宣称它们等于当时 Git。恶夜骑士实际提交 `d9be88a2` 后，再捕获两个共享文件与该 Git 整字节相等的基线，仅精确写入两个调用点和一个纯类型路由。两层来源均保存在 generated 证据中，没有覆盖恶夜骑士增量。

`DemonKnifeProtection` 是原 readonly 五字段声明的唯一具名 owner。NightPipeline 只从本族公开端口导入类型，原捕获与运行查询体不动。新 owner 的 `DeliveredDemonNightSources` 是纯类型导入；控制器的动态 loader 和初始化入口保持原样。

## 实际职责与顺序

1. `appendDemonNightDamageSources` 在原位置修改同一 `proposedSources`／`guardOverrides`。逐项毒覆盖后，保护对象仍读取两次；守护方法保留原 receiver，守护记录先于救药查找写入。
2. 救药覆盖优先于原 heal／当前 HealMark。窄查询采用惰性目标，保留原 callee 查找、World getter、目标 getter 和可选刀来源调用的顺序。无回调时不读取该调用的目标。
3. 守／救的原碰撞规则以及狩猎／反噬追加不变。原控制器的毒覆盖继续决定独立未知毒来源；本笔不新增 schema 或拒绝政策。
4. 两个调用之间仍执行夜仆到期／正常关闭、原生命筛选、原来源当前性筛选，以及秘密之身最终折叠。
5. `publishDemonNightDamageSources` 在这段夹层之后依次发布取消、每个毒免疫事实，再写原可选诊断。空受众事实保持上帝信息；日期、字段次序及事件 payload 副本保持，诊断保留来源字典与守护数组原引用并复制当时死亡名单。

本族权威／原生控制器继续拥有 opaque token、原体资格和资源付款；新 owner 不获取任意可写 World，不标死、不查询新 current、不新增 await／RNG。来源覆盖、守护记录及前面事件已写入之后发生的异常原样传播，不回滚前缀。事件发布错误也不会被可选诊断吞掉。

## 中文维护与边界

新 owner 的职责头、五字段数据契约、惰性读取、毒覆盖含义、守／救碰撞与失败前缀都有就地中文说明；猎魔公开端口补充两个检查点的顺序与写权边界。五个实际职责头检查与中文存在性检查均为 0 诊断；这不替代语义审查，也不是全仓门禁。

新增公开函数及同步调用帧会改变源码、加载边与栈反射；不承诺任意 CommonJS 命名空间重赋值或私有布局反射等价。新 owner 的三个运行依赖均为既有公共事实／记录入口，不运行导入原生控制器。207 个当前静态值模块的有界图没有从新 owner 返回端口或 PhaseManager；未用此结果声称历史完整首次加载图等价。图捕获后 Root 独立补 Noble `damage.ts` 中文注释，该依赖 hash 的变化归其纯注释切片；图证据保留捕获时字节，不宣称它是全部最终工作区快照。后端源码变化影响当前指纹输入，未改历史档案身份。

## 有界验证

- 新增 3 个字面用例：惰性 getter／receiver、救药查找失败的已写前缀、第二个事实发布失败的事件前缀；一次执行 **3／0／32**。
- 既有实际流水线仅运行两个精准场景：普通守救碰撞仍致死、原生免疫后仍保留独立普通毒；一次执行 **2／0／5**，47 例过滤。合计 **5 个不同用例、37 个断言，分两次执行**。
- 五根有限类型首轮只有新增测试的 3 个诊断。仅补 getter 返回类型和两个擦除断言类型后，失败的一根检查实际终态为 0；新测试两种完整 JS 输出不变，没有重跑已绿用例。
- 原两个完整业务体共 481 个非注释 token；仅声明的两处窄查询和事件 receiver 作逆向展开。PM、NightPipeline、端口其它程序及原五字段类型完整比较通过；两个故意修改非首子节点的负例被识别。
- 12 份完整 ESNext／CommonJS 输出：10 份原字节相同；折叠体的两份输出存在布局差异，但完整 emitted 程序 token 相同，明确不宣称两份 raw 同。原控制器／权威等 5 个控制源保持原字节。

未运行全量门禁、全测试矩阵、模型、浏览器或完整复盘。类型首红及三次证明 harness 修正均保留：空串导入逆向锚点、原尾逗号、布局差异验收；没有为证明改动生产算法。

## 持久证据

- [最终五源范围](generated/demon-night-damage-contribution-scope-final.json)
- [证据与真实终态](generated/demon-night-damage-contribution-evidence.json)
- [完整程序证明](generated/demon-night-damage-contribution-proof.json)及其同名 `.cjs` 脚本
- [实际绑定与有界静态图](generated/demon-night-damage-contribution-bindings.json)
