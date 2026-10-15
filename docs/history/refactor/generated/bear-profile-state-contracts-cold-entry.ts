/** 负责比对熊资料单入口的实际冷加载、原配置和初始化样本；输入真实前后资料模块，输出相同样本，不运行模型或对局。 */
import assert from "node:assert/strict";
const path=process.argv[2]!;
const {BEAR_ROLE_PROFILE: profile}=await import(path);
assert.deepEqual(Object.keys(await import(path)),["BEAR_ROLE_PROFILE"]);
const {createRoleComponent}=await import("../../../backend/src/core/domain/components/role");
const {Camp,Role}=await import("../../../backend/src/core/domain/model");
const role=createRoleComponent(Role.Bear,Camp.Good);
profile.runtime.init(role,{});
assert.deepEqual(role.privateState,{bear:{history:[]}});
assert.deepEqual(profile.runtime.configuration.serialize({}),{});
assert.deepEqual(profile.runtime.configuration.serialize({bear:{signalPolicy:"netease_dawn_live_v1"}}),{signalPolicy:"netease_dawn_live_v1"});
console.log(JSON.stringify({exports:["BEAR_ROLE_PROFILE"],metadata:profile.metadata,initialized:role.privateState,defaults:profile.runtime.configuration.defaults,configuration:[{},profile.runtime.configuration.serialize({bear:{signalPolicy:"netease_dawn_live_v1"}})],limits:"仅一入口实际冷加载与原配置/安装样本，不冒全冷图或玩法验证"}));
