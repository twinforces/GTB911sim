/**
 * Click sounds. Presentation only.
 * What: a thud on impact, a lower thud on initiation.
 * Why it lives in the View: muting the speakers cannot change fy(T).
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function ac(): AudioContext | null {
  return ctx;
}

export function playImpact(): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const noise = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 280;
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t);
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.5);
  const og = c.createGain();
  og.gain.setValueAtTime(0.18, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(og);
  og.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.52);
}

export function playInitiation(): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 1.1);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 220;
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  osc.connect(f);
  f.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 1.12);
}
