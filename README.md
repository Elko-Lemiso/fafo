# fafo

A party game for one TV and a room full of phones. The laptop plugged into the TV shows the game, and
everyone plays on their phone. Friends join by scanning a QR code, and nobody needs an account.

Play it at **https://fafo.up.railway.app**: open **https://fafo.up.railway.app/tv** on the laptop connected to the TV.

## Rounds

Pick any mix in the TV lobby under **Rounds tonight**:

- **Whose photo:** everyone adds up to 5 photos from their phone (baby pictures work great). Each one
  pops up on the TV and everyone guesses whose it is. Every photo gets played.
- **Whose song:** everyone picks up to 3 songs on their phone. The TV plays a clip and everyone guesses who picked it.
- **Name that tune:** the TV plays a clip and phones pick the song or the artist. Choose from about 50 genres,
  decades and moods, or type any artist or playlist.
- **Famous faces:** a photo of a well-known person sharpens from a blur. Answer early to score more.
- **Flags** and **Maps:** name the country from its flag or its outline.
- **Capitals:** pick a country's capital, with nearby capitals as the wrong answers.
- **Which is bigger:** two countries' flags side by side; pick the larger one.
- **Trivia:** general knowledge from Open Trivia DB, matched to the theme, with built-in questions if there's no internet.
- **Emoji puzzles:** a film or song told in emoji.
- **Most likely to:** "Who's most likely to miss a flight?" Everyone votes for a player; you score when you pick
  the same person as most of the room. Needs at least 3 players.
- **Imposter:** everyone gets the same secret word on their phone, except one person who gets a similar word
  (or no word, if you choose). Everyone says a one-word clue out loud in turn, talks it over, then votes. There's
  no clock: each step moves on when the players are ready. Spotting the imposter scores 500; an imposter who gets
  away scores 1,000. Needs at least 3 players.

A **Theme** ties the rounds together. Music makes the faces come from tonight's playlist, Africa keeps flags,
maps and faces African, and so on. **Length** sets how many quiz rounds each type gets.

Scoring: a right answer is 500 to 1,000 points, faster scores more. When someone guesses your photo or song
wrong, you get 250 points. The last round counts double. Each reveal shows who picked which answer; set
**Votes** to Anonymous in the lobby to show only how many picked each one. The game ends with a podium and
a few awards.

**Sound:** the TV plays effects and a background loop, all made in the browser, and goes quiet under song
clips. Browsers keep a page silent until someone clicks it, so press **Turn on sound** (or **Sound check**)
in the lobby. Pick Music and effects, Effects only, or Off.

**Pause:** press space (or P) on the TV, the Pause button, or Pause game on the phone of whoever started.
Nothing moves on and no answers count while paused; resuming counts down 3-2-1. If a player drops out
mid-question the game waits up to 20 seconds for them. The right arrow skips ahead.

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
  Most likely to prompts. `trivia-fallback.json` is the offline trivia set.
- `whos-who.html` is the original Claude artifact version, kept for reference.

Photos of famous people come from Wikipedia and Wikimedia Commons under free licences; song clips and cover art come from Deezer.
