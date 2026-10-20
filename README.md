# fafo

A party game for one TV and a room full of phones. The laptop plugged into the TV shows the game, and
everyone plays on their phone. Friends join by scanning a QR code, and nobody needs an account.

Play it at **https://fafo.up.railway.app**: open **https://fafo.up.railway.app/tv** on the laptop connected to the TV.

## Rounds

The TV lobby shows the join code, who's in, and tonight's rounds. Whoever joined first is the host: their phone
opens with a **Tonight** card, and **Change** opens a full-screen game picker: **game nights** that set a whole night
in one tap (Get to know you, Party chaos, Quiz night, Music and movies, Just the two of us, Classic fafo), filters by
kind, and a card for every game with its icon, what it is, how many players it needs, what you do, and a **How to
play** section with the steps and the scoring. The TV's picker shows the same cards. The first time a game comes up
in a night, the TV and every phone show its three steps before it starts. Picks show on the phone straight away and reach the TV even when
tapped quickly. The same rounds and settings are under **Rounds & settings** on the TV:

- **Whose photo:** everyone adds up to 5 photos from their phone (baby pictures work great). Each one
  pops up on the TV and everyone guesses whose it is. Every photo gets played.
- **Whose song:** everyone picks up to 3 songs on their phone. The TV plays a clip and everyone guesses who picked it.
- **Whose answer:** everyone taps answers to four quick questions on their phone ("Dream weekend", "Worst
  habit"). The TV shows one answer nobody else picked, and the room guesses whose it is. Needs 3 players.
- **Who said it:** everyone answers one prompt about themselves on their phone ("Your go-to karaoke song"). Then
  each answer goes up on the TV and the room guesses who wrote it: 500 to 1,000 for a right guess, and 250 to the
  writer for every guess they fool. An answer two people both gave is skipped. Needs 3 players.
- **Two truths and a lie:** everyone types two true things about themselves and one lie. Then each player's three
  statements go up on the TV in a random order, and the room picks the lie: 500 to 1,000 for spotting it, and 250 to
  the writer for everyone who picked a truth. Needs 2 players.
- **Hot seat:** one player gets a question about themselves on their phone ("What would you grab first in a fire?")
  and answers honestly, while everyone else guesses what they picked from the same four options. A right guess scores
  500 to 1,000, and the player in the hot seat earns 200 for everyone who knew. Everyone gets a turn. Needs 2 players.
- **Quips:** everyone gets two prompts on their phone ("The worst thing to hear from your pilot") and types an
  answer. Each prompt went to two players, and the room votes for the funnier one: 250 a vote, plus 250 for
  taking every vote. With Quips on, the game ends with the **Last Lash**: one prompt for everyone, then
  everyone votes for the best. Needs 3 players.
- **Bluff:** a real but unlikely fact with a blank ("A group of flamingos is called a ___"). Everyone writes a
  fake answer, then picks the truth from among the fakes: 500 for finding it, 250 for every player your fake
  fools. Needs 3 players.
- **Mind meld:** players are paired up (one group of three if the numbers are odd) and each pair gets the same
  prompt ("A fruit", "A famous Kenyan"). Type what you think your partner will type, without talking: matching
  answers score 1,000 each. Case, "the", plurals, number words and a small typo don't stop a match. New pairs every
  round. Needs 2 players.
- **Name that tune:** the TV plays a clip and phones pick the song or the artist. Choose from about 50 genres,
  decades and moods, or type any artist or playlist.
- **Famous faces:** a photo of a well-known person sharpens from a blur. Answer early to score more.
- **Flags** and **Maps:** name the country from its flag or its outline.
- **Capitals:** pick a country's capital, with nearby capitals as the wrong answers.
- **Which is bigger:** two countries' flags side by side; pick the larger one.
- **Trivia:** general knowledge from Open Trivia DB, matched to the theme, with built-in questions if there's no internet.
- **Closest number:** "How tall is the Eiffel Tower, in metres?" Everyone types a number; the closest three
  score 1,000, 500 and 250, and spot on earns 500 more.
- **Guess the year:** "The Berlin Wall falls. What year was it?" Events, films, songs and birthdays; everyone types a
  year and it scores like Closest number. With it on, Closest number leaves out its year questions.
- **Higher or lower:** one card shows a number ("Mount Kenya, 5,199 m"), the next is hidden ("Kilimanjaro?"): higher or
  lower? Also taller or shorter for buildings, longer or shorter for rivers, and before or after for years. Two
  values are only paired when they're far enough apart that no source could flip the answer.
- **Odd one out:** four things, one doesn't belong. The reveal says why.
- **Emoji puzzles:** a film, song or TV show told in emoji. The clues tell the story (the door in Titanic,
  "mom's spaghetti") rather than spelling out the title.
- **Most likely to:** "Who's most likely to miss a flight?" Everyone votes for a player; you score when you pick
  the same person as most of the room. Needs at least 3 players.
- **Would you rather** and hot takes: pick a side; you score 200 when most of the room picked the same. Needs 3.
- **Never have I ever:** phones tap I have or Never, and the TV shows who. No points, just confessions. Needs 3.
- **Imposter:** everyone gets the same secret word on their phone, except one person who gets a similar word
  (or no word, if you choose). Everyone says a one-word clue out loud in turn, talks it over, then votes. There's
  no clock: each step moves on when the players are ready. Spotting the imposter scores 500; an imposter who gets
  away scores 1,000. Needs at least 3 players.
- **Fakin' it:** everyone gets the same question on their phone ("Who here is the best cook?", "How many countries
  have you been to?", "Can you swim?") except one player, who gets a different one. Everyone answers by pointing at a
  player, typing a number or tapping yes or no. Then the TV shows the real question and every answer; talk it over
  (no clock) and vote for the faker. Spotting them scores 500; a faker who gets away scores 1,000. Needs 3 players.
- **Draw it:** a drawing chain. Everyone gets a secret prompt ("a goat at a wedding") and draws it on their phone
  with a finger: colours, three brush sizes, undo. The next player sees only the drawing and types what it is, the
  next draws that guess, and so on, up to four steps. Then the TV walks through each chain card by card to show how
  far it drifted. A guess that nails what was being drawn scores 1,000 for the drawer and the guesser; a close one
  (a key word in common) 400. Drawings upload like photos and live in the server's memory. Prompts are in
  `server/data/draw.json`, with a `wild` list for No holds barred. Needs 3 players.
- **Lowest number wins:** everyone secretly picks a number from 1 to 10 on their phone. Numbers more than one player
  picked are knocked out, and the lowest number left wins. Three goes a round, worth 300, 600 and 1,000. The reveal
  shows who picked what, crosses out the clashes and lights up the winner. Needs 3 players.
- **Shot in the dark:** a grid on the TV (3×3, or 4×4 with six or more players). Each volley, everyone still in
  secretly picks a square to hide in and a square to shoot on their phone. All the shots land at once, and anyone
  hiding in a shot square is out. The out come back as ghosts who keep shooting. Every hit scores 200; the last one
  standing gets 1,000, or everyone who survives five volleys gets 500. Works with 2 players.
- **Split or steal:** two players face off over a pot of 2,000 points. They talk it out, then each picks Split or
  Steal in secret on their phone while everyone else bets on how it ends. Both split: 1,000 each. One steals: they
  take all 2,000. Both steal: nobody gets a thing. A right bet wins 300. Everyone faces off once before anyone goes
  twice. Works with 2 players.

**Difficulty** sets how believable the wrong answers are. On Normal and Hard, famous faces are up against people
who could pass for them (same job, same part of the world, same era, plus hand-picked look-alike groups in
`build-faces.py`); flags come with look-alikes like Chad and Romania; Capitals offer the city people mistake for
the capital (Sydney, Lagos, Mombasa); Which is bigger pairs countries of nearly the same size; emoji puzzles get
harder clues; trivia drops its easy questions. Look-alike flags and trap cities live in `server/data/geo.json`.

**Kenya pack:** with the Africa theme, about half of Trivia, Bluff and Odd one out is local (places, presidents,
runners, Sheng), and Guess the year and Higher or lower lean on African events, people and rivers. It lives in
`server/data/kenya.json`.

A **Theme** ties the rounds together. Music makes the faces come from tonight's playlist, Africa keeps flags,
maps and faces African, and so on. **Length** sets how many quiz rounds each type gets.

Scoring: a right answer is 500 to 1,000 points, faster scores more. When someone guesses your photo or song
wrong, you get 250 points. The last round counts double. Each reveal shows who picked which answer; set
**Votes** to Anonymous in Rounds & settings to show only how many picked each one. The game ends with a podium and
a few awards.

**Twists** (Rounds & settings, on by default): about one round in four gets a twist, announced on its title card
and on the phones: Double points, Underdog round (whoever's last scores triple), Lightning round (8 seconds),
Robbery (the fastest right answer steals 300 from the leader) or No guessing (a wrong answer loses 250). Never the
first round or the final, never two in a row, and only on rounds where it makes sense. The reveal says what it did.

**Reactions:** whenever a phone has nothing to do (reveals, scores, title cards, after locking in), it shows a row of
reactions. Tapping one floats it up the TV with your face: 😂 🔥 😱 👏 💀 🍻, BOO! and TOO EASY.

**Sharing:** at the end, every phone gets **Share the night**: a picture with the winner, everyone's score, the
awards, the best line of the night (the most-voted Quip or Last Lash answer) and a code to play, ready for the
group chat or a story. Each Draw it chain can be shared the same way. The pictures are made on the phone; nothing
is uploaded.

**Points are always on show.** Everyone's score runs along the top of the TV all game; during a reveal it waits until
the answer is out, then each player's points tick up. Every phone shows its own points and place at the top. Every
few rounds the scores page calls the race ("Amani takes the lead!", "Neck and neck!"): rows start where they stood
last time, the points count up, then everyone slides into their new place, with the leader crowned, the biggest haul
and the biggest climber called out. The phones show the full standings and how far you are from the next place.

**Fresh questions:** the friend modes have big pools (for example 260 Quips, 260 Most likely to, 220 Never have I
ever, 200 Would you rather, 200 Who said it, 250 Mind meld, 170 Hot seat, 160 Fakin' it, 330 Imposter pairs), and
the TV remembers what it has shown, across games and New room, so the same prompt doesn't come back until the
pool runs low, and then the ones seen longest ago come first. Trivia from Open Trivia DB skips questions the TV has
already asked.

**Spicy (18+):** set Spicy to Cheeky for dating, exes and group-chat prompts in Quips and Most likely to, or
Savage for friendly roasts. The scoreboard then dares whoever is last (they can always pass). Any phone can tap
**Too far** to skip a spicy round on the spot. **Drinks** adds a "Sip" line to each reveal for whoever lost it;
any drink counts. Prompts live in `server/data/quips.json` and `likely.json`.

**No holds barred (18+):** the top Spicy level, for adults who all want it. Sex, hookups, kinks, nudes, drinking and
filthy dares, in most rounds of Quips (and a filthy Last Lash), Most likely to, Never have I ever, Would you rather and
hot takes, Who said it, Hot seat, Mind meld, Imposter and Fakin' it. Every phone gets an adults-only warning in the
lobby, and Too far still skips anything. Each mode's data file has its own `wild` list (`nhie_wild`, `wyr_wild` and
`hot_wild` in `polls.json`; `lash_wild` and `dares_wild` in `quips.json`).

**Selfies:** each phone can take a selfie, which replaces the player's letter everywhere on the TV and the
phones. Selfies live in the server's memory only, like photos, and each phone re-sends its own after a restart.

**Sound:** the TV plays a soundtrack and effects. Browsers keep a page silent until someone clicks it, so press
**Turn on sound** (or **Sound check**) in the lobby. Rounds & settings picks Music and effects, Effects only, or Off.

**Soundtrack:** nine instrumental tracks made with ElevenLabs Music, in an Afro house and amapiano sound, each cut
into a seamless loop. The TV picks the track from what's happening and blends between them like a DJ:

| Track | When |
| --- | --- |
| `lobby` | The lobby. With nobody in, it sounds like the party next door, and opens up as people join |
| `social` | Guessing and voting on each other: Who said it, Most likely, Hot seat, the votes on written answers |
| `quiz` | Quiz questions against the clock |
| `write` | Typing answers on the phones |
| `suspense` | Imposter and Fakin' it, from the secret word to the vote |
| `final` | The last round |
| `groove` | Reveals and scores. It drops straight in on a downbeat |
| `victory` | The podium |
| `afterdark` | No holds barred: replaces the lobby and the reveal groove |

Each track carries on where it left off last time, so a night of questions doesn't hear the same opening bars over
and over. On top of that: the host's voice ducks the music, a pause muffles it, song clips silence it, the last five seconds
on the clock get a riser, and when time runs out the track winds down like a record being stopped before the reveal.
Without the files the TV falls back to a synth loop made in the browser. The prompts, tempos and loop lengths are in
`server/data/music.json`. To make the tracks again (it needs ffmpeg):

```
cd server
node tools/make-music.js --dry                        # what it would make
node tools/make-music.js --env ~/path/to/.env         # new or changed tracks, key from ELEVENLABS_API_KEY
node tools/make-music.js --again groove --env …       # a fresh take of one track
node tools/make-music.js --reloop                     # cut the loops again from the downloaded takes, no key needed
```

Each take is kept in `.music-raw/` (not committed). The tool finds two moments a whole number of 4-bar phrases apart
that sound the same, lines their beats up to the sample, blends the bit after the second into the start so the end
runs straight into the beginning, and brings every track to the same loudness.

**Host:** a host introduces rounds, reacts to reveals and roasts the scoreboard, with a caption on the TV
for every line. The lines are in `server/data/voice.json`. Record them once with ElevenLabs on your own
computer; the key stays on your machine and only the MP3s are committed:

```
cd server
node tools/make-voice.js --dry                        # what it would record
node tools/make-voice.js --env ~/path/to/.env         # a .env file with ELEVENLABS_API_KEY
node tools/make-voice.js --list --env ~/path/to/.env  # voices on your account; pick one with --voice "Name"
node tools/make-voice.js --env ~/path/to/.env --voice Liam --model eleven_multilingual_v2 --stability 0.3 --style 0.65
```

Run it again after editing lines; it only records new or changed ones. Without recordings the host shows
captions only. The current recordings use Liam on eleven_multilingual_v2 with low stability and high style, for an
excited game-show delivery; changing the voice, model or settings records every line again. The **Host** setting in
Rounds & settings picks voice and captions, captions only, or off.

**Pause:** press space (or P) on the TV, the Pause button, or Pause game on the phone of whoever started.
Nothing moves on and no answers count while paused; resuming counts down 3-2-1. If a player drops out
mid-question the game waits up to 20 seconds for them. N skips ahead (or the next-track button on a remote).

## Play on a TV without a laptop

The TV screen is just a web page, so anything on the TV with a browser can run it:

- **Smart TV browser** (Samsung Internet, LG's web browser, Sony, Hisense and others): open
  `fafo.up.railway.app`. TVs are recognised and open straight into the TV screen.
- **Fire TV Stick:** open the Silk browser and go to `fafo.up.railway.app/tv`.
- **Google TV / Android TV:** install a browser from the store (TV Bro works well) and go to the same address.

Press OK once on **Turn on sound** (it's already selected), then put the remote down: everyone joins by scanning
the QR code, and whoever joins first can change every setting and start the game from their phone. Older TVs
(roughly 2019 onwards) are fine: the server rewrites the page's script for older browser engines.

## Run it on your laptop

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd server
npm install
npm start
```

`npm install` is only needed the first time. `npm start` prints something like:

```
  fafo is running.

  TV (this laptop):   http://localhost:3000/tv
  Phones join at:     http://192.168.1.23:3000/  (or scan the QR code on the TV)
```

1. Open the **TV** link in a browser on the laptop that's plugged into the TV. Click **Full screen**.
2. Everyone scans the QR code on the TV with their phone camera and types a name.
   If a phone can't scan, type the address shown under the QR code into its browser, then the room code.
3. The first player to join gets the **Start game** button on their phone. The laptop has one too, or press Enter.

Press Ctrl+C in the terminal to stop. Photos live only in the server's memory and are gone when it stops.
Flags, maps and fonts work without internet; music, famous faces and artist photos need it.

## If phones can't connect

- **macOS firewall:** the first time, macOS may ask whether `node` can accept incoming connections. Click Allow.
  If you missed it, go to System Settings → Network → Firewall → Options and allow `node`.
- **Guest or venue Wi-Fi:** these often block devices from reaching each other. Turn on your phone's hotspot,
  connect the laptop and the other phones to it, and restart `npm start` so it picks up the new address.
- **Wrong address in the QR code:** if the laptop has several networks, set the address yourself:
  `HOST_IP=192.168.1.23 npm start`. The startup message lists the other addresses it found.
- **Port in use:** the server tries 3000, then 3001 and onwards. To choose one: `PORT=8080 npm start`.

## Keeping an eye on it

**One screen per room.** Only one screen can run a game. If the same room opens on a second screen or in another
tab (or an old game gets reopened), that screen pauses with "Already open somewhere else" instead of fighting the
first one, so phones never jump between two versions of the game. "Use this screen" moves the game there; the
first screen then says it moved. A TV that reloads mid-round picks up where it was, with the answers already in.

**The watcher** (`server/watch.js`) keeps a short log of what's going on: rooms, phases, players joining and
leaving, commands like Start and Play again, second screens, TVs that reload mid-game, and errors from the pages.
It never records names, answers, photos or anything typed; players show as a short tag. It lives in memory (the
last few thousand events, gone on restart) and is also printed to the server's output (Railway's logs).
Open `/watch` to see it live: on a laptop it's open, on a public server it needs `WATCH_KEY`
(`/watch?key=…`). `/api/watch?key=…&code=ABCD` gives one room's log as JSON.

## Put it online (Railway)

The `server` folder is self-contained, so you can also host the game at a public address.
Then phones can join over mobile data, with no shared Wi-Fi needed.

- Deploy from `server/` with `railway up`. Railway runs `npm start`, and `.railwayignore` keeps `node_modules` out of the upload.
- Railway sets `PORT`, and the server listens on it.
- The QR code points at `PUBLIC_URL` when that's set, otherwise at `https://$RAILWAY_PUBLIC_DOMAIN`.
- On a public server, a phone only sees the room whose code it scanned or typed.
- Run a single replica only. Photos and live rooms live in that one server's memory, and a restart or redeploy clears them.

## How it works

- `server/server.js` is a small Express and Socket.IO server. It serves the page, relays live state between the
  TV and the phones, and keeps uploaded photos in memory.
- `server/public/index.html` is the whole game: the TV screen and the phone controller. The TV tab runs the game.
- `server/quiz.js` serves the country list, flags (flag-icons) and world map (world-atlas) for flag and map rounds.
- `server/music.js` finds songs, 30-second clips and artist photos through Deezer's free API, and real artist
  photos through Wikipedia.
- `server/data/faces.json` is the famous-faces list with Wikipedia photos. Rebuild it with `python3 server/data/build-faces.py server/data/faces.json`.
- `server/data/imposter.json`, `emoji.json` and `likely.json` hold the Imposter word pairs, emoji puzzles and
  Most likely to prompts. `said.json`, `meld.json`, `hot.json` and `fakin.json` hold the Who said it, Mind meld, Hot seat and Fakin' it prompts; `hilo.json` the Higher or lower and Guess the year facts; `kenya.json` the Kenya pack; `draw.json` the Draw it prompts. `trivia-fallback.json` is the offline trivia set.
- `whos-who.html` is the original Claude artifact version, kept for reference.

Photos of famous people come from Wikipedia and Wikimedia Commons under free licences; song clips and cover art come from Deezer.
