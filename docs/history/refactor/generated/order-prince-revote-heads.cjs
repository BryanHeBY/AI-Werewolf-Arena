/** 只核本批四个真实首头的职责形状与中文存在；内容真实性仍由非作者全文审查。 */
const fs=require('node:fs'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const {checkComments}=require('../../../tooling/refactor/architecture/comment-check.ts');
const prefix='docs/refactor/generated/order-prince-revote-',paths=JSON.parse(fs.readFileSync(prefix+'paths.json','utf8'));
const files=paths.map(path=>{const text=fs.readFileSync(path,'utf8');return{path,text,sha256:crypto.createHash('sha256').update(text).digest('hex')};});
const documentationPaths=JSON.parse(fs.readFileSync(prefix+'documentation-paths.json','utf8'));
const diagnostics=checkComments(ts,{files,documentationPaths});
const chineseHeadFailures=files.filter(f=>!/[\u3400-\u9fff]/.test(f.text.slice(0,f.text.indexOf('*/')+2))).map(f=>f.path);
const report={source:files.map(({path,sha256})=>({path,sha256})),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures,limits:'形状与中文存在不是中文内容、玩法、生命周期或全部结构门禁验收。'};
fs.writeFileSync(prefix+'heads.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
