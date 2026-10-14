/**
 * 负责单个测试装配职责头的形状／中文检查，输入为真实候选源与跟踪文档路径，
 * 输出实际诊断；不运行生产流程、不证明库存／权限，也不替代原oracle语义审查。
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ts from '/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript';
import { checkComments } from '/home/hby/dev/AI-Werewolf-Arena/tooling/refactor/architecture/comment-check';
const path = 'backend/tests/scenarios/features/radiant-eclipse/paid-dream-effects.test.ts';
const text = fs.readFileSync(path, 'utf8');
const documentationPaths = JSON.parse(fs.readFileSync('docs/refactor/generated/paid-dream-fixture-doc-paths.json', 'utf8'));
const diagnostics = checkComments(ts, { files: [{ path, text }], documentationPaths });
const missingCN = !/[\u4e00-\u9fff]/.test(text.slice(0, text.indexOf('*/') + 2));
const result = { source: { path, sha256: createHash('sha256').update(text).digest('hex') }, documentationPaths: documentationPaths.length, diagnostics, missingCN, limits: '仅一个实际场景职责头，中文形状不能代替装配／规则／测试证据。' };
fs.writeFileSync('docs/refactor/generated/paid-dream-fixture-heads.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ source: 1, docs: documentationPaths.length, diagnostics: diagnostics.length, missingCN }));
if (diagnostics.length || missingCN) process.exitCode = 1;
