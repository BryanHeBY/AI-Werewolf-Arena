/** 有界验证真实公开端口、实际函数绑定与单路由逆向，不执行对局或全门禁。 */
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import ts from '/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript';
const prefix='docs/refactor/generated/secret-body-exile-port-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const text=fs.readFileSync(before.source.path,'utf8');
if(text.split(before.edits.new).length!==2 || text.replace(before.edits.new,before.edits.old)!==before.source.text)throw Error('whole_voting_route_inverse_failed');
const config=ts.parseJsonConfigFileContent(ts.readConfigFile('backend/tsconfig.tests.json',ts.sys.readFile).config,ts.sys,path.resolve('backend')).options;
const resolve=(owner:string,specifier:string)=>ts.resolveModuleName(specifier,path.resolve(owner),config,ts.sys).resolvedModule?.resolvedFileName;
const source=ts.createSourceFile(before.newPort.path,fs.readFileSync(before.newPort.path,'utf8'),ts.ScriptTarget.Latest,true);
const bindings=[];
for(const node of source.statements){
 if(!ts.isExportDeclaration(node)||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier)||!node.exportClause||!ts.isNamedExports(node.exportClause))throw Error('port_contains_non_export_program');
 for(const element of node.exportClause.elements)bindings.push({name:element.name.text,original:(element.propertyName??element.name).text,typeOnly:node.isTypeOnly||element.isTypeOnly,target:resolve(before.newPort.path,node.moduleSpecifier.text)});
}
const target=path.resolve('backend/src/game/mechanisms/roles/noble_secret_body/exile-reveal.ts');
if(bindings.length!==2||bindings[0].name!=='revealSecretBodyExile'||bindings[0].typeOnly||bindings[1].name!=='SecretBodyExileRevealQueries'||!bindings[1].typeOnly||bindings.some(x=>x.target!==target||x.name!==x.original))throw Error('port_direct_bindings_failed');
const newEndpoint=resolve(before.source.path,before.edits.new),oldEndpoint=resolve(before.source.path,before.edits.old);
if(newEndpoint!==path.resolve(before.newPort.path)||oldEndpoint!==target)throw Error('voting_real_endpoint_failed');
const facet=await import(path.resolve(before.newPort.path));const owner=await import(target);if(facet.revealSecretBodyExile!==owner.revealSecretBodyExile)throw Error('runtime_binding_identity_failed');
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{
 const options={target:ts.ScriptTarget.ES2022,module,removeComments:true};const old=ts.transpileModule(before.source.text,{compilerOptions:options}).outputText;
 const mapped=ts.transpileModule(text.replace(before.edits.new,before.edits.old),{compilerOptions:options}).outputText;
 if(old!==mapped)throw Error('whole_voting_output_failed');return{module:ts.ModuleKind[module],wholeMappedRawSame:true,sha256:crypto.createHash('sha256').update(old).digest('hex')};
});
const result={approved:true,wholeVotingOnlyRoute:true,bindings,newEndpoint,oldEndpoint,runtimeBindingIdentity:true,publicFacetPolicy:'existing root kebab-case *-ports accepted; gate unchanged',outputs,limits:['只核两源实际绑定与单route；传递闭包不声明全部冷初始化等价。','原SecretBody body/tests/proof未重复，不是全仓dependency/type/gate验收。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
