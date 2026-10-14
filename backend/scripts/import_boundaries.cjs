/**
 * 负责旧应用层级的纯路径判定。输入为源码根、导入方路径与字面模块名；输出为首个禁止层级说明或 null。
 * 此处唯一声明旧层级表，按原 find 次序匹配同层／子目录；判断不读取文件、解析包出口或授予运行权限。
 * 相对与绝对路径按原规则规范化，包名保持不匹配；新角色／包边界仍由独立架构门禁核对，不能借 null 宣称全部结构合法。
 */
const path = require("node:path");

// 每项属于旧层级的禁止依赖集合；find 的先匹配顺序与原错误说明共同构成此工具的契约。
const boundaries = [
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
  { layer: "recording", forbidden: ["app", "ai", "runtime", "game", "audit", "replay"] },
];

/** @param {string} file @param {string} directory */
function within(file, directory) {
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
  const forbidden = boundary.forbidden.find((layer) => within(target, layer));
  return forbidden
    ? `${boundary.layer} imports forbidden layer "${forbidden}" via "${specifier}"`
    : null;
}

module.exports = { importBoundaryViolation };
