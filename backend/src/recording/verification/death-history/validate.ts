/**
 * 负责严格 Tape 普通死亡后果的独立历史审核：来源／派生波、死亡枪、遗言及警徽数据前缀。
 * 输入为结构与原18个机制审核后的纯 Record；输出为接受或明确的历史矛盾，不导入 World、生产 resolver 或资格函数。
 * 来源操作和事实是审计输入，不是本模块重算的初始夜伤害；提案、已付事实、物理死亡与通知不合成一个布尔值。
 * 失败 CP 保多个合法字段写前缀；opaque 回复与无法定序的特殊段不猜候选、生命引用／版本或运行许可。
 * schema2 下新增严格语义拒绝不进入公开 replay／player reader；构建身份和真实重执行仍归 strict replay。
 */
import { DeathCause, Phase, Role } from "@ai-werewolf-arena/game-contract";
import type {
  RecordedCheckpoint,
  RecordedDecision,
  RecordedGameEvent,
  ReproductionRecord,
} from "../../reproduction/format";

const ERROR = "reproduction_death_history_invalid";
function check(value: unknown): asserts value {
  if (!value) throw new Error(ERROR);
}
const data = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every(positive) ? value : undefined;
const phase = (value: unknown): value is Phase => Object.values(Phase).includes(value as Phase);
const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  const left = data(a),
    right = data(b);
  return (
    !!left &&
    !!right &&
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((k) => Object.hasOwn(right, k) && equal(left[k], right[k]))
  );
};
const causes = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "string")
    ? [...new Set(value)]
    : undefined;

/** 每个 episode 只持归档证据；addition 的位置避免把未来关系原因倒灌到较早请求／事实。 */
interface DeathEpisode {
  actorId: number;
  day: number;
  start: number;
  origin: Phase | undefined;
  wave: number | undefined;
  sources: Array<{ at: number; cause: string }>;
  completeSources: boolean;
}
interface EventPoint {
  index: number;
  day: number;
  execution: Phase;
  event: RecordedGameEvent;
}
interface Evidence {
  record: ReproductionRecord;
  points: EventPoint[];
  episodes: DeathEpisode[];
  ids: Set<number>;
  at(actorId: number, day: number, index: number): DeathEpisode | undefined;
  sources(episode: DeathEpisode | undefined, index: number): string[] | undefined;
  role(actorId: number, index: number): Role | undefined;
}
function collectEvidence(record: ReproductionRecord): Evidence {
  const ids = new Set(record.metadata.players.map((p) => p.id));
  const points: EventPoint[] = [],
    episodes: DeathEpisode[] = [];
  let day = record.checkpoints[0]?.snapshot.day ?? 1;
  let execution = record.checkpoints[0]?.snapshot.phase ?? Phase.Night;
  const at = (id: number, d: number, index: number) =>
    episodes.filter((e) => e.actorId === id && e.day === d && e.start <= index).at(-1);
  const sources = (e: DeathEpisode | undefined, index: number): string[] | undefined => {
    if (!e) return undefined;
    const known = [...new Set(e.sources.filter((s) => s.at <= index).map((s) => s.cause))];
    return known.length || e.completeSources ? known : undefined;
  };
  const start = (
    id: number,
    index: number,
    origin: Phase | undefined,
    wave: number | undefined,
    source: string[] | undefined,
    complete: boolean,
  ) => {
    check(ids.has(id));
    const e: DeathEpisode = {
      actorId: id,
      day,
      start: index,
      origin,
      wave,
      sources: (source ?? []).map((cause) => ({ at: index, cause })),
      completeSources: complete,
    };
    episodes.push(e);
    return e;
  };
  const derived = (
    id: number,
    actor: number | undefined,
    cause: DeathCause,
    index: number,
    nightOnly = false,
  ) => {
    const root = actor === undefined ? undefined : at(actor, day, index);
    const prior = at(id, day, index);
    if (prior) {
      if (!prior.sources.some((s) => s.cause === cause)) prior.sources.push({ at: index, cause });
    } else start(id, index, nightOnly ? Phase.Night : root?.origin, root?.wave, [cause], false);
  };
  const nightOps = record.operations.filter(
    (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
  );
  let night = 0;
  for (const [index, event] of record.events.entries()) {
    const p = event.payload;
    if (event.type === "phase_changed") {
      check(positive(p.day) && phase(p.phase));
      day = p.day;
      execution = p.phase;
    }
    points.push({ index, day, execution, event });
    if (event.type === "night_resolved") {
      const deaths = numbers(p.deaths);
      check(deaths);
      const output = nightOps[night++]?.output,
        sourceMap = data(output?.death_sources),
        opDeaths = numbers(output?.deaths);
      // 匹配的输出提供完整来源；缺少／不同的特殊输出保持未知，不能凭公告名单补死因。
      const matched =
        opDeaths !== undefined &&
        equal(
          [...new Set(opDeaths)].sort((a, b) => a - b),
          [...new Set(deaths)].sort((a, b) => a - b),
        );
      for (const id of deaths) {
        const source = matched && sourceMap ? causes(sourceMap[String(id)]) : undefined;
        start(id, index, Phase.Night, 0, source, matched && source !== undefined);
      }
    } else if (event.type === "voted_out" && positive(p.target))
      start(p.target, index, Phase.Voting, 0, [DeathCause.Exile], true);
    else if (event.type === "wolf_self_destruct" && positive(p.wolfId))
      start(p.wolfId, index, execution, 0, [DeathCause.SelfDestruct], true);
    else if (event.type === "white_wolf_king_self_destruct" && positive(p.actorId)) {
      start(p.actorId, index, execution, 0, [DeathCause.SelfDestruct], true);
      if (positive(p.targetId))
        start(p.targetId, index, execution, 0, [DeathCause.WhiteWolfBlast], true);
    } else if (event.type === "knight_duel" && positive(p.actorId) && positive(p.targetId)) {
      if (p.result === "wolf") start(p.targetId, index, Phase.Day, 0, [DeathCause.Duel], true);
      else if (p.result === "not_wolf")
        start(p.actorId, index, Phase.Day, 0, [DeathCause.DuelFailure], true);
    } else if (event.type === "lovers_death" && positive(p.targetId))
      derived(p.targetId, positive(p.actorId) ? p.actorId : undefined, DeathCause.Lovers, index);
    else if (event.type === "charm_death" && positive(p.targetId))
      derived(p.targetId, positive(p.actorId) ? p.actorId : undefined, DeathCause.Charm, index);
    else if (event.type === "dream_death" && positive(p.targetId))
      derived(
        p.targetId,
        positive(p.actorId) ? p.actorId : undefined,
        DeathCause.Dream,
        index,
        p.reason === "consecutive",
      );
    else if (
      ["hunter_shot", "wolf_king_shot", "mechanical_shot", "player_shot"].includes(event.type) &&
      positive(p.targetId)
    ) {
      const actor = event.type === "hunter_shot" ? p.hunterId : p.actorId;
      const root = positive(actor) ? at(actor, day, index) : undefined;
      start(
        p.targetId,
        index,
        root?.origin,
        root?.wave === undefined ? undefined : root.wave + 1,
        [DeathCause.Shot],
        true,
      );
    }
  }
  const role = (id: number, index: number) => {
    const cp = record.checkpoints.filter((c) => c.eventCount <= index).at(-1);
    return (
      cp?.players.find((p) => p.id === id)?.role ??
      record.metadata.players.find((p) => p.id === id)?.role
    );
  };
  return { record, points, episodes, ids, at, sources, role };
}

/** 同一死亡许可的重试是一个尝试组；整数 id 只分组数据，不因此授予任何运行权限。 */
function groups(decisions: RecordedDecision[]): RecordedDecision[][] {
  const result = new Map<string, RecordedDecision[]>();
  for (const d of decisions) {
    const c = d.request.context;
    const key = JSON.stringify([
      d.actorId,
      d.day,
      d.stage,
      c.ability_id ?? null,
      c.death_action_id ?? null,
    ]);
    const bucket = result.get(key) ?? [];
    bucket.push(d);
    result.set(key, bucket);
  }
  return [...result.values()];
}
function canPrecede(d: RecordedDecision, point: EventPoint): boolean {
  return (
    d.day === point.day &&
    (d.openedAtEventCount === undefined || d.openedAtEventCount <= point.index)
  );
}
function opaque(d: RecordedDecision): boolean {
  return d.outcome.kind !== "action";
}
function action(d: RecordedDecision, name: string): Record<string, unknown> | undefined {
  return d.outcome.kind === "action" && d.outcome.action?.name === name
    ? d.outcome.action.args
    : undefined;
}
function nativePolicy(
  e: Evidence,
  actor: number,
  index: number,
  ability: unknown,
  kind?: string,
): string {
  if (typeof ability === "string" || kind === "mechanical_shot" || kind === "player_shot")
    return "awa_qualified_sources_v1";
  const board = e.record.metadata.normalizedBoard,
    role = e.role(actor, index);
  if (kind === "wolf_king_shot")
    return board.wolfKing?.deathActionPolicy ?? "awa_qualified_sources_v1";
  if (kind === "hunter_shot") return board.hunter?.deathActionPolicy ?? "awa_qualified_sources_v1";
  if (role === Role.WolfKing)
    return board.wolfKing?.deathActionPolicy ?? "awa_qualified_sources_v1";
  if (role === Role.Hunter) return board.hunter?.deathActionPolicy ?? "awa_qualified_sources_v1";
  return "awa_qualified_sources_v1";
}
/** 冻结政策的独立声明；不导入生产 permitsDeathShot，混合来源逐项而非存在一项即可。 */
function shotAllowed(
  source: readonly string[],
  policy: string,
  origin: Phase | undefined,
): boolean | undefined {
  if (!["awa_qualified_sources_v1", "awa_knife_or_exile_v1", "awa_day_deaths_v1"].includes(policy))
    return false;
  if (!source.length) return false;
  const allowed: string[] = [
    DeathCause.WolfKill,
    DeathCause.MechanicalKnife,
    DeathCause.AwakenedHiddenKnife,
    DeathCause.Exile,
  ];
  if (policy !== "awa_knife_or_exile_v1") allowed.push(DeathCause.Shot, DeathCause.WhiteWolfBlast);
  if (!source.every((c) => allowed.includes(c))) return false;
  if (policy === "awa_day_deaths_v1")
    return origin === undefined ? undefined : origin === Phase.Day || origin === Phase.Voting;
  return true;
}
function auditShots(e: Evidence): void {
  const decisions = e.record.decisions.filter(
    (d) => d.stage === "hunter_shot" || d.stage === "death_shot",
  );
  for (const d of decisions) {
    check(
      e.ids.has(d.actorId) &&
        d.request.actorId === d.actorId &&
        d.request.context.day === d.day &&
        d.request.context.stage === d.stage &&
        d.request.allowedTools.includes("shoot") &&
        positive(d.request.context.death_action_id),
    );
    const source = causes(d.request.context.death_sources);
    const origin = d.request.context.death_origin_phase;
    // 原生 Day 政策的 origin 与请求的执行/死亡字段不同；缺未录字段不补作 false。
    if (source)
      check(
        shotAllowed(
          source,
          nativePolicy(
            e,
            d.actorId,
            d.openedAtEventCount ?? -1,
            d.request.context.ability_id,
            d.stage === "hunter_shot" ? "hunter_shot" : undefined,
          ),
          phase(origin) ? origin : undefined,
        ) !== false,
      );
  }
  const windows = groups(decisions);
  const used = new Map<number, number[]>();
  const mappingOwned = e.record.metadata.normalizedBoard.magician !== undefined;
  for (const point of e.points) {
    const { event, index, day } = point,
      p = event.payload;
    if (
      ![
        "hunter_shot",
        "wolf_king_shot",
        "mechanical_shot",
        "player_shot",
        "death_shot_blocked",
        "death_shot_missed",
      ].includes(event.type)
    )
      continue;
    const actor = event.type === "hunter_shot" ? p.hunterId : p.actorId;
    check(positive(actor) && e.ids.has(actor));
    if (event.type !== "death_shot_missed")
      check(positive(p.targetId) && e.ids.has(p.targetId) && p.targetId !== actor);
    const episode = e.at(actor, day, index),
      source = e.sources(episode, index);
    const candidates: number[] = [];
    for (const [i, window] of windows.entries()) {
      const last = window.filter((d) => d.actorId === actor && canPrecede(d, point)).at(-1);
      if (!last) continue;
      if (
        event.type === "hunter_shot" &&
        (last.stage !== "hunter_shot" || last.request.context.ability_id !== undefined)
      )
        continue;
      if (
        ["wolf_king_shot", "mechanical_shot", "player_shot"].includes(event.type) &&
        last.stage !== "death_shot"
      )
        continue;
      if (
        ["wolf_king_shot", "mechanical_shot"].includes(event.type) &&
        last.request.context.ability_id !== undefined
      )
        continue;
      // blocked 事实本身不带资源 id，必须按实际尝试区分原生配置与赠枪；不能先套演员本体政策。
      // miss 只由原生／学习枪的交换分支产生；赠枪原 hook 会拒绝死目标，不能借它解释 mapped miss。
      if (event.type === "death_shot_missed" && last.request.context.ability_id !== undefined)
        continue;
      const generic = event.type === "death_shot_blocked" || event.type === "death_shot_missed";
      const policyKind = generic
        ? last.stage === "hunter_shot"
          ? "hunter_shot"
          : undefined
        : event.type;
      if (
        source &&
        shotAllowed(
          source,
          nativePolicy(e, actor, index, last.request.context.ability_id, policyKind),
          episode?.origin,
        ) === false
      )
        continue;
      const candidate = action(last, "shoot");
      if (
        opaque(last) ||
        (candidate &&
          positive(candidate.target_id) &&
          (mappingOwned ||
            event.type === "death_shot_missed" ||
            candidate.target_id === p.targetId))
      )
        candidates.push(i);
    }
    check(candidates.length > 0);
    used.set(index, candidates);
    // 枪事实证明付款已越过发表点；普通 CP 没有资源原引用／生命版本，不能把后继 canShoot 值当同一库存。
    // 毒／不合格源的静默耗枪、空枪、阻挡和晚替换也不据此强制生成枪事实或补写库存。
  }
  // 一份尝试组至多解释一份付款事实；不把多个事实都指给同一已消费请求。
  const matched = new Map<number, number>();
  const match = (event: number, seen: Set<number>): boolean => {
    for (const w of used.get(event) ?? [])
      if (!seen.has(w)) {
        seen.add(w);
        const prior = matched.get(w);
        if (prior === undefined || match(prior, seen)) {
          matched.set(w, event);
          return true;
        }
      }
    return false;
  };
  for (const event of used.keys()) check(match(event, new Set()));
}

/** 返回 undefined 表示缺乏来源／波次证据；保守接受不是证明已授予遗言。 */
function wordsAllowed(
  source: string[] | undefined,
  origin: Phase,
  day: number,
  wave: number | undefined,
  policy: string,
  fragrantInitial: boolean,
  mayHaveUnrecordedInitialNightSources = false,
): boolean | undefined {
  if (!["awa_initial_wave_v1", "netease_2017_day_and_first_night_v1"].includes(policy))
    return false;
  if (origin === Phase.GameOver || (origin === Phase.Night && day !== 1)) return false;
  if (policy === "awa_initial_wave_v1" && wave !== undefined && wave > 0) return false;
  if (!source) return undefined;
  if (!source.length || source.some((c) => !Object.values(DeathCause).includes(c as DeathCause)))
    return false;
  if (policy === "netease_2017_day_and_first_night_v1")
    return origin === Phase.Day || origin === Phase.Voting || (origin === Phase.Night && day === 1);
  if (source.includes(DeathCause.SelfDestruct) || source.includes(DeathCause.WhiteWolfBlast))
    return false;
  if (origin === Phase.Day && source.every((c) => c === DeathCause.DuelFailure)) return true;
  if (origin === Phase.Voting) return source.includes(DeathCause.Exile);
  if (origin !== Phase.Night || day !== 1) return false;
  const hasPositiveNightCause = source.some(
    (c) =>
      [
        DeathCause.WolfKill,
        DeathCause.AwakenedHiddenKnife,
        DeathCause.Poison,
        DeathCause.Dream,
        DeathCause.FoxInspection,
        DeathCause.MerchantBacklash,
        DeathCause.BlackMarketBacklash,
      ].includes(c as DeathCause) ||
      (c === DeathCause.FragrantLink && fragrantInitial),
  );
  // 初始夜死亡名单缺少可匹配的完整来源证据时，后补 Charm 只是已知原因下界，
  // 缺少正因不能倒推较早初批遗言非法。新派生目标、declared 完整来源与所有早期禁源仍按原规则拒绝。
  return hasPositiveNightCause ? true : mayHaveUnrecordedInitialNightSources ? undefined : false;
}
function auditLastWords(e: Evidence): void {
  const policy = e.record.metadata.normalizedBoard.lastWords?.policy ?? "awa_initial_wave_v1";
  const decisions = e.record.decisions.filter((d) => d.stage === "last_words");
  for (const d of decisions) {
    const context = d.request.context;
    check(
      e.ids.has(d.actorId) &&
        d.request.actorId === d.actorId &&
        context.day === d.day &&
        context.stage === d.stage &&
        d.request.allowedTools.includes("speak"),
    );
    check(
      context.trigger === "last_words" &&
        phase(context.death_phase) &&
        positive(context.death_action_id),
    );
    const declared = causes(context.death_sources);
    if (declared)
      check(
        wordsAllowed(
          declared,
          context.death_phase,
          d.day,
          undefined,
          policy,
          !!e.record.metadata.normalizedBoard.fragrantPairSeer,
        ) !== false,
      );
    const candidates =
      d.openedAtEventCount === undefined
        ? e.episodes.filter((x) => x.actorId === d.actorId && x.day === d.day)
        : [e.at(d.actorId, d.day, d.openedAtEventCount)].filter(
            (x): x is DeathEpisode => x !== undefined,
          );
    // 普通请求未录精确 opening cursor，不能任选最后一个 episode；任一有据可达解释或完全缺证据均保留。
    // 馥郁初始波上下文若未录定，仍容许初始解释；该族原 owner 先行约束其真实事务。
    if (candidates.length)
      check(
        candidates.some((episode) => {
          const index = d.openedAtEventCount ?? Number.MAX_SAFE_INTEGER;
          if (
            d.openedAtEventCount !== undefined &&
            episode.origin !== undefined &&
            episode.origin !== context.death_phase
          )
            return false;
          return (
            wordsAllowed(
              declared ?? e.sources(episode, index),
              context.death_phase as Phase,
              d.day,
              episode.wave,
              policy,
              !!e.record.metadata.normalizedBoard.fragrantPairSeer &&
                (episode.wave === undefined || episode.wave === 0),
              declared === undefined &&
                !episode.completeSources &&
                e.points[episode.start]?.event.type === "night_resolved",
            ) !== false
          );
        }),
      );
  }
  const grants = new Map<string, EventPoint[]>();
  const words = groups(decisions),
    used = new Set<number>();
  for (const point of e.points) {
    const { event, index, day } = point,
      p = event.payload;
    if (event.type !== "last_words_granted" && event.type !== "last_words_spoken") continue;
    check(positive(p.playerId) && e.ids.has(p.playerId) && phase(p.phase) && p.day === day);
    const key = JSON.stringify([p.playerId, day, p.phase]);
    if (event.type === "last_words_granted") {
      const episode = e.at(p.playerId, day, index),
        source = e.sources(episode, index);
      if (episode?.origin !== undefined)
        check(
          wordsAllowed(
            source,
            episode.origin,
            day,
            episode.wave,
            policy,
            !!e.record.metadata.normalizedBoard.fragrantPairSeer &&
              (episode.wave === undefined || episode.wave === 0),
            !episode.completeSources && e.points[episode.start]?.event.type === "night_resolved",
          ) !== false,
        );
      const bucket = grants.get(key) ?? [];
      bucket.push(point);
      grants.set(key, bucket);
    } else {
      check(typeof p.text === "string" && (grants.get(key)?.length ?? 0) > 0);
      const candidate = words.findIndex(
        (window, i) =>
          !used.has(i) &&
          (() => {
            const d = window
              .filter(
                (x) =>
                  x.actorId === p.playerId && x.request.phase === p.phase && canPrecede(x, point),
              )
              .at(-1);
            return !!d && (opaque(d) || action(d, "speak") !== undefined);
          })(),
      );
      check(candidate !== -1);
      used.add(candidate);
      grants.get(key)!.shift();
    }
  }
}

/** 此处只复制审计模型；不是 World／许可 store，也不写入归档或修复原字段。 */
interface BadgeView {
  isSheriff: boolean;
  destroyed: boolean;
  voteWeight: number;
  handoffPolicy?: string;
  canVote: boolean;
  rightWeight: number;
}
type Badges = Map<number, BadgeView>;
const cloneBadges = (source: Badges): Badges =>
  new Map([...source].map(([id, value]) => [id, { ...value }]));
const badgeView = (cp: RecordedCheckpoint): Badges =>
  new Map(
    cp.players.map((p) => [
      p.id,
      { ...p.badge, canVote: p.vote.canVote, rightWeight: p.vote.weight },
    ]),
  );
function badgeSame(a: Badges, b: Badges, uncertain: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every(([id, v]) => uncertain.has(id) || equal(v, b.get(id)));
}
function badgeDelegated(record: ReproductionRecord): boolean {
  const b = record.metadata.normalizedBoard;
  // 这四个 owner 已有自己的徽审计／合成失败视图；仅委托其徽 CP，不退出普通来源、枪、遗言审核。
  return !!(b.animalDream || b.nobleSecretBody || b.demonHunter || b.ghostBride);
}
function auditBadges(e: Evidence): void {
  const first = e.record.checkpoints[0];
  if (!first) return;
  let state = badgeView(first);
  let previousCheckpoint = first;
  const weight = e.record.metadata.normalizedBoard.sheriff?.voteWeight ?? 1.5;
  const policy = e.record.metadata.normalizedBoard.sheriff?.badgePolicy ?? "awa_next_seat_v1";
  const choices = e.record.decisions.filter((d) => d.stage === "sheriff_badge_choice");
  for (const d of choices)
    check(
      e.ids.has(d.actorId) &&
        d.request.actorId === d.actorId &&
        d.request.context.day === d.day &&
        d.request.context.stage === d.stage &&
        d.request.allowedTools.includes("choose_badge_successor") &&
        positive(d.request.context.death_action_id),
    );
  const choiceGroups = groups(choices);
  const checkpoints = e.record.checkpoints.slice(1);
  const delegated = badgeDelegated(e.record);
  const possibleUnpublished = (stable: Badges, cp: RecordedCheckpoint): Badges[] => {
    const result = [cloneBadges(stable)];
    // 只有失败末端容许未发表命令的字段前缀；不借此解释一个完整周期的无事实移交。
    for (const [from, prior] of stable)
      if (prior.isSheriff && !prior.destroyed) {
        const requests = choiceGroups.filter((w) =>
          w.some((d) => d.actorId === from && d.day === cp.snapshot.day),
        );
        const hasDeathEvidence =
          e.episodes.some((d) => d.actorId === from && d.start < cp.eventCount) ||
          requests.length > 0;
        if (!hasDeathEvidence) continue;
        const targetSet = new Set<number | null>([null]);
        if (policy !== "awa_holder_choice_v1")
          for (const id of stable.keys()) if (id !== from) targetSet.add(id);
        for (const window of requests) {
          const last = window.at(-1)!;
          const value = action(last, "choose_badge_successor")?.target_id;
          if (opaque(last)) {
            for (const id of numbers(last.request.context.badge_candidates) ?? [...stable.keys()])
              if (id !== from) targetSet.add(id);
          } else if (positive(value) && value !== from) targetSet.add(value);
        }
        for (const target of targetSet) {
          const next = cloneBadges(stable),
            old = next.get(from)!;
          old.isSheriff = false;
          result.push(cloneBadges(next));
          old.destroyed = true;
          result.push(cloneBadges(next));
          old.rightWeight = old.canVote ? 1 : 0;
          result.push(cloneBadges(next));
          if (target === null) continue;
          const recipient = next.get(target);
          if (!recipient || recipient.destroyed) continue;
          recipient.isSheriff = true;
          result.push(cloneBadges(next));
          recipient.destroyed = false;
          result.push(cloneBadges(next));
          recipient.voteWeight = prior.voteWeight;
          result.push(cloneBadges(next));
          if (prior.handoffPolicy === undefined) delete recipient.handoffPolicy;
          else recipient.handoffPolicy = prior.handoffPolicy;
          result.push(cloneBadges(next));
          recipient.rightWeight = prior.voteWeight;
          result.push(cloneBadges(next));
        }
      }
    // assignSheriff 按名单逐玩家更新，失败可能只完成前几个组件；接收者来自已记录选举结果或决定候选。
    const nomineeIds = new Set([
      ...e.record.decisions
        .filter((d) => d.day === cp.snapshot.day && d.stage.startsWith("sheriff_"))
        .flatMap((d) => {
          const a = action(d, "vote_for_sheriff");
          return positive(a?.target_id) ? [a.target_id] : [];
        }),
      // PK 唯一候选可免投票直接 assign；已录候选只解释失败写前缀，不视为当选或放宽完整 CP。
      ...e.points
        .filter(
          (point) =>
            point.day === cp.snapshot.day &&
            point.index < cp.eventCount &&
            point.event.type === "sheriff_candidates_finalized",
        )
        .flatMap((point) => numbers(point.event.payload.candidates) ?? []),
    ]);
    for (const id of nomineeIds) {
      const next = cloneBadges(stable),
        actual = badgeView(cp);
      for (const player of first.players) {
        const current = next.get(player.id)!,
          original = { ...current };
        const wasAlive = previousCheckpoint.players.find((p) => p.id === player.id)?.alive;
        // assign 只遍历活人。前一 CP 已知死亡席位跳过，不把旧徽一起改成新配置。
        if (wasAlive === false) {
          if (!equal(current, actual.get(player.id))) break;
          continue;
        }
        // 本段来源只是提案，无物理提交游标时保留写／跳过；二者不变成任意字段豁免。
        const maySkip =
          wasAlive === undefined ||
          e.episodes.some(
            (episode) =>
              episode.actorId === player.id &&
              episode.start >= previousCheckpoint.eventCount &&
              episode.start < cp.eventCount,
          );
        current.isSheriff = player.id === id;
        result.push(cloneBadges(next));
        current.destroyed = false;
        result.push(cloneBadges(next));
        current.voteWeight = weight;
        result.push(cloneBadges(next));
        if (policy === "awa_holder_choice_v1") current.handoffPolicy = policy;
        else delete current.handoffPolicy;
        result.push(cloneBadges(next));
        if (current.canVote) {
          current.rightWeight = player.id === id ? weight : 1;
          result.push(cloneBadges(next));
        }
        // 每席随后不再被本命令写。只推进与实际末 CP 相符的整席分支，避免未知席位的2^N组合。
        if (!equal(current, actual.get(player.id))) {
          if (maySkip && equal(original, actual.get(player.id))) next.set(player.id, original);
          else break;
        }
      }
    }
    // 白痴原翻牌在徽命令之前写票权；没有晚发表事实的失败 CP 也可停在这两项写之间。
    for (const player of cp.players)
      if (player.role === Role.Idiot && data(player.privateState.idiot)?.revealed === true) {
        for (const prefix of [...result]) {
          const next = cloneBadges(prefix),
            view = next.get(player.id);
          if (!view) continue;
          view.canVote = false;
          result.push(cloneBadges(next));
          view.rightWeight = 0;
          result.push(next);
        }
      }
    return result;
  };
  let cursor = 0;
  const uncertain = new Set<number>();
  // 普通、无额外参与限制的冻结角色可提供一个确定的更早顺位；未知族仍是 unknown，不套运行 catalog。
  const plainSheriffRoles = new Set<Role>([
    Role.Wolf,
    Role.WolfKing,
    Role.WhiteWolfKing,
    Role.Villager,
    Role.Hunter,
    Role.Seer,
    Role.Witch,
    Role.Guard,
    Role.Knight,
    Role.Dreamer,
  ]);
  const plainlyEligible = (id: number, point: EventPoint): boolean | undefined => {
    const cp = e.record.checkpoints.filter((c) => c.eventCount <= point.index).at(-1) ?? first;
    const player = cp.players.find((p) => p.id === id),
      view = state.get(id);
    if (!player || !view || view.destroyed || !view.canVote) return false;
    if (
      e.episodes.some((x) => x.actorId === id && x.start >= cp.eventCount && x.start < point.index)
    )
      return undefined;
    if (!player.alive) return false;
    return plainSheriffRoles.has(player.role) ? true : undefined;
  };
  const apply = (point: EventPoint) => {
    const { event, index } = point,
      p = event.payload;
    if (event.type === "idiot_revealed" && positive(p.targetId)) {
      const view = state.get(p.targetId);
      if (view) {
        view.canVote = false;
        view.rightWeight = 0;
      }
    } else if (event.type === "sheriff_elected") {
      check(positive(p.winnerId) && e.ids.has(p.winnerId));
      for (const [id, current] of state) {
        // assign 只写当时活人；来源提案没有 physical receipt，不能把可能先死的席位一律重置。
        if (id !== p.winnerId && e.episodes.some((x) => x.actorId === id && x.start < index)) {
          uncertain.add(id);
          continue;
        }
        current.isSheriff = false;
        current.destroyed = false;
        current.voteWeight = weight;
        if (policy === "awa_holder_choice_v1") current.handoffPolicy = policy;
        else delete current.handoffPolicy;
        if (current.canVote) current.rightWeight = id === p.winnerId ? weight : 1;
      }
      state.get(p.winnerId)!.isSheriff = true;
    } else if (
      event.type === "sheriff_badge_transferred" ||
      event.type === "sheriff_badge_destroyed"
    ) {
      const from = event.type === "sheriff_badge_transferred" ? p.fromId : p.targetId;
      check(positive(from) && e.ids.has(from));
      const prior = state.get(from);
      check(prior);
      if (!delegated && !uncertain.has(from)) check(prior.isSheriff && !prior.destroyed);
      const previous = { ...prior };
      // 这个 reason 的原 writer 先关白痴票权，再进入徽命令，最后才发 idiot_revealed。
      if (p.reason === "idiot_revealed") {
        prior.canVote = false;
        prior.rightWeight = 0;
      }
      prior.isSheriff = false;
      prior.destroyed = true;
      prior.rightWeight = prior.canVote ? 1 : 0;
      if (event.type === "sheriff_badge_transferred") {
        check(positive(p.toId) && e.ids.has(p.toId) && p.toId !== from);
        const next = state.get(p.toId);
        check(next);
        if (!delegated && !uncertain.has(p.toId)) check(!next.destroyed);
        if (previous.handoffPolicy === "awa_holder_choice_v1") {
          const candidates = choiceGroups.filter(
            (w) => w[0]?.actorId === from && w[0]?.day === point.day,
          );
          if (!delegated) check(candidates.length > 0);
          if (candidates.length)
            check(
              candidates.some((w) => {
                const d = w.filter((x) => canPrecede(x, point)).at(-1);
                if (!d) return false;
                const listed = numbers(d.request.context.badge_candidates);
                return (
                  (!listed || listed.includes(p.toId as number)) &&
                  (opaque(d) || action(d, "choose_badge_successor")?.target_id === p.toId)
                );
              }),
            );
        } else if (!delegated) {
          const seats = new Map(first.players.map((player) => [player.id, player.seat]));
          const targetSeat = seats.get(p.toId)!;
          check(plainlyEligible(p.toId, point) !== false);
          for (const id of state.keys())
            if (id !== from && (seats.get(id) ?? id) < targetSeat)
              check(plainlyEligible(id, point) !== true);
        }
        next.isSheriff = true;
        next.destroyed = false;
        next.voteWeight = previous.voteWeight;
        if (previous.handoffPolicy === undefined) delete next.handoffPolicy;
        else next.handoffPolicy = previous.handoffPolicy;
        next.rightWeight = previous.voteWeight;
      }
    }
  };
  for (const cp of checkpoints) {
    check(cp.eventCount <= e.points.length);
    while (cursor < cp.eventCount) apply(e.points[cursor++]!);
    if (!delegated) {
      const actual = badgeView(cp);
      check(
        cp.complete
          ? badgeSame(state, actual, uncertain)
          : possibleUnpublished(state, cp).some((v) => badgeSame(v, actual, uncertain)),
      );
    }
    // 已观察 CP 是下一段的真实数据起点；不凭该值重建生命或撤销此前字段写。
    state = badgeView(cp);
    previousCheckpoint = cp;
    uncertain.clear();
  }
  // live 事实可领先最后 CP；仍审核事实自身，不能因尚无下一 CP 就略过确定矛盾。
  while (cursor < e.points.length) apply(e.points[cursor++]!);
}

export function validateDeathHistoryRecord(record: ReproductionRecord): void {
  const evidence = collectEvidence(record);
  auditShots(evidence);
  auditLastWords(evidence);
  auditBadges(evidence);
}
