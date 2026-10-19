// Records the host's lines (data/voice.json) with ElevenLabs into public/voice/<id>.mp3.
// Run it on your own computer. The API key is read from the environment or a .env file you point at,
// and never goes into the repo or the game; only the finished MP3s are committed.
//
//   node tools/make-voice.js --env ~/path/to/.env      record new or changed lines (key from ELEVENLABS_API_KEY in that file)
//   ELEVENLABS_API_KEY=... node tools/make-voice.js    same, key from the environment
//   node tools/make-voice.js --dry                     say what would be recorded and how many characters, without the key
//   node tools/make-voice.js --list --env …            list the voices on your account
//   node tools/make-voice.js --voice "George" --env …  record everything again in another voice
//   --model eleven_multilingual_v2 --stability 0.3 --style 0.65   how it's said: lower stability and more style
//                                                      sound livelier. Changing any of these records everything again.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "public", "voice"), INDEX = path.join(OUT, "index.json");
const args = process.argv.slice(2), flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
// Same hash as the game page: the TV only plays a recording whose text still matches the line.
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };

function keyFrom(file) {
  if (!file) return process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || "";
  const text = fs.readFileSync(file.replace(/^~(?=\/)/, os.homedir()), "utf8");
  const m = text.match(/^\s*(?:export\s+)?(?:ELEVENLABS_API_KEY|XI_API_KEY)\s*=\s*["']?([^"'\s#]+)/m);
  return m ? m[1] : "";
}
const num = (n, d) => { const v = Number(opt(n, "")); return opt(n, "") !== "" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const KEY = keyFrom(opt("--env"));
  if (!KEY && !flag("--dry")) { console.error("No key. Use --env <file with ELEVENLABS_API_KEY> or set ELEVENLABS_API_KEY."); process.exit(1); }
  const api = (p, o = {}) => fetch("https://api.elevenlabs.io" + p, { ...o, headers: { "xi-api-key": KEY, ...(o.headers || {}) } });
  if (flag("--list")) {
    const r = await api("/v1/voices");
    if (!r.ok) { console.error("ElevenLabs said " + r.status); process.exit(1); }
    for (const v of (await r.json()).voices) console.log(`${v.name}  ·  ${[v.labels?.accent, v.labels?.description, v.labels?.use_case].filter(Boolean).join(", ")}`);
    return;
  }
  const lines = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "voice.json"), "utf8")).lines;
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : { lines: {} };
  const voiceName = opt("--voice", index.voice || "Charlie");
  // The model and voice settings default to whatever the last recording used.
  const MODEL = opt("--model", index.model || "eleven_turbo_v2_5"), was = index.settings || { stability: 0.35, style: 0.45 };
  const settings = { stability: num("--stability", was.stability), similarity_boost: 0.8, style: num("--style", was.style), use_speaker_boost: true };
  const redo = flag("--force") || (index.voice && index.voice !== voiceName) || (index.model && index.model !== MODEL)
    || (index.settings && (index.settings.stability !== settings.stability || index.settings.style !== settings.style));
  const todo = lines.filter(l => redo || index.lines[l.id] !== fnv(l.t) || !fs.existsSync(path.join(OUT, l.id + ".mp3")));
  console.log(`${todo.length} of ${lines.length} lines to record, ${todo.reduce((n, l) => n + l.t.length, 0)} characters, voice "${voiceName}", model ${MODEL}, stability ${settings.stability}, style ${settings.style}.`);
  if (flag("--dry") || !todo.length) return;

  const vr = await api("/v1/voices");
  if (!vr.ok) { console.error(`ElevenLabs said ${vr.status}. Check the key.`); process.exit(1); }
  const voices = (await vr.json()).voices || [], low = voiceName.toLowerCase();
  const voice = voices.find(v => v.name.toLowerCase() === low) || voices.find(v => v.name.toLowerCase().startsWith(low))
    || (/^[A-Za-z0-9]{20}$/.test(voiceName) ? { voice_id: voiceName } : null);
  if (!voice) { console.error(`No voice called "${voiceName}". Run with --list to see yours.`); process.exit(1); }
  if (redo) index.lines = {};
  index.voice = voiceName; index.model = MODEL; index.settings = { stability: settings.stability, style: settings.style };
  fs.mkdirSync(OUT, { recursive: true });
  let done = 0;
  for (const l of todo) {
    let r;
    for (let tries = 0; tries < 4; tries++) {
      r = await api(`/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_64`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: l.t, model_id: MODEL, voice_settings: settings }),
      });
      if (r.status !== 429 && r.status < 500) break;
      await sleep(2000 * (tries + 1));
    }
    if (!r.ok) {
      console.error(`\n${l.id}: ElevenLabs said ${r.status} ${(await r.text()).slice(0, 160)}`);
      if ([401, 402, 403].includes(r.status)) break; // bad key or out of credits: no point carrying on
      continue;
    }
    fs.writeFileSync(path.join(OUT, l.id + ".mp3"), Buffer.from(await r.arrayBuffer()));
    index.lines[l.id] = fnv(l.t);
    fs.writeFileSync(INDEX, JSON.stringify(index, null, 1)); // saved after every line, so a stopped run keeps its progress
    done++; process.stdout.write(".");
  }
  // Recordings of lines that were deleted from voice.json go too.
  const ids = new Set(lines.map(l => l.id));
  for (const id of Object.keys(index.lines)) if (!ids.has(id)) { delete index.lines[id]; fs.rmSync(path.join(OUT, id + ".mp3"), { force: true }); }
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  console.log(`\nRecorded ${done}. ${Object.keys(index.lines).length} of ${lines.length} lines now have audio.`);
})().catch(e => { console.error(e.message); process.exit(1); });
