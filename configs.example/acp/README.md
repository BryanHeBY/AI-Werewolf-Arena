# ACP 文件与环境隔离

`runtime/backends.json`中的`your-acp-agent`只是接入占位符。ACP工具授权和玩家cwd都不是操作系统沙箱。需要文件隔离时，可将本目录的`run-bwrap-acp.sh`复制到操作者自己的工具目录，并在`items.<backend>.config.command`写该脚本的绝对路径，args填写已安装的ACP adaptor绝对路径及参数。无需覆盖现有runtime、认证或人格。

此模板针对Linux和已安装的`bwrap`：从空文件系统挂载系统运行库、DNS和证书；当前玩家workspace可写，私有HOME、CODEX_HOME及CLAUDE_CONFIG_DIR临时独立；宿主环境清空后只传明确列出的变量。workspace必须是独立玩家目录；模板拒绝显然过宽的根目录，但不会证明目录内部没有人为复制的God或同行文件。网络保留，以访问模型和后端127.0.0.1 MCP控制面，不构成网络出口隔离。

## 挂载与变量

| 变量                         | 用途                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ACP_RUNTIME_ROOT`           | 只读挂载独立的adaptor安装目录；该目录只存工具及依赖，不存对局档案或凭据                                  |
| `ACP_READONLY_ROOTS`         | 冒号分隔的只读依赖目录；不挂整个仓库、configs、record、宿主home或其它玩家目录                            |
| `ACP_MCP_RUNTIME_EXECUTABLE` | 后端自动注入实际Bun/Node；模板只读挂载其真实可执行文件所在目录                                           |
| `ACP_AUTH_SOURCE`            | 可选：明确授权的单份认证文件，使用绝对路径；不挂整个认证目录                                             |
| `ACP_AUTH_KIND`              | `codex`默认映射到`/opt/codex-home/auth.json`；`claude`映射到`/opt/claude-home/.credentials.json`，均只读 |
| `ACP_ENV_ALLOWLIST`          | 冒号分隔的具名环境变量；缺席不传。HOME、PATH、XDG及ACP控制变量不可覆盖                                   |

游戏MCP的只读依赖示例是仓库的`backend/src`、`backend/node_modules`、`node_modules`和`packages`。workspace链接的目标也必须挂载，只有node_modules链接本身不够。独立adaptor若依赖另一位置的Node、Codex或Claude可执行文件，也需显式挂其运行目录。新增挂载会扩大Agent的可读范围，必须逐项检查，不能为修缺包改成`--ro-bind / /`。

Codex通常需要具名传递`CODEX_PATH:CODEX_CONFIG:INITIAL_AGENT_MODE:NO_BROWSER`；Claude Code通过智谱等兼容服务接入时，按实际配置具名传递`ANTHROPIC_BASE_URL:ANTHROPIC_AUTH_TOKEN:ANTHROPIC_MODEL`等所需变量。密钥放在操作者本地环境或只读单文件中，不写入本模板、命令行或归档。脚本不自动继承宿主代理、SSH socket或其它Provider密钥。

## 已验证范围

```bash
bun --no-env-file test backend/tests/integration/agents/acp/sandbox-canary.test.ts
```

本机真实bwrap探针使用合成文件与假认证，验证同行、God、宿主home及认证原路径不可读，唯一认证映射可读但不可写，自己的workspace可写，未授权变量不可见；另在相同隔离入口运行实际游戏MCP，完成三工具发现与合成回合提交。没有读取个人认证、启动Codex／Claude模型或消费付费服务。未安装bwrap或非Linux平台明确跳过这组操作系统探针，不能算隔离验证通过。

这证明模板与所列最小依赖的边界，不证明操作者任意新增的挂载、环境、adaptor或模型配置都已隔离；真实模型评测需使用经过单独检查的最终配置。
