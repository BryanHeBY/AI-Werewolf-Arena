# 秘密之身夜间来源与事实发布

本批将 PhaseManager 原完整 58 行最终秘密之身处理交给具体机制 `night-damage-publication.ts`。原三个输入引用：来源字典、死亡名单与运行 World／事件保留；旧 `noble_secret_body/ports` 公共入口提供该具名操作，阶段经理在同一配置条件和原检查点同步调用。

## 责任与顺序

机制先调用原 authority 折叠已付保护，再原地替换来源字典和死亡名单。阻断存在时，按原顺序查询 actor、构造 payload、写空受众事实、记录必需操作；之后再次查询 actor，写完整来源事实及必需操作，最后写可选伤害诊断。字段键序、字典／数组身份、晚 getter、事件接收方及失败前缀保留。

这里不提前冻结来源、标死或检查胜负。猎魔来源、侍从到期、名单原生命核对与后续死亡链仍在原检查点；保护库存、付款、知识与原体由 authority 持有。上帝来源事实的死因字典仍是原引用，死亡名单仍取当时副本，空受众不向玩家披露。

## 有界验证

真实基线 `e694b827d11ee56c5fccdcd8684d42aa0b9b74fa` 的两份旧文件完整字节与捕获 before 相同。证明核对实际新函数整个主体的 565 个 AST/token 节点，阶段经理保留程序 11,990 节点及公共端口原程序 323 节点；三区域的 ESNext／CommonJS 六份映射输出相同。未将旧主体填回新 owner 后自证。

三 root 有限类型：`f9b45f` 启动 session17063，实际 `3d1d2a` 终止退出 0。既有两项猎杀清除与发布失败／成功隐私场景执行一次，`808a97` 退出 0，日志为 2 通过、35 次断言。未新增实现镜像测试、修改旧 expected 或重复全量门禁。

三份中文职责头零诊断。最终 owner 静态声明值依赖有限 146 个模块，不回到 PhaseManager 或 AI；只解析相对路径及 workspace 公开出口，不执行 npm、动态 import 或所有首次加载入口。新增函数、运行 getter 载体、模块路径、调用栈和严格构建身份会改变，不保证这些反射细节等价。

[机械证据](generated/noble-night-damage-publication-proof.json)及[冻结清单](generated/noble-night-damage-publication-scope-final.json)限定本批三源。I01、整个夜间来源组合和 P5 仍需继续，不以这次提取标记完成。
