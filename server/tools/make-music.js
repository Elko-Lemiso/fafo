// Makes the soundtrack (data/music.json) with ElevenLabs Music into public/music/<id>.mp3.
// Run it on your own computer; it needs ffmpeg. The API key is read from the environment or a .env file you point at,
// and never goes into the repo or the game; only the finished MP3s are committed.
//
//   node tools/make-music.js --env ~/path/to/.env   make new or changed tracks (key from ELEVENLABS_API_KEY in that file)
//   node tools/make-music.js --dry                  say what would be made, without the key
//   node tools/make-music.js --only lobby,quiz      just these tracks
//   node tools/make-music.js --again lobby --env …  make a fresh take of a track even though its prompt didn't change
//   node tools/make-music.js --reloop               cut the loops again from the takes already downloaded, no key needed
//
// Each take is kept in .music-raw/ at the top of the repo (not committed). A track loops by finding two moments a
// whole number of bars apart that sound the same, then blending the bit after the second into the start, so the end
// runs straight into the beginning. All tracks are brought to the same loudness, so switching between them doesn't jump.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "public", "music"), INDEX = path.join(OUT, "index.json");
const RAW = path.join(ROOT, "..", ".music-raw");
const args = process.argv.slice(2), flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const list = n => (opt(n, "") || "").split(",").map(s => s.trim()).filter(Boolean);
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SR = 44100, HOP = 441, FPS = SR / HOP, LUFS = -16, FADE = 1.5;

function keyFrom(file) {
  if (!file) return process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || "";
  const text = fs.readFileSync(file.replace(/^~(?=\/)/, os.homedir()), "utf8");
  const m = text.match(/^\s*(?:export\s+)?(?:ELEVENLABS_API_KEY|XI_API_KEY)\s*=\s*["']?([^"'\s#]+)/m);
  return m ? m[1] : "";
}
// ffmpeg reads big inputs from a temporary file rather than a pipe: writing a pipe while it writes one back can stall both.
function ff(argv, input) {
  const tmp = input && path.join(os.tmpdir(), `fafo-music-${process.pid}-${Math.random().toString(36).slice(2)}.f32`);
  if (tmp) fs.writeFileSync(tmp, input);
  try {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-v", "error", ...argv.map((a, i) => (a === "-" && tmp && argv[i - 1] === "-i" ? tmp : a))], { maxBuffer: 1 << 30 });
    if (r.error) throw new Error("ffmpeg isn't installed (brew install ffmpeg)");
    if (r.status) throw new Error("ffmpeg: " + r.stderr.toString().slice(0, 300));
    return r;
  } finally { if (tmp) fs.rmSync(tmp, { force: true }); }
}
// Stereo float samples, interleaved, at 44.1 kHz.
function decode(file) {
  const b = ff(["-i", file, "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"]).stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
}

// ---------- analysis ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// Per 10 ms frame: the loudness in 16 frequency bands (each band scaled to mean 0, spread 1) and how sharply it rose.
function features(mono) {
  const N = 2048, B = 16, frames = Math.floor((mono.length - N) / HOP), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const edges = Array.from({ length: B + 1 }, (_, b) => Math.round(50 * (14000 / 50) ** (b / B) / (SR / N)));
  const F = Array.from({ length: frames }, () => new Float64Array(B)), onset = new Float64Array(frames), re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = mono[f * HOP + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < B; b++) {
      let e = 0;
      for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) e += re[k] * re[k] + im[k] * im[k];
      F[f][b] = Math.log(1e-9 + e);
      if (f) onset[f] += Math.max(0, F[f][b] - F[f - 1][b]);
    }
  }
  for (let b = 0; b < B; b++) {
    let m = 0, v = 0;
    for (let f = 0; f < frames; f++) m += F[f][b];
    m /= frames;
    for (let f = 0; f < frames; f++) v += (F[f][b] - m) ** 2;
    const sd = Math.sqrt(v / frames) || 1;
    for (let f = 0; f < frames; f++) F[f][b] = (F[f][b] - m) / sd;
  }
  return { F, onset, frames, B };
}
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s / a.length; };

// The tempo, to a fraction of a frame: near what the prompt asked for (the music follows it closely), the beat period
// at which the onsets line up best with themselves 1, 2, 4, 8 and 16 beats later.
function tempo(onset, bpm) {
  const at = x => { const i = Math.floor(x), f = x - i; return (onset[i] || 0) * (1 - f) + (onset[i + 1] || 0) * f; };
  const r = lag => { let s = 0; for (let f = 2 * FPS; f + lag < onset.length; f += 2) s += onset[f] * at(f + lag); return s; };
  const lo = FPS * 60 / (bpm * 1.08), hi = FPS * 60 / (bpm * 0.92);
  let best = FPS * 60 / bpm, bestS = -Infinity;
  for (let p = lo; p <= hi; p += 0.02) { const s = [1, 2, 4, 8, 16].reduce((n, m) => n + r(m * p), 0); if (s > bestS) { bestS = s; best = p; } }
  return best;
}
// Where to loop: a whole number of bars close to the target length (4-bar phrases preferred) at which the track
// repeats best, then the start point along it where the few seconds either side match best, ideally on a beat.
// The start can be anywhere, so a loop can sit inside the take's main section rather than straddle its first change.
function findLoop(feat, target, bpm) {
  const { F, onset, frames } = feat, fade = Math.ceil(FADE * FPS), P = tempo(onset, bpm), bar = 4 * P, s0 = 2 * FPS;
  const maxL = frames - Math.max(fade, 4 * FPS) - s0 - 2;
  const D = l => { let s = 0, n = 0; for (let f = s0; f + l < frames; f += 3) { s += dist(F[f], F[f + l]); n++; } return s / n; };
  const top = [];
  for (let N = Math.ceil(target * 0.6 * FPS / bar); N * bar <= Math.min(target * 1.35 * FPS, maxL); N++) {
    let bl = 0, bd = Infinity;
    for (let l = Math.floor(N * bar * 0.985); l <= Math.ceil(N * bar * 1.015) && l <= maxL; l++) { const d = D(l); if (d < bd) { bd = d; bl = l; } }
    if (bl) top.push({ N, l: bl, d: bd + (N % 4 ? (N % 2 ? 0.5 : 0.3) : 0) + 0.006 * Math.abs(bl / FPS - target) });
  }
  if (!top.length) throw new Error(`the take is too short for a ${target} s loop`);
  top.sort((x, y) => x.d - y.d);
  // The loop starts on the strongest hit in the bar around it (usually the downbeat), so starting a track at the top,
  // or a whole number of bars in, always lands on the same beat.
  const W = Math.round(bar / 2), hit = new Uint8Array(frames);
  for (let a = W; a < frames - W; a++) { let m = 0; for (let f = a - W; f <= a + W; f++) m = Math.max(m, onset[f]); hit[a] = onset[a] > 0 && onset[a] === m ? 1 : 0; }
  let best = null;
  for (const { N, l, d } of top.slice(0, 6)) {
    const aMax = frames - l - Math.max(fade, 4 * FPS) - 2;
    for (let a = s0; a <= aMax; a++) {
      if (!hit[a]) continue;
      let s = 0, n = 0;
      for (let f = a - FPS; f < a + 4 * FPS; f++) { s += dist(F[f], F[f + l]); n++; }
      const score = s / n + 0.5 * d;
      if (!best || score < best.score) best = { a, l, N, score, match: s / n, global: d, P };
    }
  }
  return best;
}
// Lines the loop up to the sample. Two passes of a made track never match wave for wave, so it lines up the beats
// instead: the sharp rises in the high end just after the start and just after the end should land together.
function refine(mono, a, l) {
  const S = 16, A = Math.round(a * HOP / S), R = Math.round(2 * HOP / S), W = Math.round(4 * SR / S), n = Math.floor(mono.length / S);
  const h = new Float64Array(n), o = new Float32Array(n);
  for (let j = 0; j < n; j++) { let e = 0; for (let i = j * S; i < j * S + S; i++) if (i) e += (mono[i] - mono[i - 1]) ** 2; h[j] = Math.log(1e-9 + e); }
  for (let j = 4; j < n; j++) o[j] = Math.max(0, h[j] - h[j - 4]);
  const at = k => { const B = A + Math.round(l * HOP / S) + k; let c = 0, e1 = 0, e2 = 0; for (let t = 0; t < W; t++) { const x = o[A + t], y = o[B + t] || 0; c += x * y; e1 += x * x; e2 += y * y; } return c / (Math.sqrt(e1 * e2) || 1); };
  let best = 0, bestC = -Infinity;
  for (let k = -R; k <= R; k++) { const c = at(k); if (c > bestC) { bestC = c; best = k; } }
  return { L: l * HOP + best * S, corr: bestC, was: at(0) };
}
function loudness(stereo) {
  const tmp = path.join(os.tmpdir(), `fafo-music-${process.pid}-lufs.f32`);
  fs.writeFileSync(tmp, Buffer.from(stereo.buffer, stereo.byteOffset, stereo.byteLength));
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", tmp, "-af", "ebur128=peak=true", "-f", "null", "-"], { maxBuffer: 1 << 30 });
  fs.rmSync(tmp, { force: true });
  const t = r.stderr.toString(), I = t.match(/I:\s+(-?[\d.]+) LUFS/g), P = t.match(/Peak:\s+(-?[\d.]+) dBFS/g);
  return { I: I ? parseFloat(I.pop().split(/\s+/)[1]) : -20, peak: P ? parseFloat(P.pop().split(/\s+/)[1]) : 0 };
}
// Brings a loop to the target loudness. Peaks that would then clip go through a limiter, run over two passes of the
// loop so the join is treated like any other moment; the second pass is kept.
function level(loop) {
  const { I } = loudness(loop), g = 10 ** ((LUFS - I) / 20), two = new Float32Array(loop.length * 2);
  for (let i = 0; i < loop.length; i++) two[i] = two[i + loop.length] = loop[i] * g;
  const r = ff(["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "-", "-af", "alimiter=limit=0.89:attack=4:release=60:level=0", "-f", "f32le", "-"], Buffer.from(two.buffer)).stdout;
  const lim = new Float32Array(r.buffer, r.byteOffset, r.length / 4);
  return lim.slice(loop.length, loop.length * 2);
}
function process1(t, rawFile) {
  const x = decode(rawFile), n = x.length / 2, mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (x[2 * i] + x[2 * i + 1]) / 2;
  const feat = features(mono), loop = findLoop(feat, t.loop, t.bpm), { L, corr, was } = refine(mono, loop.a, loop.l);
  const A = loop.a * HOP, Fd = Math.round(FADE * SR), out = new Float32Array(L * 2);
  for (let i = 0; i < L; i++) {
    const w = i < Fd ? 0.5 - 0.5 * Math.cos(Math.PI * i / Fd) : 1;
    for (let c = 0; c < 2; c++) out[2 * i + c] = x[2 * (A + i) + c] * w + (w < 1 ? x[2 * (A + L + i) + c] * (1 - w) : 0);
  }
  const beatLen = L / SR / (4 * loop.N), out2 = level(out);
  const file = path.join(OUT, t.id + ".mp3");
  ff(["-y", "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "-", "-c:a", "libmp3lame", "-b:a", "128k", file], Buffer.from(out2.buffer));
  const { I } = loudness(out2);
  const info = { loop: +(L / SR).toFixed(5), beat: +beatLen.toFixed(5), bpm: +(60 / beatLen).toFixed(1), from: +(A / SR).toFixed(2), match: +loop.match.toFixed(3), corr: +corr.toFixed(3), lufs: +I.toFixed(1), kb: Math.round(fs.statSync(file).size / 1024) };
  console.log(`${t.id}: loop ${info.loop.toFixed(2)} s from ${info.from} s of the take, ${info.bpm} BPM (asked ${t.bpm}), ${loop.N} bars, match ${info.match} (lower is better), beats line up ${info.corr} (${was.toFixed(3)} before fine-tuning), ${info.lufs} LUFS, ${info.kb} KB`);
  return info;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "music.json"), "utf8")), MODEL = data.model || "music_v1";
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : { tracks: {} };
  const only = list("--only"), again = list("--again"), reloop = flag("--reloop");
  const hashOf = t => fnv([MODEL, t.ms, t.prompt].join("|"));
  const rawOf = (t, h) => path.join(RAW, `${t.id}.${h}.mp3`);
  const tracks = data.tracks.filter(t => !only.length || only.includes(t.id));
  const todo = tracks.filter(t => again.includes(t.id) || (!reloop && (index.tracks[t.id]?.h !== hashOf(t) || !fs.existsSync(path.join(OUT, t.id + ".mp3")))));
  const gen = todo.filter(t => again.includes(t.id) || !fs.existsSync(rawOf(t, hashOf(t))));
  console.log(`${todo.length} of ${data.tracks.length} tracks to make (${gen.length} new takes, ${Math.round(gen.reduce((n, t) => n + t.ms, 0) / 1000)} s of music, model ${MODEL})${reloop ? ", and every loop cut again" : ""}.`);
  if (flag("--dry")) return;
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(RAW, { recursive: true });
  const save = () => { index.model = MODEL; fs.writeFileSync(INDEX, JSON.stringify(index, null, 1)); };
  const KEY = gen.length ? keyFrom(opt("--env")) : "";
  if (gen.length && !KEY) { console.error("No key. Use --env <file with ELEVENLABS_API_KEY> or set ELEVENLABS_API_KEY."); process.exit(1); }
  let stop = false;
  // A few at a time: each take is made in one go and takes a minute or so.
  const take = async t => {
    if (stop) return;
    const h = hashOf(t), started = Date.now();
    let r;
    for (let tries = 0; tries < 4; tries++) {
      r = await fetch(`https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192`, {
        method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ prompt: t.prompt, music_length_ms: t.ms, model_id: MODEL, force_instrumental: true }),
      }).catch(e => ({ ok: false, status: 0, text: async () => e.message }));
      if (r.status !== 429 && r.status !== 0 && r.status < 500) break;
      await sleep(5000 * (tries + 1));
    }
    if (!r.ok) {
      const why = (await r.text()).slice(0, 200);
      console.error(`${t.id}: ElevenLabs said ${r.status} ${why}`);
      if ([401, 402, 403].includes(r.status)) stop = true; // bad key or out of credits: no point carrying on
      return;
    }
    fs.writeFileSync(rawOf(t, h), Buffer.from(await r.arrayBuffer()));
    console.log(`${t.id}: take made in ${Math.round((Date.now() - started) / 1000)} s`);
  };
  const queue = [...gen];
  await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await take(queue.shift()); }));
  for (const t of reloop ? tracks : todo) {
    const h = hashOf(t), raw = fs.existsSync(rawOf(t, h)) ? rawOf(t, h) : reloop && index.tracks[t.id] ? rawOf(t, index.tracks[t.id].h) : null;
    if (!raw || !fs.existsSync(raw)) { console.error(`${t.id}: no take to cut a loop from`); continue; }
    try { index.tracks[t.id] = { h: path.basename(raw).split(".")[1], ...process1(t, raw) }; save(); }
    catch (e) { console.error(`${t.id}: ${e.message}`); }
  }
  // Tracks that were taken out of music.json go too.
  const ids = new Set(data.tracks.map(t => t.id));
  for (const id of Object.keys(index.tracks)) if (!ids.has(id)) { delete index.tracks[id]; fs.rmSync(path.join(OUT, id + ".mp3"), { force: true }); }
  save();
  console.log(`${Object.keys(index.tracks).length} of ${data.tracks.length} tracks ready.`);
})().catch(e => { console.error(e.message); process.exit(1); });
