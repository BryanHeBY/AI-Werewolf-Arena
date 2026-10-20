/**
 * 负责按真实模块所有者与公开出口核对精确依赖 binding。
 * 输入为脱离的公开源码及 TypeScript 配置数据；输出保留导入种类、类型／值模式、符号与解析目标。
 * 仅在虚拟公开输入中解析配置继承和别名，先确认源码目标再处理声明的外部依赖，
 * 不经真实文件系统读取或执行源码、tsconfig、安装包或私有内容。
 * 旧债务不能扩大导入符号，包出口不能越过所属目录，独立 verifier 不得调用生产规则算法。
 */
import { builtinModules } from "node:module";
import path from "node:path";
import type * as TypeScript from "typescript";
import {
  isProductionPath,
  isTypedSource,
  parseSource,
  violation,
  type ArchitectureInput,
  type ArchitectureViolation,
} from "./contracts";

interface PackageInfo {
  root: string;
  name: string;
  exports: unknown;
  main?: string;
  types?: string;
  dependencies: Set<string>;
  productionDependencies: Set<string>;
}
interface Reference {
  specifier: string;
  line: number;
  column: number;
  dynamic: boolean;
  binding: string;
  typeOnly: boolean;
}
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  "bun",
  "bun:test",
  "bun:ffi",
  "bun:sqlite",
  "bun:jsc",
]);
const packageName = (specifier: string) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
const featureRoot = (file: string) =>
  /^(backend\/src\/(?:game\/mechanisms\/roles|features)\/[^/]+)\//.exec(file)?.[1] ?? null;
const publicFeatureTarget = (file: string, kinds = ["index", "contracts", "ports"]) => {
  const root = featureRoot(file);
  // 机制根的具名公开端口可按职责分开，避免一个 ports 同时装配查询和重型窗口导致循环。
  // 只认 kebab-case 的根文件 *-ports；嵌套目录、下划线和任意内部实现仍不成为公共入口。
  const facet =
    !!root &&
    kinds.includes("ports") &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-ports\.(?:ts|mts|cts)$/.test(file.slice(root.length + 1));
  return (
    facet ||
    (!!root &&
      kinds.some(
        (kind) =>
          file === `${root}/${kind}.ts` ||
          file === `${root}/${kind}.mts` ||
          file === `${root}/${kind}.cts`,
      ))
  );
};
// 只列由旧 AI 层迁出的真实执行／传输入口；旧 game 的观察、展示和 repair 端口不属于此集合。
const executionAgentSource = (file: string) =>
  /^backend\/src\/(?:agents\/(?:acp|llm|pi|player|providers|runtime|reporting)|audit\/agents)\//.test(
    file,
  ) ||
  /^backend\/src\/agents\/(?:index|game-tool-protocol|visible-event-protocol)\.[cm]?ts$/.test(
    file,
  ) ||
  /^backend\/src\/app\/(?:agent-exports|audit-agent-exports|audit-agent-factory)\.[cm]?ts$/.test(
    file,
  );
const browserSource = (file: string) =>
  /^(?:frontend\/src\/|packages\/[^/]+\/src\/|apps\/[^/]+\/src\/client\/)/.test(file);
const domainSource = (file: string) => /^backend\/src\/(?:core|domain)\//.test(file);
const verifierSource = (file: string) =>
  /^backend\/src\/(?:verification\/|recording\/verification\/)/.test(file) ||
  /^backend\/src\/recording\/.*_(?:record|stocks|action_evidence|requests)\.[cm]?ts$/.test(file);
const privatePath = (file: string) =>
  file
    .split("/")
    .some(
      (part) =>
        ["node_modules", ".git", ".codex", ".aws", "auth.json", ".."].includes(part) ||
        part.startsWith(".env"),
    );
function packageInventory(input: ArchitectureInput): PackageInfo[] {
  return input.files
    .filter((file) => /(?:^|\/)package\.json$/.test(file.path))
    .flatMap((file) => {
      try {
        const data = JSON.parse(file.text) as {
          name?: string;
          exports?: unknown;
          main?: string;
          types?: string;
          dependencies?: Record<string, unknown>;
          devDependencies?: Record<string, unknown>;
          peerDependencies?: Record<string, unknown>;
          optionalDependencies?: Record<string, unknown>;
        };
        if (!data.name) return [];
        const production = [
          ...Object.keys(data.dependencies ?? {}),
          ...Object.keys(data.peerDependencies ?? {}),
          ...Object.keys(data.optionalDependencies ?? {}),
        ];
        return [
          {
            root: path.posix.dirname(file.path) === "." ? "" : path.posix.dirname(file.path),
            name: data.name,
            exports: data.exports,
            main: data.main,
            types: data.types,
            dependencies: new Set([...production, ...Object.keys(data.devDependencies ?? {})]),
            productionDependencies: new Set(production),
          },
        ];
      } catch {
        return [];
      }
    });
}
const exportLeaves = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(exportLeaves)
      : value && typeof value === "object"
        ? Object.values(value).flatMap(exportLeaves)
        : [];
function exportTargets(pkg: PackageInfo, key: string): string[] {
  if (pkg.exports === undefined)
    return key === "."
      ? [pkg.types, pkg.main].filter((value): value is string => typeof value === "string")
      : [];
  if (typeof pkg.exports === "string" || Array.isArray(pkg.exports))
    return key === "." ? exportLeaves(pkg.exports) : [];
  if (!pkg.exports || typeof pkg.exports !== "object") return [];
  const rows = Object.entries(pkg.exports);
  if (!rows.some(([name]) => name.startsWith(".")))
    return key === "." ? exportLeaves(pkg.exports) : [];
  const exact = rows.find(([name]) => name === key);
  if (exact) return exportLeaves(exact[1]);
  for (const [name, value] of rows) {
    const star = name.indexOf("*");
    if (star < 0 || !key.startsWith(name.slice(0, star)) || !key.endsWith(name.slice(star + 1)))
      continue;
    const middle = key.slice(star, key.length - name.length + star + 1);
    return exportLeaves(value).map((target) => target.replaceAll("*", middle));
  }
  return [];
}
function references(ts: typeof TypeScript, source: TypeScript.SourceFile): Reference[] {
  const rows: Reference[] = [];
  const add = (
    node: TypeScript.Node,
    expression: TypeScript.Node | undefined,
    kind: string,
    typeOnly = false,
    symbols: string[] = ["*"],
  ) => {
    const pos = source.getLineAndCharacterOfPosition(node.getStart(source)),
      literal = expression && ts.isStringLiteralLike(expression);
    rows.push({
      specifier: literal ? expression.text : "<dynamic>",
      line: pos.line + 1,
      column: pos.character + 1,
      dynamic: !literal,
      typeOnly,
      binding: JSON.stringify({ kind, typeOnly, symbols: [...symbols].sort() }),
    });
  };
  const visit = (node: TypeScript.Node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause,
        symbols: string[] = [];
      if (clause?.name) symbols.push("default");
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) symbols.push("namespace:*");
        else
          symbols.push(
            ...clause.namedBindings.elements.map(
              (entry) =>
                `${entry.isTypeOnly ? "type" : "value"}:${entry.propertyName?.text ?? entry.name.text}`,
            ),
          );
      }
      add(
        node,
        node.moduleSpecifier,
        "import",
        clause?.isTypeOnly ?? false,
        symbols.length ? symbols : ["side-effect"],
      );
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const symbols =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map(
              (entry) =>
                `${entry.isTypeOnly ? "type" : "value"}:${entry.propertyName?.text ?? entry.name.text}->${entry.name.text}`,
            )
          : ["namespace:*"];
      add(node, node.moduleSpecifier, "export", node.isTypeOnly, symbols);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      add(node, node.moduleReference.expression, "import-equals", node.isTypeOnly, ["namespace:*"]);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      add(node, node.argument.literal, "import-type", true, [
        node.qualifier?.getText(source) ?? "namespace:*",
      ]);
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      let symbols = ["namespace:*"];
      if (ts.isVariableDeclaration(node.parent) && ts.isObjectBindingPattern(node.parent.name))
        symbols = node.parent.name.elements.map(
          (entry) => entry.propertyName?.getText(source) ?? entry.name.getText(source),
        );
      add(
        node,
        node.arguments[0],
        node.expression.kind === ts.SyntaxKind.ImportKeyword ? "dynamic-import" : "require",
        false,
        symbols,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return rows;
}

export function checkDependencies(
  ts: typeof TypeScript,
  input: ArchitectureInput,
): ArchitectureViolation[] {
  const rows: ArchitectureViolation[] = [],
    files = new Map(input.files.map((file) => [file.path, file])),
    packages = packageInventory(input);
  const virtualRoot = "/__awa_public__",
    virtualFiles = new Map(input.files.map((file) => [`${virtualRoot}/${file.path}`, file.text]));
  const host: TypeScript.ParseConfigFileHost = {
    useCaseSensitiveFileNames: true,
    getCurrentDirectory: () => virtualRoot,
    fileExists: (file) => virtualFiles.has(path.posix.normalize(file)),
    readFile: (file) => virtualFiles.get(path.posix.normalize(file)),
    readDirectory: (root, extensions) =>
      [...virtualFiles.keys()].filter(
        (file) =>
          file.startsWith(`${root}/`) &&
          (!extensions || extensions.some((ext) => file.endsWith(ext))),
      ),
    onUnRecoverableConfigFileDiagnostic: () => undefined,
  };
  const configs = input.files
    .filter((file) => /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(file.path))
    .map((file) => ({
      path: file.path,
      directory: path.posix.dirname(file.path) === "." ? "" : path.posix.dirname(file.path),
      parsed: ts.getParsedCommandLineOfConfigFile(`${virtualRoot}/${file.path}`, {}, host),
    }));
  const directories = new Set<string>([virtualRoot]);
  for (const file of virtualFiles.keys()) {
    for (
      let directory = path.posix.dirname(file);
      directory.startsWith(virtualRoot);
      directory = path.posix.dirname(directory)
    ) {
      directories.add(directory);
      if (directory === virtualRoot) break;
    }
  }
  const moduleHost: TypeScript.ModuleResolutionHost = {
    fileExists: host.fileExists,
    readFile: host.readFile,
    directoryExists: (directory) => directories.has(path.posix.normalize(directory)),
    realpath: (file) => path.posix.normalize(file),
    getCurrentDirectory: () => virtualRoot,
    useCaseSensitiveFileNames: true,
  };
  const fromVirtual = (value: string) =>
    value.startsWith(`${virtualRoot}/`) ? value.slice(virtualRoot.length + 1) : null;
  const resolveFile = (requested: string): string | null => {
    if (requested.startsWith("/") || privatePath(requested)) return null;
    const stripped = requested.replace(/\.(?:mjs|cjs|js)$/, "");
    const candidates = [
      requested,
      ...[".ts", ".tsx", ".mts", ".cts", ".d.ts", ".js", ".jsx", ".mjs", ".cjs", ".json"].map(
        (ext) => requested + ext,
      ),
      stripped + ".ts",
      stripped + ".tsx",
      stripped + ".mts",
      stripped + ".cts",
      ...["index.ts", "index.tsx", "index.mts", "index.cts", "index.js"].map(
        (name) => `${requested}/${name}`,
      ),
    ];
    return candidates.find((candidate) => files.has(candidate)) ?? null;
  };
  const packageEdges: { from: string; to: string; file: string; ref: Reference; target: string }[] =
    [];
  const add = (rule: string, file: string, ref: Reference, detail: string, target?: string) =>
    rows.push(
      violation(
        rule,
        file,
        ref.line,
        ref.column,
        detail,
        `${ref.specifier}\0${target ?? ""}\0${ref.binding}`,
        { specifier: ref.specifier, binding: ref.binding, ...(target ? { target } : {}) },
      ),
    );
  for (const pkg of packages)
    for (const dependency of pkg.productionDependencies) {
      const target = packages.find((candidate) => candidate.name === dependency);
      if (!target) continue;
      packageEdges.push({
        from: pkg.root,
        to: target.root,
        file: pkg.root ? `${pkg.root}/package.json` : "package.json",
        target: target.root ? `${target.root}/package.json` : "package.json",
        ref: {
          specifier: dependency,
          line: 1,
          column: 1,
          dynamic: false,
          typeOnly: false,
          binding: JSON.stringify({
            kind: "manifest-production",
            typeOnly: false,
            symbols: [dependency],
          }),
        },
      });
    }
  for (const file of input.files.filter((entry) => isTypedSource(entry.path))) {
    const source = parseSource(ts, file),
      owner = featureRoot(file.path);
    const currentPackage = [...packages]
      .filter((pkg) => !pkg.root || file.path.startsWith(`${pkg.root}/`))
      .sort((a, b) => b.root.length - a.root.length)[0];
    const config = [...configs]
      .filter((config) => !config.directory || file.path.startsWith(`${config.directory}/`))
      .sort(
        (a, b) =>
          b.directory.length - a.directory.length ||
          Number(!a.path.endsWith("/tsconfig.json")) - Number(!b.path.endsWith("/tsconfig.json")),
      )[0];
    for (const ref of references(ts, source)) {
      if (ref.dynamic) {
        if (isProductionPath(file.path))
          add(
            "dependency.dynamic-target",
            file.path,
            ref,
            "Production dynamic loading needs a finite public target declaration.",
          );
        continue;
      }
      const spec = ref.specifier;
      if (nodeBuiltins.has(spec)) {
        if (browserSource(file.path))
          add(
            "dependency.browser-runtime",
            file.path,
            ref,
            "Browser source cannot import Node/Bun runtime modules.",
          );
        continue;
      }
      let target: string | null = null,
        publicPackage = false;
      const resolvePublicModule = () => {
        const options: TypeScript.CompilerOptions = {
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          allowJs: true,
          ...config?.parsed?.options,
        };
        const requireMode =
          JSON.parse(ref.binding).kind === "require" ||
          JSON.parse(ref.binding).kind === "import-equals";
        const resolved = ts.resolveModuleName(
          spec,
          `${virtualRoot}/${file.path}`,
          options,
          moduleHost,
          undefined,
          undefined,
          requireMode ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext,
        ).resolvedModule?.resolvedFileName;
        const publicPath = resolved ? fromVirtual(resolved) : null;
        return publicPath && files.has(publicPath) && !privatePath(publicPath) ? publicPath : null;
      };
      if (spec.startsWith(".")) {
        const requested = path.posix.normalize(
          path.posix.join(path.posix.dirname(file.path), spec),
        );
        if (requested.startsWith("../") || privatePath(requested)) {
          add(
            "dependency.private-target",
            file.path,
            ref,
            "Dependency points outside public source or into private/installed paths.",
          );
          continue;
        }
        target = resolvePublicModule() ?? resolveFile(requested);
      } else {
        const options = config?.parsed?.options,
          aliasRows = Object.entries(options?.paths ?? {});
        const alias = aliasRows
          .filter(([key]) =>
            key.includes("*")
              ? spec.startsWith(key.split("*")[0]!) && spec.endsWith(key.split("*")[1]!)
              : spec === key,
          )
          .sort((a, b) => b[0].replace("*", "").length - a[0].replace("*", "").length)[0];
        if (
          config &&
          (!config.parsed ||
            config.parsed.errors.some((error) => [5083, 6053, 18000].includes(error.code)))
        ) {
          add(
            "dependency.invalid-config",
            file.path,
            ref,
            "Consumer tsconfig or inherited configuration is unavailable in public inputs.",
          );
          continue;
        }
        if (alias) {
          const [key, substitutions] = alias,
            [head, tail = ""] = key.split("*"),
            middle = key.includes("*") ? spec.slice(head!.length, spec.length - tail.length) : "";
          const aliasBase =
            options?.baseUrl ??
            (typeof options?.pathsBasePath === "string"
              ? options.pathsBasePath
              : `${virtualRoot}/${config!.directory}`);
          const requested = substitutions.map((value) =>
            path.posix.normalize(path.posix.join(aliasBase, value.replaceAll("*", middle))),
          );
          target =
            resolvePublicModule() ??
            requested
              .map((value) => fromVirtual(value))
              .filter((value): value is string => value !== null)
              .map(resolveFile)
              .find(Boolean) ??
            null;
          // 精确指向消费应用自己声明的外部包根目录，与普通 bare import 是同一边界。
          // 仍优先解析公开源码；跨应用、额外后缀、多候选或 workspace 冒充均不适用。
          // 仓库保留包命名空间必须有真实 workspace 登记，不能借依赖声明或安装别名冒充。
          // 这里只识别公开配置与依赖元数据，不让虚拟 host 读取安装目录或私有字节。
          const externalName = packageName(spec);
          const ownDeclaredExternal =
            key === spec &&
            spec === externalName &&
            !externalName.startsWith("@ai-werewolf-arena/") &&
            !!currentPackage &&
            currentPackage.dependencies.has(externalName) &&
            !packages.some((pkg) => pkg.name === externalName) &&
            requested.length === 1 &&
            requested[0] ===
              path.posix.join(virtualRoot, currentPackage.root, "node_modules", externalName);
          if (!target && ownDeclaredExternal) continue;
          // 已有 tooling 类型定位允许使用后端编译器；不扩大为任意值导入或安装路径。
          const compilerLocator =
            file.path.startsWith("tooling/") &&
            ref.typeOnly &&
            spec === "typescript" &&
            requested.every((value) => value.endsWith("/backend/node_modules/typescript")) &&
            packages.some((pkg) => pkg.dependencies.has("typescript"));
          if (!target && compilerLocator) continue;
          if (!target) {
            add(
              "dependency.unresolved-alias",
              file.path,
              ref,
              "Configured alias does not resolve to public inputs.",
            );
            continue;
          }
        } else if (options?.baseUrl) {
          const requested = fromVirtual(
            path.posix.normalize(path.posix.join(options.baseUrl, spec)),
          );
          if (requested) target = resolvePublicModule() ?? resolveFile(requested);
        }
        if (!target) {
          const name = packageName(spec),
            workspace = packages.find((pkg) => pkg.name === name);
          if (workspace) {
            if (file.path.startsWith("frontend/") && workspace.root === "backend")
              add(
                "dependency.frontend-backend",
                file.path,
                ref,
                "Frontend consumer imports backend workspace implementation.",
                "backend",
              );
            if (file.path.startsWith("backend/src/") && workspace.root === "frontend")
              add(
                "dependency.cross-application",
                file.path,
                ref,
                "Backend production imports frontend application implementation.",
                "frontend",
              );
            const targets = exportTargets(
              workspace,
              spec.slice(name.length) ? `.${spec.slice(name.length)}` : ".",
            );
            const valid = targets
              .filter(
                (value) =>
                  value.startsWith("./") &&
                  !privatePath(value) &&
                  !value.slice(2).split("/").includes(".."),
              )
              .map((value) => path.posix.normalize(path.posix.join(workspace.root, value)));
            if (
              valid.length !== targets.length ||
              !valid.every((value) => !workspace.root || value.startsWith(`${workspace.root}/`))
            ) {
              add(
                "dependency.package-export-owner",
                file.path,
                ref,
                "Declared package export escapes its owning public root.",
              );
              continue;
            }
            target = valid.map(resolveFile).find(Boolean) ?? null;
            if (!target) {
              add(
                "dependency.package-export",
                file.path,
                ref,
                "Workspace package has no resolvable declared export for this request.",
              );
              continue;
            }
            publicPackage = true;
            if (
              currentPackage?.name !== workspace.name &&
              !currentPackage?.dependencies.has(workspace.name)
            )
              add(
                "dependency.workspace-undeclared",
                file.path,
                ref,
                "Consuming workspace has not declared this workspace dependency.",
                target,
              );
          } else if (spec.startsWith("@ai-werewolf-arena/")) {
            add(
              "dependency.unknown-workspace",
              file.path,
              ref,
              "Unknown workspace package is not an allowed boundary.",
            );
            continue;
          } else {
            const declared =
              currentPackage?.dependencies.has(name) ||
              (file.path.startsWith("tooling/") &&
                packages.some((pkg) => pkg.dependencies.has(name)));
            if (!declared)
              add(
                "dependency.unknown-package",
                file.path,
                ref,
                "Bare package or alias is undeclared by its consuming workspace.",
              );
            continue;
          }
        }
      }
      if (!target) {
        add(
          "dependency.unresolved-target",
          file.path,
          ref,
          "Dependency does not resolve to enumerated public input.",
        );
        continue;
      }
      const targetOwner = featureRoot(target);
      if (owner && targetOwner && owner !== targetOwner && !publicFeatureTarget(target))
        add(
          "dependency.feature-internal",
          file.path,
          ref,
          "Feature imports another feature internal implementation.",
          target,
        );
      if (
        (/^backend\/src\/(?:ai|adapters)\//.test(file.path) || executionAgentSource(file.path)) &&
        targetOwner &&
        !publicFeatureTarget(target, ["contracts", "ports"])
      )
        add(
          "dependency.adapter-feature",
          file.path,
          ref,
          "Adapter imports concrete feature rather than a request/player port.",
          target,
        );
      if (
        /^backend\/src\/(?:game\/engine|engine(?!\/actions\/))\//.test(file.path) &&
        targetOwner &&
        !publicFeatureTarget(target, ["contracts", "ports"])
      )
        add(
          "dependency.engine-feature",
          file.path,
          ref,
          "Engine timing imports concrete feature rather than an extension contract.",
          target,
        );
      // 游戏侧预检也只消费机制公开契约；从 AI 迁入 gateway 不能使原内部耦合逃过检查。
      if (
        /^backend\/src\/(?:game\/gateway|engine\/actions)\//.test(file.path) &&
        targetOwner &&
        !publicFeatureTarget(target, ["contracts", "ports"])
      )
        add(
          "dependency.gateway-feature",
          file.path,
          ref,
          "Game preflight imports concrete feature rather than a public mechanism contract.",
          target,
        );
      if (
        domainSource(file.path) &&
        /^backend\/src\/(?:game|features|engine|ai|agents|adapters|app|runtime|recording|verification|audit|rulesets)\//.test(
          target,
        )
      )
        add(
          "dependency.domain-implementation",
          file.path,
          ref,
          "Domain depends on an application, engine or feature implementation.",
          target,
        );
      if (
        verifierSource(file.path) &&
        /^backend\/src\/(?:game|features|engine|ai|agents|adapters|app|runtime|rulesets)\//.test(
          target,
        )
      )
        add(
          "dependency.verifier-production",
          file.path,
          ref,
          "Independent verification imports production rule or orchestration code.",
          target,
        );
      if (isProductionPath(file.path) && /(?:^|\/)(?:tests|tooling)\//.test(target))
        add(
          "dependency.production-test",
          file.path,
          ref,
          "Production implementation depends on a test or tooling oracle.",
          target,
        );
      if (/^frontend\/(?:src|scripts)\//.test(file.path) && target.startsWith("backend/"))
        add(
          "dependency.frontend-backend",
          file.path,
          ref,
          "Frontend consumer imports backend implementation.",
          target,
        );
      // 工作台同一包同时包含浏览器和服务器，公开包出口不能代替运行环境边界。
      // 相对路径、tsconfig 别名和已声明 backend 出口解析后都检查真实目标。
      if (/^apps\/[^/]+\/src\/client\//.test(file.path) && target.startsWith("backend/"))
        add(
          "dependency.browser-backend",
          file.path,
          ref,
          "Browser application imports backend implementation rather than shared data contracts.",
          target,
        );
      if (browserSource(file.path) && /^apps\/[^/]+\/src\/server\//.test(target))
        add(
          "dependency.browser-server",
          file.path,
          ref,
          "Browser source imports a local server implementation.",
          target,
        );
      const sourcePackageRoot = /^packages\/[^/]+/.exec(file.path)?.[0],
        targetPackageRoot = /^packages\/[^/]+/.exec(target)?.[0];
      if (sourcePackageRoot && targetPackageRoot && sourcePackageRoot !== targetPackageRoot)
        packageEdges.push({
          from: sourcePackageRoot,
          to: targetPackageRoot,
          file: file.path,
          ref,
          target,
        });
      if (targetPackageRoot && sourcePackageRoot !== targetPackageRoot && !publicPackage)
        add(
          "dependency.package-internal",
          file.path,
          ref,
          "Cross package access must use a declared public export.",
          target,
        );
      if (/^packages\/[^/]+\/src\//.test(file.path) && target.startsWith("backend/"))
        add(
          "dependency.package-backend",
          file.path,
          ref,
          "Browser shared package depends on backend implementation.",
          target,
        );
    }
  }
  const reachable = (start: string, target: string, seen = new Set<string>()): boolean => {
    if (start === target) return true;
    if (seen.has(start)) return false;
    seen.add(start);
    return packageEdges
      .filter((edge) => edge.from === start)
      .some((edge) => reachable(edge.to, target, seen));
  };
  for (const edge of packageEdges)
    if (reachable(edge.to, edge.from))
      add(
        "dependency.package-cycle",
        edge.file,
        edge.ref,
        "Shared production/source package graph contains a cycle.",
        edge.target,
      );
  return rows;
}
