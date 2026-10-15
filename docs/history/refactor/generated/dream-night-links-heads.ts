/**
 * 负责本批35个源码职责头与中文维护检查。输入是当前冻结源和真实跟踪文档路径，
 * 输出保留实际 comment-check 诊断；只检查此范围，不执行规则或替代所有权／失败语义审查。
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ts from '/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript';
import { checkComments } from '/home/hby/dev/AI-Werewolf-Arena/tooling/refactor/architecture/comment-check';
const prefix = 'docs/refactor/generated/dream-night-links-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const files = before.sourceScope.map((path: string) => ({ path, text: fs.readFileSync(path, 'utf8') }));
const documentationPaths = JSON.parse(fs.readFileSync(prefix + 'doc-paths.json', 'utf8'));
const diagnostics = checkComments(ts, { files, documentationPaths });
const missingCN = files.filter((f: { path: string; text: string }) => !/[\u4e00-\u9fff]/.test(f.text.slice(0, f.text.indexOf('*/') + 2))).map((f: { path: string }) => f.path);
const result = { inputs: files.map((f: { path: string; text: string }) => ({ path: f.path, sha256: createHash('sha256').update(f.text).digest('hex') })), documentationPaths: documentationPaths.length, diagnostics, missingCN, limits: '只核本35职责头／中文及真实文档目标；不声称全仓语义或P9完成。' };
fs.writeFileSync(prefix + 'heads.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ sources: files.length, docs: documentationPaths.length, diagnostics, missingCN }));
if (diagnostics.length || missingCN.length) process.exitCode = 1;
