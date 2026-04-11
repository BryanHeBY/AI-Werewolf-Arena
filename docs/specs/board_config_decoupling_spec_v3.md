# Board Config Decoupling Spec (V3)

## 背景与目标

当前 `board_config_resolver` 同时承担了：

1. 文件读取与合并；
2. 业务规则映射；
3. 角色/机制耦合裁剪（如 `hasWitch`、`enableSheriff`）。

这会导致解析器持续膨胀，并把角色/机制细节硬编码进框架层。

本次目标：

1. 统一配置文件结构，提升可读性；
2. 让角色与机制配置“就近绑定”到对应模块；
3. `board_config_resolver` 只负责读取/解析/合并，不再写角色机制特化逻辑；
4. 维持向后兼容（老配置结构仍可读取）。

## 新配置结构（推荐）

```json
{
  "board": {
    "size": 12,
    "roleSetups": [
      { "role": "wolf", "count": 4 }
    ]
  },
  "rules": {
    "revealOnDeath": true,
    "winConditions": ["slaughter_side", "wolf_reach_half"],
    "hooks": {
      "onDaybreak": true,
      "onPreElection": true,
      "onPreVote": true,
      "onPerSpeechGap": false
    }
  },
  "mechanisms": {
    "sheriff": {
      "enabled": true,
      "voteWeight": 1.5,
      "tieBreaker": "min_seat"
    },
    "selfDestruct": {
      "enabledWindows": ["on_pre_vote"]
    },
    "tieBreaker": {
      "exileVote": "min_id",
      "wolfKillVote": "min_id"
    }
  },
  "roles": {
    "witch": {
      "selfHeal": "disabled"
    }
  }
}
```

## 角色/机制解耦策略

新增“配置规范化注册器”：

1. `board_config_resolver` 输出合并后的 `BoardConfig`；
2. 交给 `ConfigNormalizerRegistry` 做业务裁剪；
3. 各角色/机制在自己目录注册 normalizer。

示例：

1. `roles/witch/config_normalizer.ts`：无女巫时移除 `config.witch`；
2. `sheriff/config_normalizer.ts`：未启用警长时移除 `config.sheriff` 与 `tieBreaker.sheriffVote`；
3. `self_destruct/config_normalizer.ts`：无窗口时移除 `config.selfDestruct`。

## 兼容策略

读取时同时支持：

1. 新结构（`board/rules/mechanisms/roles`）；
2. 旧结构（直接平铺 `BoardConfig` 字段）；
3. 聚合结构 `game-config.json` 的 `boards.<board_name>`。

输出始终归一成 `BoardConfig` 给引擎使用。

## 提示渲染策略

提示渲染不再自行推断角色挂载状态（例如扫描 `roleSetups`）。

统一基于“规范化后的 `BoardConfig`”渲染：

1. `config.witch` 存在才渲染女巫配置；
2. `config.tieBreaker.sheriffVote` 存在才渲染警长投票平票策略；
3. `config.selfDestruct` 存在才渲染自爆机制。

## 验收标准

1. `board_config_resolver` 中无角色特化判断（如 `Role.Witch`）；
2. 角色/机制裁剪逻辑迁移到对应模块 normalizer；
3. `configs/boards/*.json` 迁移为新结构；
4. 6 人局配置无自爆配置，且不会渲染自爆机制；
5. 编译通过，关键回归测试通过。
