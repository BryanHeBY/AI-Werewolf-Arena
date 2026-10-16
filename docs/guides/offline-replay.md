# 离线模拟、复盘与视频

## 受限模拟与严格动作复现

```bash
bun run --cwd backend simulate --configs-dir ../configs.example --board twelve_player_standard --count 25
bun run --cwd backend replay:actions --record ../record/<session-id>/reproduction.json
```

模拟使用明确受限观察机器人和固定seed输入，不调用模型，也不证明原始God baseline符合玩家信息边界。seed仅固定随机流，模型原文和不同动作仍能改变结果。

严格复现读私有Tape并核真实source／lock／RNG／ruleset；不是公开replay播放器。源码路径／注释改变身份时拒旧构建是有效政策，不改旧hash或删掉字段求通过。

## 公开复盘

```bash
bun run --cwd backend export:replay -- --session <session-id> --out ./<session-id>.replay.json
bun run dev:frontend
```

播放器只读导出的公开God档，不给对局Agent新增底牌知识。公共reader支持已声明旧格式，不等于能运行旧Tape。manifest／逐玩家档含不同隐私与身份字段，不通过复制God文件模拟玩家视角。

前端视频／图片命令保其package.json和README中的实际参数，使用离线输入。不得覆盖已有目标或源文件；浏览器、渲染器和写盘资源按各owner关闭，必需产物错误应失败。修改展示后，双语词典key／placeholder／原文与实际video入口需各自验证。

fixture通过稳定origin／suite选择，loader根据manifest currentPath定位。组织slug更名只改current位置，origin key／archive字节／RNG seed不随之替换。

## 查看玩家思考与工具轨迹

游戏回放工作台下方的“玩家私有输出”支持显式导入 `record/<session>/players/player_7.json` 等玩家档案。文件只在当前浏览器内存中解析，不上传，不自动发现其它玩家文件，也不合并到游戏回放或视频。可用“清除私有档案”撤回内容。

分类、双语标签、开关和色调与终端共享：思考／消息为灰色，失败为警告或错误色；工具参数与回执可在逐轮详情中展开。玩家文件是独立档案，页面不把它假定为当前游戏的相同会话。旧档未明确区分思考与消息时显示“模型输出”，不会从正文猜测或生成思考。
