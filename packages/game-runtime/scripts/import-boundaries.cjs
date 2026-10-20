/**
 * 负责应用层级的纯路径判定。输入为源码根、导入方路径与字面模块名；输出为首个禁止层级说明或 null。
 * 此处唯一声明层级表，保留旧入口测试并接入领域实际目录；按 find 次序匹配同层／子目录，不读取文件、解析包出口或授予运行权限。
 * 相对与绝对路径按原规则规范化，包名保持不匹配；新角色／包边界仍由独立架构门禁核对，不能借 null 宣称全部结构合法。
 */
const path = require("node:path");

// 每项属于旧层级的禁止依赖集合；find 的先匹配顺序与原错误说明共同构成此工具的契约。
const boundaries = [
  {
    layer: "domain",
    forbidden: [
      "app",
      "engine",
      "features",
      "agents",
      "adapters",
      "rulesets",
      "recording",
      "verification",
      "audit",
      "replay",
      "game",
      "ai",
      "runtime",
      "server",
      "infra",
    ],
  },
  {
    layer: "core",
    forbidden: ["app", "game", "ai", "runtime", "server", "infra", "recording", "audit", "replay"],
  },
  {
    layer: "game/engine",
    forbidden: ["app", "ai", "runtime", "server", "infra", "audit", "replay"],
  },
  {
    layer: "game/gateway",
    forbidden: ["app", "ai", "runtime", "server", "infra", "audit", "replay"],
  },
  {
    layer: "runtime/scenarios",
    forbidden: [
      "app",
      "ai",
      "game/engine",
      "game/gateway",
      "runtime",
      "server",
      "infra",
      "recording",
      "audit",
      "replay",
    ],
  },
  // 以下承接新物理 owner；旧 synthetic 表项原样保留，迁目录不能让 AI 执行／传输获得反向依赖许可。
  {
    layer: "engine",
    forbidden: [
      "app",
      "ai",
      "runtime",
      "server",
      "infra",
      "audit",
      "replay",
      "adapters",
      "rulesets/presets",
      "agents/acp",
      "agents/llm",
      "agents/player",
      "agents/providers",
      "agents/runtime",
      "agents/reporting",
      "agents/index",
      "agents/game-tool-protocol",
      "agents/visible-event-protocol",
    ],
  },
  {
    layer: "rulesets/presets",
    forbidden: [
      "app",
      "ai",
      "engine",
      "runtime",
      "server",
      "infra",
      "recording",
      "audit",
      "replay",
      "adapters",
      "agents/acp",
      "agents/llm",
      "agents/player",
      "agents/providers",
      "agents/runtime",
      "agents/reporting",
      "agents/index",
      "agents/game-tool-protocol",
      "agents/visible-event-protocol",
    ],
  },
  {
    layer: "features",
    forbidden: [
      "app",
      "ai",
      "runtime",
      "server",
      "infra",
      "audit",
      "replay",
      "adapters",
      "agents/acp",
      "agents/llm",
      "agents/player",
      "agents/providers",
      "agents/runtime",
      "agents/reporting",
      "agents/index",
      "agents/game-tool-protocol",
      "agents/visible-event-protocol",
    ],
  },
  {
    layer: "rulesets",
    forbidden: [
      "app",
      "ai",
      "runtime",
      "server",
      "infra",
      "audit",
      "replay",
      "adapters",
      "agents/acp",
      "agents/llm",
      "agents/player",
      "agents/providers",
      "agents/runtime",
      "agents/reporting",
      "agents/index",
      "agents/game-tool-protocol",
      "agents/visible-event-protocol",
    ],
  },
  {
    layer: "recording",
    forbidden: [
      "app",
      "ai",
      "runtime",
      "game",
      "audit",
      "replay",
      "engine",
      "features",
      "rulesets",
      "agents",
      "adapters",
    ],
  },
];

/** @param {string} file @param {string} directory */
function within(file, directory) {
  // 必须匹配完整路径段，避免 core-extra 被误当作 core 的子目录。
  return file === directory || file.startsWith(`${directory}/`);
}

/** @param {string} rootDir @param {string} filePath @param {string} specifier */
function importBoundaryViolation(rootDir, filePath, specifier) {
  if (!specifier.startsWith(".") && !path.isAbsolute(specifier)) return null;
  const source = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const boundary = boundaries.find(({ layer }) => within(source, layer));
  if (!boundary) return null;
  // 仅按导入方位置规范化路径并去除原后缀，不访问目标文件或推导实际 package 声明。
  const target = path
    .relative(rootDir, path.resolve(path.dirname(filePath), specifier))
    .replace(/\\/g, "/")
    .replace(/\.(?:[cm]?ts|[cm]?js)$/, "");
  if (within(target, boundary.layer)) return null;
  // Session recorder 的原 FileStore 是单一持久化端口；不扩大为整个 adapters 或网络／AI 许可。
  if (
    source === "recording/session/recorder.ts" &&
    target === "adapters/filesystem/session-file-store"
  )
    return null;
  const forbidden = boundary.forbidden.find((layer) => within(target, layer));
  return forbidden
    ? `${boundary.layer} imports forbidden layer "${forbidden}" via "${specifier}"`
    : null;
}

module.exports = { importBoundaryViolation };
