/**
 * 负责摄梦人同一夜状态身份上的唯一关系数组。输入为原状态对象或明确安装的同一 links；
 * 输出保留原数组、生命与已付当前性回调，不复制、冻结、序列化或重新授权。
 * 首次追加／读取才建立空数组；旧 dreamLinks 属性、getter、原型或浅副本不接续本族记录。
 * 选择历史、次数、开夜提交及原体复验仍归阶段／权威；数组存在不代表已付、有效或已经死亡。
 * object 只是运行身份键，不是权限品牌；Frame 继续持有读取时的同一数组，替换登记不改旧实例。
 */
import type { DreamNightLink } from "./night-frame";

// 每个原夜间状态只有这一份关系数组；不在通用状态挂镜像，也不建立第二份来源／许可索引。
const linksByState = new WeakMap<object, DreamNightLink[]>();

function ownedLinks(state: object): DreamNightLink[] {
  let links = linksByState.get(state);
  if (!links) {
    links = [];
    linksByState.set(state, links);
  }
  return links;
}

/** 原追加点先取得同一数组与 push callee，再构造 link；失败不撤销已付历史或已经登记的数组。 */
export function dreamNightLinksForAppend(state: object): DreamNightLink[] {
  return ownedLinks(state);
}

/** 只读视图仍是原数组；Frame 构造后继续追加可被同一实例看到，不触发任何有效性回调。 */
export function readDreamNightLinks(state: object): readonly DreamNightLink[] {
  return ownedLinks(state);
}

/** 明确接入现有关系数组时保持原引用；这是可信运行接线，不校验、伪造或赋予付费／生命许可。 */
export function installDreamNightLinks(state: object, links: DreamNightLink[]): void {
  linksByState.set(state, links);
}

/**
 * 可信扩展的已付关系探针：在原关系读取点捕获同一数组，之后按调用点建立 Frame；不把生命组件交给 callback。
 * 返回的方法只产生编号，World 与 Frame 留在闭包；本探针不改变 paid-current 或原关系撤权。
 */
export function bindPaidDreamNightProbe(runtime: {
  state(): object;
  world(): import("../../domain/world").World;
}) {
  return {
    get captureProbe() {
      const links = readDreamNightLinks(runtime.state());
      return () => {
        const frame = new ProbeDreamNightFrame(links);
        return {
          protectedTargets: () =>
            frame.protectedTargets(bindProbeDreamLifeQueries(runtime.world())),
          linkedDeaths: (deaths: readonly number[]) =>
            frame.linkedDeaths(bindProbeDreamLifeQueries(runtime.world()), deaths),
        };
      };
    },
  };
}
import { DreamNightFrame as ProbeDreamNightFrame } from "./night-frame";
import { bindDreamLifeQueries as bindProbeDreamLifeQueries } from "../../domain/dream-night-effects";
