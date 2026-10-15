# 日食夜间生命周期

`RadiantNightUnit` 持有流水线原 acquired 状态。begin 返回后才取得关闭责任；构造不读 World/events。正常 committed close 与 acquired finally abort 均在原位置调用原 frame，getter 每次委托给流水线当前字段。

正常关闭后，finally 仍按 World→events 顺序求值并调用 aborted close；只由原 frame 的 closed 判断负责 no-op。不能新增本地 closed 标志跳过这些读取：getter 在此抛错仍保留原错误前缀。关闭事实发布失败时，frame 已经 closed，finally 仍读参数但不重新发布。

原 frame、租借、抑制恢复、库存、已付效果、seal、PhaseManager 与录制均不改。public port 只具名导出原查询函数和具体 unit，没有通用清理框架或额外当前性检查。本批只收 pipeline 生命周期边界，完整 Radiant 迁移矩阵仍待后续完成。

五项新增、18 次断言及原借药库存/关闭一项、五次断言通过。有限类型检查退出 0；首次测试未按 GameEvent.type 收窄 status 的三处 TS2339 保留，改为事件类型 guard，生产契约未放宽。独立十二项实际 Git 源核对、四个职责头、八次冷导入通过，原公开函数引用保持；没有重复全量测试。
