/** 负责校验和拼接PCM WAV。输入为音频字节，输出采样数据和WAV；时长从采样数得到，不依赖外部编码器。 */
export function readPcmWav(bytes: Uint8Array) {
  const data = Buffer.from(bytes);
  if (
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WAVE" ||
    data.length < 44
  )
    throw new Error("tts_wav_invalid");
  let sampleRate = 0;
  let pcm: Buffer | undefined;
  for (let offset = 12; offset + 8 <= data.length;) {
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > data.length) throw new Error("tts_wav_truncated");
    const tag = data.toString("ascii", offset, offset + 4);
    if (tag === "fmt ") {
      if (
        size < 16 ||
        data.readUInt16LE(start) !== 1 ||
        data.readUInt16LE(start + 2) !== 1 ||
        data.readUInt16LE(start + 14) !== 16
      )
        throw new Error("tts_wav_format_unsupported");
      sampleRate = data.readUInt32LE(start + 4);
    }
    if (tag === "data") pcm = data.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!sampleRate || !pcm?.length || pcm.length % 2) throw new Error("tts_wav_invalid");
  return { sampleRate, pcm, samples: pcm.length / 2 };
}
export function writePcmWav(pcm: Uint8Array, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
