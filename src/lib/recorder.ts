// Microphone capture -> 16 kHz mono WAV blob (complete, decodable file).

function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const ratio = sampleRate / targetRate;
  const outLength = Math.max(1, Math.floor(merged.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) out[i] = merged[Math.floor(i * ratio)] ?? 0;

  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, out.length * 2, true);
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export type Recorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const pcm: Float32Array[] = [];
  node.onaudioprocess = (e) => pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);

  const teardown = () => {
    stream.getTracks().forEach((t) => t.stop());
    node.disconnect();
    source.disconnect();
  };

  return {
    stop: async () => {
      teardown();
      const blob = encodeWav(pcm, ctx.sampleRate);
      await ctx.close();
      return blob;
    },
    cancel: () => {
      teardown();
      void ctx.close();
    },
  };
}

export async function transcribe(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "recording.wav");
  const res = await fetch("/api/public/transcribe", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Transcription failed.");
  return String(json?.text ?? "");
}
