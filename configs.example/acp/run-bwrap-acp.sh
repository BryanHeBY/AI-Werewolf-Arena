#!/usr/bin/env bash
# ACP隔离入口：空文件系统起步，只挂系统库、显式运行依赖和当前玩家目录。
# 网络保持可用以连接模型及127.0.0.1游戏MCP；网络访问不是文件读取授权。
set -euo pipefail
(( $# > 0 )) || { echo "usage: run-bwrap-acp.sh <server> [args...]" >&2; exit 64; }
workspace="$(pwd -P)"
case "$workspace" in /|/home|/tmp|/opt) echo "overbroad ACP workspace" >&2; exit 64 ;; esac
bwrap_bin="${BWRAP_BIN:-/usr/bin/bwrap}"
[[ -x "$bwrap_bin" && -d "$workspace" ]] || exit 69
mounts=()
for system_root in /usr /bin /sbin /lib /lib64; do
  [[ ! -e "$system_root" ]] || mounts+=(--ro-bind "$system_root" "$system_root")
done
# DNS和证书是网络运行依赖；不把整个/etc、宿主根目录或home映射进来。
for network_file in /etc/resolv.conf /etc/hosts /etc/nsswitch.conf /etc/ssl/certs; do
  [[ ! -e "$network_file" ]] || mounts+=(--ro-bind "$network_file" "$network_file")
done
readonly_roots="${ACP_READONLY_ROOTS:-}"
runtime_root="${ACP_RUNTIME_ROOT:-}"
if [[ -n "$runtime_root" ]]; then readonly_roots="${readonly_roots:+$readonly_roots:}$runtime_root"; fi
# MCP使用后端实际Bun/Node。只读挂真实可执行文件所在目录，不写死开发机路径。
if [[ -n "${ACP_MCP_RUNTIME_EXECUTABLE:-}" ]]; then
  runtime_executable="$(readlink -f -- "$ACP_MCP_RUNTIME_EXECUTABLE")"
  [[ -x "$runtime_executable" ]] || exit 66
  readonly_roots="${readonly_roots:+$readonly_roots:}$(dirname -- "$runtime_executable")"
fi
IFS=: read -r -a roots <<< "$readonly_roots"
for readonly_root in "${roots[@]}"; do
  [[ -n "$readonly_root" ]] || continue
  case "$readonly_root" in
    /|/home|/tmp|/opt) echo "overbroad ACP read-only root" >&2; exit 64 ;;
    /*) ;;
    *) echo "ACP read-only root must be absolute" >&2; exit 64 ;;
  esac
  [[ -d "$readonly_root" ]] || exit 66
  resolved_root="$(readlink -f -- "$readonly_root")"
  case "$resolved_root" in /|/home|/tmp|/opt) echo "overbroad ACP read-only root" >&2; exit 64 ;; esac
  mounts+=(--dir "$readonly_root" --ro-bind "$resolved_root" "$readonly_root")
done
auth_mount=()
if [[ -n "${ACP_AUTH_SOURCE:-}" ]]; then
  case "$ACP_AUTH_SOURCE" in /*) ;; *) echo "ACP auth file must be absolute" >&2; exit 64 ;; esac
  [[ -f "$ACP_AUTH_SOURCE" && -r "$ACP_AUTH_SOURCE" ]] || exit 66
  case "${ACP_AUTH_KIND:-codex}" in
    codex) auth_target=/opt/codex-home/auth.json ;;
    claude) auth_target=/opt/claude-home/.credentials.json ;;
    *) echo "unsupported ACP auth kind" >&2; exit 64 ;;
  esac
  auth_mount=(--ro-bind "$ACP_AUTH_SOURCE" "$auth_target")
fi
# 不继承宿主的密钥、代理、SSH socket等环境；只转交操作者逐个具名授权的变量。
agent_env=()
IFS=: read -r -a names <<< "${ACP_ENV_ALLOWLIST:-}"
for env_name in "${names[@]}"; do
  [[ -n "$env_name" ]] || continue
  [[ "$env_name" =~ ^[A-Z][A-Z0-9_]*$ ]] || exit 64
  case "$env_name" in
    HOME|PATH|CODEX_HOME|CLAUDE_CONFIG_DIR|XDG_*|ACP_*) echo "reserved ACP environment name" >&2; exit 64 ;;
  esac
  [[ ! -v "$env_name" ]] || agent_env+=(--setenv "$env_name" "${!env_name}")
done
exec "$bwrap_bin" --die-with-parent --new-session \
  --unshare-user --unshare-pid --unshare-ipc --unshare-uts \
  --clearenv "${mounts[@]}" \
  --dir /tmp/home --dir /tmp/cache --dir /tmp/config --dir /tmp/state \
  --dir /opt/codex-home --dir /opt/claude-home "${auth_mount[@]}" \
  --dir "$workspace" --bind "$workspace" "$workspace" \
  --proc /proc --dev /dev \
  --setenv PATH /usr/bin:/bin --setenv HOME /tmp/home \
  --setenv CODEX_HOME /opt/codex-home --setenv CLAUDE_CONFIG_DIR /opt/claude-home \
  --setenv XDG_CACHE_HOME /tmp/cache --setenv XDG_CONFIG_HOME /tmp/config \
  --setenv XDG_STATE_HOME /tmp/state \
  "${agent_env[@]}" --chdir "$workspace" -- "$@"
