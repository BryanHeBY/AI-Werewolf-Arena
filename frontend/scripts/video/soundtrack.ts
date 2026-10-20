/** 负责视频的离线配乐与音效编排。输入为真实语音时间线、场景锚点和本地授权素材，输出独立声轨与混音；不改台词、字幕或画面时间。 */
import { createHash } from "node:crypto";
import { open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SpeechTimeline } from "../../src/speech-script";
import { readPcmWav } from "../tts/wav";
import { publishVideoDirectory } from "./publication";

export interface SoundtrackAnchor {
  sceneId: string;
  lineId?: string;
  offsetMs?: number;
}
export interface VideoSoundtrack {
  library: string;
  musicTransition?: { mode: "crossfade" } | { mode: "sequential"; gapMs: number };
  music: Array<{
    id: string;
    assetId: string;
    from: SoundtrackAnchor;
    rmsDb: number;
    fadeMs: number;
    offsetSeconds?: number;
  }>;
  effects: Array<{
    id: string;
    assetId: string;
    at: SoundtrackAnchor;
    peakDb: number;
    durationMs?: number;
  }>;
  endingFadeMs: number;
  endingSilenceMs: number;
}
interface AudioAsset {
  id: string;
  kind: "music" | "sfx";
  file: string;
  sha256: string;
  title: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  modifications?: string;
}
interface SoundtrackTimeline extends SpeechTimeline {
  audio: { file: string; sha256: string; sampleRate: number; samples: number };
}
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const gain = (db: number) => 10 ** (db / 20);
const db = (level: number) => 20 * Math.log10(Math.max(level, 1e-12));

export async function soundtrackCommand(args: string[]) {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`soundtrack_command_failed:${args[0]}:${stderr.slice(-1600)}`);
  return Buffer.from(stdout);
}
export function soundtrackAnchorSample(
  timeline: Pick<SpeechTimeline, "scenes" | "fps" | "durationFrames">,
  anchor: SoundtrackAnchor,
  sampleRate: number,
) {
  const scene = timeline.scenes.find((item) => item.id === anchor.sceneId);
  if (!scene) throw new Error(`soundtrack_scene_missing:${anchor.sceneId}`);
  const line = anchor.lineId ? scene.lines.find((item) => item.id === anchor.lineId) : undefined;
  if (anchor.lineId && !line) throw new Error(`soundtrack_line_missing:${anchor.lineId}`);
  const sample =
    Math.round(((scene.from + (line?.from ?? 0)) * sampleRate) / timeline.fps) +
    Math.round(((anchor.offsetMs ?? 0) * sampleRate) / 1000);
  if (
    !Number.isSafeInteger(sample) ||
    sample < 0 ||
    sample >= Math.ceil((timeline.durationFrames * sampleRate) / timeline.fps)
  )
    throw new Error("soundtrack_anchor_out_of_range");
  return sample;
}
export function soundtrackLoop(source: Float32Array, sampleRate: number, crossfadeSeconds = 2) {
  const frames = source.length / 2;
  const fade = Math.min(Math.round(crossfadeSeconds * sampleRate), Math.floor(frames / 4));
  if (!Number.isSafeInteger(frames) || fade < 2) throw new Error("soundtrack_loop_too_short");
  const middle = frames - 2 * fade;
  const result = new Float32Array((frames - fade) * 2);
  result.set(source.subarray(fade * 2, (frames - fade) * 2));
  for (let frame = 0; frame < fade; frame++) {
    const weight = frame / (fade - 1);
    for (let channel = 0; channel < 2; channel++)
      result[(middle + frame) * 2 + channel] =
        source[(frames - fade + frame) * 2 + channel]! * (1 - weight) +
        source[frame * 2 + channel]! * weight;
  }
  return result;
}
function levels(pcm: Float32Array) {
  let peak = 0,
    sum = 0;
  for (const value of pcm) {
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }
  if (!peak || !Number.isFinite(sum)) throw new Error("soundtrack_asset_silent_or_invalid");
  return { peak, rms: Math.sqrt(sum / pcm.length) };
}
function wavHeader(samples: number, sampleRate: number, float: boolean) {
  const bytesPerSample = float ? 4 : 2,
    channels = 2;
  const header = Buffer.alloc(44),
    length = samples * channels * bytesPerSample;
  if (length > 0xffffffff - 36) throw new Error("soundtrack_wav_too_large");
  header.write("RIFF");
  header.writeUInt32LE(length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(float ? 3 : 1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write("data", 36);
  header.writeUInt32LE(length, 40);
  return header;
}
export async function mixVideoSoundtrack(options: {
  timeline: string;
  soundtrack: VideoSoundtrack;
  directory: string;
}) {
  const timelineBytes = await readFile(options.timeline);
  const timeline = JSON.parse(timelineBytes.toString()) as SoundtrackTimeline;
  const { soundtrack } = options;
  if (timeline.timing !== "audio" || !Number.isSafeInteger(timeline.fps) || timeline.fps <= 0)
    throw new Error("soundtrack_audio_timeline_required");
  const voiceBytes = await readFile(timeline.audio.file);
  if (digest(voiceBytes) !== timeline.audio.sha256)
    throw new Error("soundtrack_voice_digest_mismatch");
  const voice = readPcmWav(voiceBytes);
  const rate = voice.sampleRate,
    total = Math.ceil((timeline.durationFrames * rate) / timeline.fps);
  if (
    voice.samples !== total ||
    voice.samples !== timeline.audio.samples ||
    rate !== timeline.audio.sampleRate
  )
    throw new Error("soundtrack_voice_samples_mismatch");
  const libraryFile = path.resolve(soundtrack.library);
  const library = JSON.parse(await readFile(libraryFile, "utf8")) as { assets: AudioAsset[] };
  const assets = new Map<
    string,
    { asset: AudioAsset; pcm: Float32Array; peak: number; rms: number }
  >();
  const ids = new Set([...soundtrack.music, ...soundtrack.effects].map((item) => item.assetId));
  for (const id of ids) {
    const asset = library.assets.find((item) => item.id === id);
    if (!asset || !asset.licenseUrl || !asset.sourceUrl)
      throw new Error(`soundtrack_asset_missing:${id}`);
    const file = path.resolve(path.dirname(libraryFile), asset.file);
    if (digest(await readFile(file)) !== asset.sha256)
      throw new Error(`soundtrack_asset_digest_mismatch:${id}`);
    const filter =
      asset.kind === "music"
        ? "highpass=f=60,lowpass=f=10000"
        : "silenceremove=start_periods=1:start_duration=0.001:start_threshold=-55dB";
    const bytes = await soundtrackCommand([
      "ffmpeg",
      "-v",
      "error",
      "-nostdin",
      "-threads",
      "1",
      "-i",
      file,
      "-af",
      filter,
      "-ac",
      "2",
      "-ar",
      String(rate),
      "-f",
      "f32le",
      "pipe:1",
    ]);
    let pcm = new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    if (asset.kind === "music") {
      const trim = Math.min(rate * 2, Math.floor(pcm.length / 16));
      pcm = soundtrackLoop(pcm.slice(trim * 2, pcm.length - trim * 2), rate);
    }
    assets.set(id, { asset, pcm, ...levels(pcm) });
  }
  const ms = (value: number) => {
    if (!Number.isFinite(value) || value < 0) throw new Error("soundtrack_duration_invalid");
    return Math.round((value * rate) / 1000);
  };
  const music = soundtrack.music.map((item) => {
    const asset = assets.get(item.assetId)!;
    if (
      asset.asset.kind !== "music" ||
      !Number.isFinite(item.rmsDb) ||
      item.rmsDb > -18 ||
      item.rmsDb < -70
    )
      throw new Error("soundtrack_music_level_invalid");
    return {
      ...item,
      center: soundtrackAnchorSample(timeline, item.from, rate),
      fade: ms(item.fadeMs),
      asset,
      gain: gain(item.rmsDb) / asset.rms,
    };
  });
  if (
    !music.length ||
    music[0]!.center !== 0 ||
    music.some((item, index) => index && item.center <= music[index - 1]!.center)
  )
    throw new Error("soundtrack_music_order_invalid");
  const silence = ms(soundtrack.endingSilenceMs),
    endingFade = ms(soundtrack.endingFadeMs);
  const transition = soundtrack.musicTransition ?? { mode: "crossfade" };
  if (!["crossfade", "sequential"].includes(transition.mode))
    throw new Error("soundtrack_transition_invalid");
  const gap = transition.mode === "sequential" ? ms(transition.gapMs) : 0;
  const beds = music.map((item, index) => {
    const next = music[index + 1];
    const from = index
      ? transition.mode === "sequential"
        ? item.center + Math.floor(gap / 2)
        : item.center - Math.floor(item.fade / 2)
      : 0;
    const to = next
      ? transition.mode === "sequential"
        ? next.center - Math.ceil(gap / 2)
        : next.center + Math.ceil(next.fade / 2)
      : total - silence;
    const fadeOut = next ? next.fade : endingFade;
    if (from < 0 || to > total || to <= from || item.fade + fadeOut > to - from)
      throw new Error("soundtrack_music_fade_invalid");
    const offset = Math.round((item.offsetSeconds ?? 0) * rate);
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("soundtrack_music_offset_invalid");
    return { ...item, from, to, fadeIn: item.fade, fadeOut, offset };
  });
  const effects = soundtrack.effects.map((item) => {
    const asset = assets.get(item.assetId)!;
    if (
      asset.asset.kind !== "sfx" ||
      !Number.isFinite(item.peakDb) ||
      item.peakDb > -6 ||
      item.peakDb < -60
    )
      throw new Error("soundtrack_effect_level_invalid");
    const from = soundtrackAnchorSample(timeline, item.at, rate);
    const length = Math.min(
      asset.pcm.length / 2,
      item.durationMs === undefined ? Infinity : ms(item.durationMs),
    );
    if (length < 1 || from + length > total - silence)
      throw new Error("soundtrack_effect_out_of_range");
    return { ...item, asset, from, to: from + length, gain: gain(item.peakDb) / asset.peak };
  });
  if (new Set([...beds, ...effects].map((item) => item.id)).size !== beds.length + effects.length)
    throw new Error("soundtrack_cue_duplicate");
  const version = digest(
    JSON.stringify({
      version: 1,
      implementation: digest(await readFile(import.meta.path)),
      timeline: digest(timelineBytes),
      soundtrack,
      assets: [...assets.values()].map((item) => item.asset),
    }),
  ).slice(0, 12);
  const destination = path.resolve(options.directory, `soundtrack-${version}`);
  return publishVideoDirectory(options.directory, async (candidate) => {
    const files = ["music.wav", "effects.wav", "mix-float.wav"];
    const handles = await Promise.all(files.map((file) => open(path.join(candidate, file), "wx")));
    let peak = 0,
      voiceSquare = 0,
      musicSquare = 0,
      effectSquare = 0;
    try {
      for (let i = 0; i < handles.length; i++)
        await handles[i]!.write(wavHeader(total, rate, i === 2));
      // 逐块叠加，避免长片的每个延迟音效各自分配整片静音缓冲。
      for (let start = 0; start < total; start += rate) {
        const count = Math.min(rate, total - start),
          musicPcm = new Float32Array(count * 2),
          effectPcm = new Float32Array(count * 2);
        for (const bed of beds) {
          const from = Math.max(start, bed.from),
            to = Math.min(start + count, bed.to),
            period = bed.asset.pcm.length / 2;
          for (let frame = from; frame < to; frame++) {
            const local = frame - bed.from;
            const envelope = Math.min(
              1,
              bed.fadeIn ? local / bed.fadeIn : 1,
              bed.fadeOut ? (bed.to - 1 - frame) / bed.fadeOut : 1,
            );
            const source = ((local + bed.offset) % period) * 2,
              target = (frame - start) * 2;
            musicPcm[target] += bed.asset.pcm[source]! * bed.gain * envelope;
            musicPcm[target + 1] += bed.asset.pcm[source + 1]! * bed.gain * envelope;
          }
        }
        for (const effect of effects) {
          const from = Math.max(start, effect.from),
            to = Math.min(start + count, effect.to);
          for (let frame = from; frame < to; frame++) {
            const local = frame - effect.from,
              target = (frame - start) * 2;
            const envelope = Math.min(
              1,
              local / Math.max(1, rate * 0.002),
              (effect.to - 1 - frame) / Math.min(rate * 0.08, (effect.to - effect.from) / 3),
            );
            effectPcm[target] += effect.asset.pcm[local * 2]! * effect.gain * envelope;
            effectPcm[target + 1] += effect.asset.pcm[local * 2 + 1]! * effect.gain * envelope;
          }
        }
        const musicBuffer = Buffer.alloc(count * 4),
          effectBuffer = Buffer.alloc(count * 4),
          mixed = Buffer.alloc(count * 8);
        for (let frame = 0; frame < count; frame++) {
          const speech = voice.pcm.readInt16LE((start + frame) * 2) / 32768;
          voiceSquare += speech * speech;
          for (let channel = 0; channel < 2; channel++) {
            const index = frame * 2 + channel,
              bgm = musicPcm[index]!,
              sfx = effectPcm[index]!,
              value = speech + bgm + sfx;
            if (Math.abs(bgm) >= 1 || Math.abs(sfx) >= 1) throw new Error("soundtrack_stem_clips");
            musicSquare += bgm * bgm;
            effectSquare += sfx * sfx;
            peak = Math.max(peak, Math.abs(value));
            musicBuffer.writeInt16LE(Math.round(bgm * 32767), index * 2);
            effectBuffer.writeInt16LE(Math.round(sfx * 32767), index * 2);
            mixed.writeFloatLE(value, index * 4);
          }
        }
        await handles[0]!.write(musicBuffer);
        await handles[1]!.write(effectBuffer);
        await handles[2]!.write(mixed);
      }
    } finally {
      for (const handle of handles) await handle.close();
    }
    const masterGain = Math.min(1, gain(-1) / peak);
    await soundtrackCommand([
      "ffmpeg",
      "-v",
      "error",
      "-nostdin",
      "-threads",
      "1",
      "-i",
      path.join(candidate, "mix-float.wav"),
      "-af",
      `volume=${masterGain}`,
      "-c:a",
      "pcm_s16le",
      path.join(candidate, "mix.wav"),
    ]);
    const master = path.join(destination, "mix.wav");
    const report = {
      version: 1,
      fps: timeline.fps,
      durationFrames: timeline.durationFrames,
      samples: total,
      sampleRate: rate,
      channels: 2,
      voice: timeline.audio,
      master,
      sha256: digest(await readFile(path.join(candidate, "mix.wav"))),
      stems: {
        music: path.join(destination, files[0]!),
        effects: path.join(destination, files[1]!),
      },
      ducking: false,
      masterGain,
      peakDb: db(peak * masterGain),
      musicTransition: transition,
      voiceRmsDb: db(Math.sqrt(voiceSquare / total)),
      musicRmsDb: db(Math.sqrt(musicSquare / (total * 2))),
      effectsRmsDb: db(Math.sqrt(effectSquare / (total * 2))),
      endingSilenceMs: soundtrack.endingSilenceMs,
      music: beds.map(({ asset, gain: level, ...item }) => ({
        ...item,
        normalizationGain: level,
        assetId: asset.asset.id,
        fromSeconds: item.from / rate,
        toSeconds: item.to / rate,
      })),
      effects: effects.map(({ asset, gain: level, ...item }) => ({
        ...item,
        normalizationGain: level,
        assetId: asset.asset.id,
        fromSeconds: item.from / rate,
        toSeconds: item.to / rate,
      })),
      credits: [...assets.values()].map((item) => item.asset),
    };
    await writeFile(
      path.join(candidate, "mix-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    await writeFile(
      path.join(candidate, "credits.txt"),
      report.credits
        .map(
          (asset) =>
            `${asset.title} — ${asset.author}\n${asset.license}\n${asset.sourceUrl}\n${asset.licenseUrl}\nChanges: ${[asset.modifications, "Volume adjusted, faded and mixed into the video."].filter(Boolean).join(" ")}`,
        )
        .join("\n\n") + "\n",
    );
    return { name: path.basename(destination), value: { directory: destination, ...report } };
  });
}
