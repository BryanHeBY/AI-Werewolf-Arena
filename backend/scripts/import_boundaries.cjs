const path = require("node:path");

const boundaries = [
  { layer: "core", forbidden: ["app", "game", "ai", "runtime", "server", "infra", "recording", "audit", "replay"] },
  { layer: "game/engine", forbidden: ["app", "ai", "runtime", "server", "infra", "audit", "replay"] },
  { layer: "game/gateway", forbidden: ["app", "ai", "runtime", "server", "infra", "audit", "replay"] },
  { layer: "runtime/scenarios", forbidden: ["app", "ai", "game/engine", "game/gateway", "runtime", "server", "infra", "recording", "audit", "replay"] },
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
  const target = path.relative(rootDir, path.resolve(path.dirname(filePath), specifier))
    .replace(/\\/g, "/").replace(/\.(?:[cm]?ts|[cm]?js)$/, "");
  if (within(target, boundary.layer)) return null;
  const forbidden = boundary.forbidden.find((layer) => within(target, layer));
  return forbidden ? `${boundary.layer} imports forbidden layer "${forbidden}" via "${specifier}"` : null;
}

module.exports = { importBoundaryViolation };
