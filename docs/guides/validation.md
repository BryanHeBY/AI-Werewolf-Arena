# 验证方法

## 按改动运行检查

先运行改动所属模块的测试及类型检查。跨机制、共享契约或资源时序变化，再补受影响的交互、完整对局和严格复现场景。多个大阶段结束后运行完整门禁；不要求每个小改动重复所有对局。

```bash
bun run lint:architecture
bun run check:fixtures
bun run check:tooling
bun run test:tooling
bun run check:packages
bun run test:packages
bun run --cwd backend test:unit
bun run --cwd backend test:integration
bun run --cwd backend test:scenarios
bun run --cwd frontend test
```

整体检查使用 `bun run check`、`bun run lint` 和 `bun run format:check`；完整测试入口为 `bun run test`。不要把根聚合任务及其子任务重复计作不同验收。

## 检查约束

- 架构门禁直接检查当前依赖、命名和职责注释，任何违规都失败，不读取旧提交或历史债务豁免。
- 夹具校验保留原始归档字节、稳定 suite 身份和真实导入约束。`tooling/refactor/fixtures/source-inventory.json` 是仍在使用的来源登记，清单中的旧路径只表示来源身份。
- 规则测试使用独立手写预期或明确冻结样本，不调用生产规则计算答案。
- 分别验证选择、准入、领域提交、付款、已付效果、告知与失败前缀；成功路径不能替代取消、迟到、别名失配或部分失败测试。
- 中文与英文核对消息 key、占位符、原始用户文本及玩家可见性；展示修改还需覆盖回退、时间、席位和逐帧投影。
- 测试和类型检查只使用公开配置与隔离的临时目录，不读取个人认证，不调用付费模型。真实 Agent 对局由操作者显式运行。

## 浏览器与媒体

```bash
bun run --cwd frontend test:e2e
bun run build:backend
bun run build:frontend
```

浏览器和渲染使用已安装的 Chromium；需要时通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定。隔离的 `TMPDIR` 使用短路径，避免 Chromium 的 Unix socket 超出路径长度限制。

媒体检查按实际输出语言运行，读取 PNG／MP4 的尺寸、帧率和时长，并人工查看图片及视频关键帧。文件存在或命令退出为零不等于画面正确；样本通过也不代表所有角色或组合都被验证。

## 结果记录

在提交或 CI 中记录实际运行命令、失败、跳过原因和支持范围。重试保留首次失败原因，不叠加重复用例。旧记录的可读性与严格同构建复现分别按[归档兼容契约](../contracts/archive-compatibility.md)验证，不修改旧指纹求通过。
