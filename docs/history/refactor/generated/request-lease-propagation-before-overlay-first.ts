/** 只为两原失败case提供实际bd106十一源码旧程序；传递模块仍当前工作区，不是整树隔离或新游戏hook。 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { plugin } from "bun";
const prefix="docs/refactor/generated/request-lease-propagation-";
const before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8"));
const old=new Map<string,string>(before.source.map((x:{path:string,text:string})=>[path.resolve(x.path),x.text]));
const newOwner=path.resolve("backend/src/core/domain/request-lease.ts"), loaded:string[]=[];
const fileExists=(p:string)=>p!==newOwner&&(old.has(p)||fs.existsSync(p));
const readFile=(p:string)=>old.get(p)??fs.readFileSync(p,"utf8");
for(const x of before.source){const p=path.resolve(x.path);if(!fileExists(p)||createHash("sha256").update(readFile(p)).digest("hex")!==x.sha256)throw Error("before_overlay_source_mismatch");}
if(fileExists(newOwner))throw Error("before_overlay_new_owner_present");
const save=()=>fs.writeFileSync(prefix+"before-overlay.json",JSON.stringify({baselineCommit:before.baselineCommit,availableOldPrograms:old.size,loadedOldPrograms:loaded,readFileAndFileExistsConsistent:true,newOwnerAvailable:false,transitiveLimit:"Current workspace dependencies including A35; only these eleven actual Git old programs overlaid",source:before.source.map(({text,...x}:{text:string;path:string})=>x)},null,2)+"\n");
save();
plugin({name:"actual-c18-before-only",setup(build){
  build.onLoad({filter:/\.[cm]?[jt]sx?$/,namespace:"file"},args=>{
    const p=path.resolve(args.path);
    if(p===newOwner)throw Error("before_overlay_unexpected_new_owner_load");
    if(!old.has(p))return;
    loaded.push(path.relative(process.cwd(),p));save();
    return {contents:readFile(p),loader:"ts",resolveDir:path.dirname(p)};
  });
}});
