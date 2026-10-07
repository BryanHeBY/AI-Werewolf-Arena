# I03 公开复盘 v2 与旧文件读取

## 数据格式

新的replay.json使用`schemaVersion: 2`，保留god视角、sessionId/meta/result/players/events。meta.locale仅在运行者提供已知游戏语言时保存，缺省不猜测。语言字段不包含认证、模型配置、环境或随机种子。玩家昵称与事件原话仍原样保存。

共享`@ai-werewolf-arena/replay-contract`拥有类型、版本协商及读取转换，浏览器/视频不依赖后端引擎。`assertReplayDocument`校验新canonical v2；处理外部/旧文件必须使用`readReplayDocument`。新writer也调用同一assert，后端导出和前端加载使用同一reader。

## 兼容政策

| 输入 | 处理 |
| --- | --- |
| 无schemaVersion | 既有完整god格式按旧版读取并显式转换为v2 |
| schemaVersion=1 | 与无版本格式相同的旧契约 |
| schemaVersion=2 | 校验结构后复制，不根据中文文字猜旧格式 |
| 其他数字/非整数/string/null | unsupported_version明确拒绝，不降级为旧版 |
| 仅events的旧timeline、其他perspective或嵌套字段损坏 | 拒绝，不猜整个schema |

转换只在声明位置用精确历史别名：players.role/camp、result.winner/reason、events.phase/stage；phase_changed的payload.phase/winner/reason、game_over的winner/reason，以及god_private_game_info.players的role/camp。原有ID仍保留，未知历史ID/名称也保留。别名不使用substring/trim/fuzzy匹配，不扫描任意payload。角色别名使用v1历史快照；工作显示名调整时仅追加新别名，不替换或删除旧拼写，不实时依赖当前工作名称。

以下内容不转换：name、text、人格、wolf_discussion_ended.reason、自爆等玩家理由、未知事件的任意嵌套payload。即使文字正好是“狼人全部出局”或“夜晚”，也不能从字段名称猜其业务身份。已知64角色的名称归一化仅使旧记录可读，不授予未实现角色运行许可。

返回对象复制源数据，导出写目标文件，不改写record中的旧replay.json；输出指向原路径或同inode的软/硬链接时明确拒绝。重复读取转换后的v2稳定；旧文件没有locale时不假称它是中文/英文。canonical字段允许未知历史字符串值以保有阅读性；当前引擎和主动配置仍负责合法机器ID与执行权限。

## 与其他记录的边界

公开复盘旧档可通过reader继续展示，不能套用内部动作Tape的严格引擎/锁/RNG一致性规则。reproduction.json继续独立版本和sourceHash政策，语言由其metadata显式带入复现World，再导出相应locale；英文内部复现入口同样保留P3未完成时的明确gate。公开文件不包含这份私有Tape或随机种子。

本笔先交付公开writer/reader/版本与手工fixture，私有player turn/initial prompt的phase/stage机器化、请求展示MessageRef及其录制schema迁移在I03下一笔处理；I04再交付语言/时区UI与视频。英文runner仍等待P3全链路完成，不因公开reader支持locale而提前开放。

## 验证

`packages/replay-contract/fixtures/legacy-localized.json`是手工合成旧档：同时含精确别名、未知角色/阶段、用户名“玩家1”、与结果原因同形的夜聊理由和原话。验证转换前后字段/事件数/顺序/序号不丢，用户原文与未知值不变，输入不变；v2不做旧版猜测，未来或畸形版本拒绝。

后端导出与浏览器实际加载同一fixture，原文件字节保持不变。当前引擎完整对局、模拟、内部动作复现以及前端投影/播放测试继续回归，必要workspace依赖仅新增内部game-catalog链接。
