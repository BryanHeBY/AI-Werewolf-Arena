# Runtime Game Configs

当前运行时配置以 `game` 为入口，不再使用独立 `board` 配置目录作为主路径。

## 主配置位置

1. `${GAME_CONFIGS_DIR}/games/<game>.json`
2. 默认 game 名称由 `GAME_CONFIG_NAME` 控制（默认 `default`）

示例：

1. `configs/games/six_qwen.json`
2. `configs/games/twelve_minimax.json`

## 设计原则

1. `game` 是“完整对局配置单元”（包含 agent 选择、运行参数、板子选择等）。
2. `board` 在实现层仍是内部字段，但不建议作为外部 API 主参数。
3. 对外接口与脚本优先传入 `game`，减少概念分裂。

## 相关文档

1. `docs/specs/backend/foundation/runtime/runtime_config_spec.md`
2. `docs/apis/session_rest_api_v1_spec.md`
