/** 只对原 Lucky 根及本批原 Git 文本作有限编译覆盖；不是完整固定 Git 编译或产品测试。 */
const fs=require("node:fs"),path=require("node:path"),ts=require("../../../backend/node_modules/typescript");
const prefix="docs/refactor/generated/night-ability-inventory-owner-";
const before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8"));
const config=JSON.parse(fs.readFileSync(prefix+"types-config.json","utf8"));
const parsed=ts.parseJsonConfigFileContent(config,ts.sys,process.cwd());
const root=path.resolve("backend/tests/unit/mechanisms/lucky-ability-resource-boundaries.test.ts");
const input=new Map(before.source.map(x=>[path.resolve(x.path),x.text]));
const host=ts.createCompilerHost(parsed.options),oldRead=host.readFile,oldExists=host.fileExists;
host.readFile=file=>input.get(path.resolve(file))??oldRead(file);
host.fileExists=file=>input.has(path.resolve(file))||oldExists(file);
const program=ts.createProgram([root],parsed.options,host);
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,path:d.file?path.relative(process.cwd(),d.file.fileName):null,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,message:ts.flattenDiagnosticMessageText(d.messageText,"\n")}));
const expected=diagnostics.length===1&&diagnostics[0].code===2741&&diagnostics[0].path==="backend/tests/unit/mechanisms/lucky-ability-resource-boundaries.test.ts"&&diagnostics[0].message.includes("requestFactory");
const report={baseCommit:before.baseCommit,limitedOriginalRoot:path.relative(process.cwd(),root),overriddenOriginalGitFiles:input.size,scope:"只覆盖该根与本批34份原文本，其余依赖来自当前公开工作树；不称完整固定Git或整体类型通过。",diagnostics,expectedLegacyDiagnosticReproduced:expected,typeAllGreen:false};
fs.writeFileSync(prefix+"legacy-type-overlay.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(!expected)process.exitCode=1;
