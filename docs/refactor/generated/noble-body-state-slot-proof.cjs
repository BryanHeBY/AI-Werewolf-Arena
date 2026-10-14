/**
 * 负责本批完整程序的精确结构逆与真实状态槽算法比较。
 * 输入为持久 Git before 和当前三个源码；输出为全部非注释节点／叶、完整双模块输出与方法归属证据。
 * 只逆原状态写入和审计影子的具名迁移，保留全部其他业务主体；不运行游戏、类型门禁或模型。
 */
const fs=require('fs'),crypto=require('crypto'),ts=require('../../../backend/node_modules/typescript');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const prefix='docs/refactor/generated/noble-body-state-slot-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json'));const old=new Map(before.files.map(r=>[r.path,r]));
const sp='backend/src/game/mechanisms/roles/noble_secret_body/state.ts',ap='backend/src/game/mechanisms/roles/noble_secret_body/authority.ts',tp='backend/tests/unit/features/noble-secret-body/state-slot.test.ts';
const read=p=>fs.readFileSync(p,'utf8'),parse=s=>ts.createSourceFile('same.ts',s,ts.ScriptTarget.Latest,true);
function tokens(s){const sf=parse(s),out=[];function visit(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode||n.kind===ts.SyntaxKind.EndOfFileToken)return;const children=n.getChildren(sf).filter(c=>!(c.kind>=ts.SyntaxKind.FirstJSDocNode&&c.kind<=ts.SyntaxKind.LastJSDocNode)&&c.kind!==ts.SyntaxKind.EndOfFileToken);out.push([n.kind,children.length?null:n.getText(sf)]);for(const c of children)visit(c);}visit(sf);return out;}
function compare(a,b){const l=tokens(a),r=tokens(b);if(JSON.stringify(l)!==JSON.stringify(r))throw Error('complete_program_mismatch');return {nodes:l.length,wholeTypedTreeAndAllLeavesSame:true,originalProgramSHA256:sha(JSON.stringify(l)),inverseProgramSHA256:sha(JSON.stringify(r))};}
function emissions(a,b){return [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const l=emit(a),r=emit(b);if(l!==r)throw Error('whole_emit_mismatch:'+ts.ModuleKind[module]);return {module:ts.ModuleKind[module],wholeRawSame:true,oldSHA256:sha(l),inverseSHA256:sha(r)};});}
function declaration(s,name,predicate){const sf=parse(s),n=sf.statements.find(n=>predicate(n)&&n.name?.getText(sf)===name);if(!n)throw Error('missing_declaration:'+name);return {sf,n,text:n.getText(sf)};}
function unique(s,a,b){if(s.split(a).length!==2)throw Error('not_unique:'+a.slice(0,80));return s.replace(a,b);}
function renamed(s){return s.replaceAll('this.nobleState','owner.nobleState').replaceAll('this.bodyState','owner.bodyState').replaceAll('this.#nobleJson','owner.nobleJson').replaceAll('this.#bodyJson','owner.bodyJson');}
const state=read(sp),authority=read(ap),slot=declaration(state,'NobleBodyStateSlot',ts.isClassDeclaration),writer=declaration(state,'writeState',ts.isFunctionDeclaration);
const originalWriter=declaration(old.get(ap).text,'writeState',ts.isFunctionDeclaration);const writerProof=compare(originalWriter.text,writer.text);
const members=slot.n.members;if(members.length!==10)throw Error('unexpected_slot_member');
const propertyNames=members.filter(ts.isPropertyDeclaration).map(n=>n.name.getText(slot.sf));if(propertyNames.join('|')!=='nobleState|bodyState|#nobleJson|#bodyJson')throw Error('unexpected_slot_fields');
if(members.filter(ts.isPropertyDeclaration).some(n=>n.initializer))throw Error('unexpected_field_initializer');
const method=name=>{const n=members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(slot.sf)===name);if(!n)throw Error('missing_method:'+name);return n;};
const constructor=members.find(ts.isConstructorDeclaration);const ctorStatements=constructor.body.statements.map(n=>n.getText(slot.sf));
const expectedCtor=['this.nobleState = nobleState;','this.bodyState = bodyState;','this.#nobleJson = JSON.stringify(nobleData);','this.#bodyJson = JSON.stringify(bodyData);'];
if(JSON.stringify(ctorStatements)!==JSON.stringify(expectedCtor)||constructor.parameters.map(n=>n.name.getText(slot.sf)).join('|')!=='nobleState|bodyState|nobleData|bodyData')throw Error('constructor_encode_order_changed');
const methods=[];for(const [name,type]of [['commitNoble','NobleState'],['commitBody','SecretBodyState']]){
 const current=renamed(method(name).getText(slot.sf));const derived=unique(current,`${name}(next: ${type}): void`,`function ${name}(owner: Owner, next: ${type}): void`);
 methods.push({name,derived,proof:compare(declaration(old.get(ap).text,name,ts.isFunctionDeclaration).text,derived)});
}
function returnExpression(name){const n=method(name);if(n.body.statements.length!==1||!ts.isReturnStatement(n.body.statements[0]))throw Error('extra_method_statements:'+name);return n.body.statements[0].expression;}
let canonicalExpression=returnExpression('matchesCanonicalData');if(!ts.isParenthesizedExpression(canonicalExpression))throw Error('canonical_shape');canonicalExpression=renamed(canonicalExpression.expression.getText(slot.sf));
const decoders=['decodeNobleShadow','decodeBodyShadow'].map(name=>({name,expression:renamed(returnExpression(name).getText(slot.sf))}));
let inverseAuthority=authority;
inverseAuthority=unique(inverseAuthority,'owner.stateSlot.matchesCanonicalData()',canonicalExpression);
for(const d of decoders)inverseAuthority=unique(inverseAuthority,`owner.stateSlot.${d.name}()`,d.expression);
const currentInterface=declaration(inverseAuthority,'Owner',ts.isInterfaceDeclaration),oldInterface=declaration(old.get(ap).text,'Owner',ts.isInterfaceDeclaration);
const slotField=currentInterface.n.members.find(n=>n.name?.getText(currentInterface.sf)==='stateSlot');
const oldFields=oldInterface.n.members.filter(n=>['nobleState','bodyState','nobleJson','bodyJson'].includes(n.name?.getText(oldInterface.sf))).map(n=>n.getText(oldInterface.sf));
if(slotField.getText(currentInterface.sf)!=='readonly stateSlot: NobleBodyStateSlot;'||oldFields.length!==4)throw Error('owner_field_delta');
inverseAuthority=unique(inverseAuthority,slotField.getText(currentInterface.sf),oldFields.join('\n  '));
const invFile=parse(inverseAuthority);let init;function find(n){if(ts.isPropertyAssignment(n)&&n.name.getText(invFile)==='stateSlot')init=n;ts.forEachChild(n,c=>{find(c);});}find(invFile);
if(!init||!ts.isNewExpression(init.initializer)||init.initializer.expression.getText(invFile)!=='NobleBodyStateSlot')throw Error('slot_install_delta');
const args=init.initializer.arguments.map(n=>n.getText(invFile));if(args.join('|')!=='nobleState as NobleState|bodyState as SecretBodyState|nobleData|bodyData')throw Error('new_constructor_arguments');
const rawProps=['nobleState: '+args[0],'bodyState: '+args[1]];
const encodeProps=ctorStatements.slice(2).map((s,i)=>(i?'bodyJson':'nobleJson')+': '+s.slice(s.indexOf('=')+2,-1));
inverseAuthority=unique(inverseAuthority,init.getText(invFile),[...rawProps,...encodeProps].join(',\n    '));
const rawRefCount={noble:inverseAuthority.split('owner.stateSlot.nobleState').length-1,body:inverseAuthority.split('owner.stateSlot.bodyState').length-1};
inverseAuthority=inverseAuthority.replaceAll('owner.stateSlot.nobleState','owner.nobleState').replaceAll('owner.stateSlot.bodyState','owner.bodyState');
const writeCallCounts={noble:inverseAuthority.split('owner.stateSlot.commitNoble(').length-1,body:inverseAuthority.split('owner.stateSlot.commitBody(').length-1};if(writeCallCounts.noble!==4||writeCallCounts.body!==3)throw Error('writer_consumer_count');
inverseAuthority=inverseAuthority.replaceAll('owner.stateSlot.commitNoble(','commitNoble(owner, ').replaceAll('owner.stateSlot.commitBody(','commitBody(owner, ');
inverseAuthority=unique(inverseAuthority,'  NobleBodyStateSlot,\n','');
const install=declaration(inverseAuthority,'installNobleBodyAuthority',ts.isFunctionDeclaration);
inverseAuthority=unique(inverseAuthority,install.text,writer.text+'\n'+methods.map(m=>m.derived).join('\n')+'\n'+install.text);
const authorityProof=compare(old.get(ap).text,inverseAuthority),authorityOutputs=emissions(old.get(ap).text,inverseAuthority);
const stateFile=parse(state),drop=[slot.n,writer.n].map(n=>({start:n.getStart(stateFile),end:n.end})).sort((a,b)=>b.start-a.start);let inverseState=state;for(const x of drop)inverseState=inverseState.slice(0,x.start)+inverseState.slice(x.end);
const stateProof=compare(old.get(sp).text,inverseState),stateOutputs=emissions(old.get(sp).text,inverseState);
const tfix=JSON.parse(read(prefix+'test-type-delta.json')),test=read(tp);if(unique(tfix.before,tfix.old,tfix.new)!==test)throw Error('unexpected_test_type_delta');const typeOnlyOutputs=emissions(tfix.before,test);
const report={base:before.base,source:[sp,ap,tp].map(path=>({path,sha256:sha(read(path))})),slot:{memberCount:members.length,uniqueStoredFields:propertyNames,constructorExactStatements:ctorStatements,constructorNormalizedInputsEncodedInOriginalOrder:true,writeState:writerProof,commitMethods:methods.map(({name,proof})=>({name,...proof})),canonicalDataExpression:canonicalExpression,shadowDecoderExpressions:decoders,rawRefCount,writeCallCounts},completeAuthority:{...authorityProof,outputs:authorityOutputs},completeStateExceptNewSlotAndMovedWriter:{...stateProof,outputs:stateOutputs},testTypeDelta:{path:tp,onlyExplicitObjectTypeView:true,outputs:typeOnlyOutputs},approved:true,limits:'当前真实完整槽writer/commit/canonical/decode/constructor逐项逆回原算法，再展开7writer、raw引用和两个checkpoint表达式验证整个authority。新增公开slot/字段布局/调用栈/初始化allocation变化明确，不称当前两个模块新二进制与旧直接相同。'};
fs.writeFileSync(prefix+'program-proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({approved:true,writerNodes:writerProof.nodes,authorityNodes:authorityProof.nodes,stateNodes:stateProof.nodes,slotMembers:members.length,calls:writeCallCounts,fullInverseOutputs:authorityOutputs.length+stateOutputs.length,testTypeOutputs:typeOnlyOutputs.length}));
