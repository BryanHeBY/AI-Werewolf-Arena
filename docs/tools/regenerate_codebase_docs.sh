#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

mapfile -t SRC_FILES < <({ rg --files backend/src; rg --files frontend/src; } | sort)

if [ ${#SRC_FILES[@]} -eq 0 ]; then
  echo "No source files found under backend/src or frontend/src"
  exit 1
fi

dir_desc() {
  local dir="$1"
  case "$dir" in
    "") echo "项目源码镜像根目录，聚合 backend 与 frontend。" ;;
    backend) echo "后端源码根目录。" ;;
    backend/src) echo "后端 V3 主代码目录，承载 ECS 域模型、串行状态机、网关与服务模块。" ;;
    backend/src/app) echo "应用装配层（bootstrap/container）。" ;;
    backend/src/domain) echo "V3 ECS 域层（模型、组件、系统、世界）。" ;;
    backend/src/domain/components) echo "V3 组件定义（Role/Camp/Alive/VotingRight/StatusMarks/Badge）。" ;;
    backend/src/domain/systems) echo "V3 规则系统（伤害结算、胜负判定）。" ;;
    backend/src/engine) echo "V3 严格串行流程控制与事件拦截。" ;;
    backend/src/engine/phase_pipeline) echo "V3 夜间/白天/投票流水线实现。" ;;
    backend/src/gateway) echo "Tool schema 注册、动作鉴权与输入清洗。" ;;
    backend/src/memory) echo "Prompt 组装与记忆分层存储。" ;;
    backend/src/scenarios) echo "V3 板子配置（6 人 MVP / 12 人标准局）。" ;;
    backend/src/v3) echo "V3 行为提供器与运行适配器。" ;;
    backend/src/server) echo "服务启动与 WebSocket 接入。" ;;
    backend/src/infra) echo "基础设施适配层（llm/logger/transport）。" ;;
    backend/src/infra/transport) echo "实时广播与传输适配。" ;;
    backend/src/config) echo "后端运行配置定义与装载入口。" ;;
    frontend) echo "前端源码根目录。" ;;
    frontend/src) echo "前端主代码目录，包含状态管理、组件、类型与样式。" ;;
    frontend/src/composables) echo "前端状态与通信组合式逻辑。" ;;
    frontend/src/components) echo "前端业务组件。" ;;
    frontend/src/components/ui) echo "基础 UI 组件聚合层。" ;;
    frontend/src/components/ui/badge) echo "badge UI 组件。" ;;
    frontend/src/components/ui/card) echo "card UI 组件。" ;;
    frontend/src/components/ui/scroll-area) echo "scroll-area UI 组件。" ;;
    frontend/src/lib) echo "前端工具函数库。" ;;
    frontend/src/types) echo "前端类型定义入口。" ;;
    *) echo "源码目录镜像节点。" ;;
  esac
}

file_desc() {
  local file="$1"
  case "$file" in
    backend/src/app/*) echo "V3 应用装配文件。" ;;
    backend/src/domain/components/*) echo "V3 ECS 组件文件，定义可挂载到实体的数据结构。" ;;
    backend/src/domain/systems/*) echo "V3 ECS 系统文件，处理阶段性规则计算。" ;;
    backend/src/domain/*) echo "V3 域模型与基础抽象文件。" ;;
    backend/src/engine/*) echo "V3 串行状态机与阶段流水线实现文件。" ;;
    backend/src/gateway/*) echo "V3 Tool 网关与鉴权实现文件。" ;;
    backend/src/memory/*) echo "V3 记忆与 Prompt 组装实现文件。" ;;
    backend/src/scenarios/*) echo "V3 场景配置文件。" ;;
    backend/src/v3/*) echo "V3 行为提供器与运行工具文件。" ;;
    backend/src/infra/llm/*) echo "V3 LLM 客户端封装与重试策略实现文件。" ;;
    backend/src/server/*) echo "后端服务/通信入口文件。" ;;
    backend/src/infra/transport/*) echo "V3 消息广播与传输适配实现文件。" ;;
    backend/src/infra/logger/*) echo "V3 日志记录实现文件。" ;;
    backend/src/config/*) echo "配置装载与导出文件。" ;;
    backend/src/run-test-v3.ts) echo "V3 本地运行/回归测试入口脚本。" ;;
    frontend/src/composables/*) echo "前端状态管理或通信逻辑文件。" ;;
    frontend/src/components/ui/*) echo "前端基础 UI 组件文件。" ;;
    frontend/src/components/*) echo "前端业务展示组件文件。" ;;
    frontend/src/lib/*) echo "前端通用工具函数文件。" ;;
    frontend/src/types/*) echo "前端类型定义文件。" ;;
    frontend/src/main.ts) echo "前端应用启动入口。" ;;
    frontend/src/App.vue) echo "前端根组件。" ;;
    frontend/src/style.css) echo "前端全局样式文件。" ;;
    *) echo "源码镜像文档节点。" ;;
  esac
}

todo_hint() {
  local file="$1"
  case "$file" in
    backend/src/domain/*) echo "- [ ] 扩展 ECS 组件与系统，覆盖白皮书更多角色与印记。" ;;
    backend/src/engine/*) echo "- [ ] 扩展中断钩子与复杂事件递归结算能力。" ;;
    backend/src/gateway/*|backend/src/infra/llm/*) echo "- [ ] 补齐 Function Calling schema 与错误回弹策略。" ;;
    backend/src/server/*|backend/src/infra/transport/*) echo "- [ ] 持续对齐前后端事件协议并补齐联调用例。" ;;
    frontend/src/composables/*) echo "- [ ] 对齐 V3 后端事件流，重构状态分发与恢复策略。" ;;
    frontend/src/components/*) echo "- [ ] 对齐 V3 字段变化，补齐状态展示与交互反馈。" ;;
    *) echo "- [ ] 按 V3 规范补齐职责边界与输入输出契约。" ;;
  esac
}

dir_todo_hint() {
  local dir="$1"
  case "$dir" in
    backend/src/domain) echo "- [ ] 建立组件/系统矩阵，覆盖 MVP 所有规则印记与结算。" ;;
    backend/src/engine) echo "- [ ] 建立完整阶段时序文档并与代码实现逐条对齐。" ;;
    backend/src/server|backend/src/infra/transport) echo "- [ ] 输出统一事件契约表（输入、输出、错误码）。" ;;
    frontend/src/composables) echo "- [ ] 建立前后端事件映射表并补齐重连恢复策略。" ;;
    *) echo "- [ ] 按目录职责补齐关键流程图与风险说明。" ;;
  esac
}

# Build directory set from source tree
TMP_DIRS=$(mktemp)
for f in "${SRC_FILES[@]}"; do
  d=$(dirname "$f")
  while [ "$d" != "." ]; do
    echo "$d" >> "$TMP_DIRS"
    d=$(dirname "$d")
  done
done
printf '%s\n' "" >> "$TMP_DIRS"
sort -u "$TMP_DIRS" -o "$TMP_DIRS"
mapfile -t DIRS < "$TMP_DIRS"
rm -f "$TMP_DIRS"

# Ensure docs directories exist
mkdir -p docs/codebase
for d in "${DIRS[@]}"; do
  [ -z "$d" ] && continue
  mkdir -p "docs/codebase/$d"
done

# Render directory README.md
for d in "${DIRS[@]}"; do
  if [ -z "$d" ]; then
    doc="docs/codebase/README.md"
    title="codebase 文档索引"
    node="codebase"
  else
    doc="docs/codebase/$d/README.md"
    title="$d 文档索引"
    node="$d"
  fi

  # parent link
  parent_line="- 上级节点：无（根节点）"
  if [ -n "$d" ]; then
    parent=$(dirname "$d")
    if [ "$parent" = "." ]; then
      parent_line="- 上级节点：[codebase](../README.md)"
    else
      parent_line="- 上级节点：[${parent}](../README.md)"
    fi
  fi

  # child dirs
  mapfile -t child_dirs < <(for cand in "${DIRS[@]}"; do
    [ -z "$cand" ] && continue
    pc=$(dirname "$cand")
    [ "$pc" = "." ] && pc=""
    if [ "$pc" = "$d" ]; then
      echo "$cand"
    fi
  done | sort)

  # child files
  mapfile -t child_files < <(for f in "${SRC_FILES[@]}"; do
    if [ "$(dirname "$f")" = "${d:-.}" ]; then
      echo "$f"
    fi
  done | sort)

  {
    echo "# $title"
    echo
    echo "## 1. 当前代码详细文档"
    echo
    echo "- 节点路径：\`$node\`"
    echo "- 目录职责：$(dir_desc "$d")"
    echo "$parent_line"
    echo "- 关联规范：\`docs/specs/backend_architecture_whitepaper_v3.md\`、\`docs/specs/v3_mvp_requirements.md\`"
    echo
    echo "### 子目录"
    if [ ${#child_dirs[@]} -eq 0 ]; then
      echo "- 无"
    else
      for cd in "${child_dirs[@]}"; do
        name=$(basename "$cd")
        echo "- [$cd](./$name/README.md)"
      done
    fi
    echo
    echo "### 子文件"
    if [ ${#child_files[@]} -eq 0 ]; then
      echo "- 无"
    else
      for cf in "${child_files[@]}"; do
        bn=$(basename "$cf")
        echo "- [$bn](./$bn.md)"
      done
    fi
    echo
    echo "## 2. 未来目标 TODO"
    echo
    dir_todo_hint "$d"
    echo "- [ ] 为目录下每个文件维护“导出项 + 依赖项 + 测试覆盖”状态。"
    echo "- [ ] 代码改动后同步更新本目录导航与职责说明。"
    echo
    echo "## 3. 验收标准"
    echo
    echo "- [ ] 子目录/子文件导航与真实源码结构一致。"
    echo "- [ ] 目录职责可帮助开发者快速定位改动入口。"
    echo "- [ ] 本目录引用的规范链接有效且与当前阶段目标一致。"
  } > "$doc"
done

# Render file docs
for f in "${SRC_FILES[@]}"; do
  out="docs/codebase/$f.md"
  mkdir -p "$(dirname "$out")"

  lines=$(wc -l < "$f" | tr -d ' ')
  ext="${f##*.}"
  fdesc=$(file_desc "$f")

  mapfile -t exports < <(rg -n "^[[:space:]]*export[[:space:]]+" "$f" || true)
  mapfile -t imports < <(perl -ne 'if(/^\s*import\s+(?:.+?\s+from\s+)?["\x27]([^"\x27]+)["\x27]/){print "$1\n"}' "$f" | sort -u)

  {
    echo "# $f"
    echo
    echo "## 1. 当前代码详细文档"
    echo
    echo "- 源码路径：\`$f\`"
    echo "- 文件类型：\`$ext\`"
    echo "- 当前行数：\`$lines\`"
    echo "- 文件定位：$fdesc"
    echo "- 上级目录文档：[README.md](./README.md)"
    echo "- 关联规范：\`docs/specs/backend_architecture_whitepaper_v3.md\`、\`docs/specs/v3_mvp_requirements.md\`"
    echo
    echo "### 代码内容简介"
    echo "- 当前文件属于 V3 主线实现，是后续扩展与联调的直接基线。"
    echo "- 迭代时优先比对本文件导出项、依赖项与阶段职责。"
    echo
    echo "### 对外暴露类型/接口/函数"
    if [ ${#exports[@]} -eq 0 ]; then
      if [ "$ext" = "vue" ]; then
        echo "- 本文件未使用显式 \`export\`（SFC 组件通常通过 \`<script setup>\` 暴露能力）。"
      elif [ "$ext" = "css" ]; then
        echo "- 样式文件，无 TS/JS 导出符号。"
      else
        echo "- 未扫描到显式 \`export\`，请结合调用方确认是否为内部模块。"
      fi
    else
      for ex in "${exports[@]}"; do
        echo "- \`$ex\`"
      done
    fi
    echo
    echo "### 关键依赖（import）"
    if [ ${#imports[@]} -eq 0 ]; then
      echo "- 无显式 import（或由构建工具注入）。"
    else
      for im in "${imports[@]}"; do
        echo "- \`$im\`"
      done
    fi
    echo
    echo "## 2. 未来目标 TODO"
    echo
    todo_hint "$f"
    echo "- [ ] 补齐函数级输入/输出/副作用说明。"
    echo "- [ ] 补齐该文件的测试覆盖现状（单测/集成/E2E）。"
    echo "- [ ] 源码发生 export 或 import 变更时，同步更新本文档。"
    echo
    echo "## 3. 验收标准"
    echo
    echo "- [ ] 本文档中的导出项与源码实际 \`export\` 保持一致。"
    echo "- [ ] 关键依赖列表可支持重构时进行影响面分析。"
    echo "- [ ] 通过本文档可定位该文件在 V3 重构中的责任边界。"
  } > "$out"
done

echo "Regenerated docs/codebase for ${#SRC_FILES[@]} source files."
