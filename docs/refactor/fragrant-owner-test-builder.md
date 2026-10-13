# 馥郁双生测试构造器归属

继续 C13，将最后一个 `tests/engine` 支持工具迁至 `tests/support/features/fragrant-pair-seer/builders/owner.ts`，删除旧 `fragrant_pair_seer_fixture.ts`。四个 authority／请求／状态槽／死亡预约单元测试仅修改导入路径。

工具保留字面角色 roster、World 组件写入、原生双验状态别名、安装前回调及真实 authority 选择提交。选择 helper 驱动生产逻辑，测试断言仍需独立书写，不能将 helper 的输出当作规则 oracle。组件写完后才执行测试回调并安装 authority，失败不回滚已完成写入。

此次补充了中文函数职责和关键顺序说明，并将一个触及的请求测试英文头准确译为中文；错误码、输入和断言保持。五个完整文件的 17 个相对路径精确迁移后，逆向运行输出十项原字节相同，五个职责头检查通过。

首有限类型检查在并行文案事实出口迁移期间捕获九条临时缺失出口诊断，不将其算作本迁移通过。五个根随后纳入稳定源码的 105 根有限合并检查，实际退出 0；没有重复执行旧测试或完整对局。独立审查与最终摘要见 [证据](generated/fragrant-owner-test-builder-evidence.json)。
