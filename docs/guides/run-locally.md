# 本地运行与配置检查

## 准备

使用根package.json声明的Bun版本安装依赖，先查看[配置契约](../contracts/configuration.md)。公开模板是configs.example，本地 configs、认证、ACP workspace 及 record 独立保存。

```bash
bun install
cp -R configs.example configs
# 仅在本地configs/runtime/providers.json填认证并核对Agent配置。
bun run --cwd backend config:check --configs-dir ../configs --game-config-name twelve_player_standard
```

检查输出是脱敏报告，不启动模型；错误不会回显原JSON。正常run不隐式fallback到examples或源码预设。没有授权时维护／验收工具不读取秘密配置，也不执行真实模型。

## 对局

```bash
bun run --cwd backend run:six
bun run --cwd backend run:twelve
bun run --cwd backend run:twelve:acp
```

这三条会按本地配置启动真实Agent，可能有网络／模型费用或外部进程。运行前需确认本地配置及预算。先确认provider、并发／初始化预算、Agent命令和输出根，再由操作者主动运行。

名字／人格与模型选择分开。选择优先级是席位→角色→默认；显式null清除人格，缺席继承，原字符串不翻译。不同玩家即使同provider也各有信息与工具权限，provider key不是整个机器的全局配额。

## 旧配置显式迁移

```bash
bun run --cwd backend config:migrate --configs-dir ../configs
# 核对预览后，操作者可加--apply；不复制examples覆盖本地认证。
```

先校验再备份，目标独占发布。备份存在且字节不同应拒绝，不通过删除别人的文件或重试丢弃错误。完整参数仍以CLI帮助／实际parser为准。

记录与关闭失败应保错误；初始化失败或必需replay写失败使命令失败，不能只看最后一行日志判成功。
