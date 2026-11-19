# HOLLOWCAST

An editor for making analog horror. You build a film out of scenes, then wreck it with VHS damage, broadcast overlays, VFX, 3D and your own scripts. It records gameplay (Minecraft or anything else) through the same effects, so you can make ARG-style footage.

It runs as a Windows `.exe` or in any modern browser. Everything happens on your computer and nothing is uploaded.

## Download

- **Windows app:** open the [Releases](../../releases) page and download `HOLLOWCAST-…-portable.exe` (runs without installing) or the setup `.exe` (installs it with a Start menu shortcut).
- **Web version:** once GitHub Pages is on, it's at `https://vividp1xels.github.io/hollowcast/`.

Windows may warn that the app is from an unknown publisher, because it isn't code-signed. Click **More info → Run anyway**.

## What it does

**Editing**
- Scene timeline: add, duplicate, split (`B`), delete, and drag to reorder
- Trim video scenes with in and out points, and set durations for stills, cards and live sources
- Transitions: cut, fade from black, static burst, vertical roll, hard glitch, plus an optional fade out
- Undo and redo (`Ctrl+Z` / `Ctrl+Shift+Z`) and autosave
- Save and open project files (`.json`)
- **Export film** renders the whole timeline, with audio, to a `.webm` video

**Sources**
- Video and images (drag them onto the screen or use **+ Add files**)
- 🎮 **Game capture:** any game window (Minecraft, Roblox, Garry's Mod…) or your whole screen, live. In the Windows app, game audio is recorded too
- Webcam, SMPTE color bars with custom text, and black

**Tape damage:** static, scanlines, chroma shift, color bleed, edge ringing, ghosting, line wobble, frame jitter, tracking errors, head-switching noise, dropouts, vertical roll and random glitches.

**VFX:** mirror (2-way and 4-way), pixelate, video feedback with zoom and spin, datamosh, invert flashes, bit crush, a thermal camera palette, tints and vignette.

**Overlays:** VCR display (PLAY, REC, PAUSE, STOP), date stamp, running clock, corner label (`CAM 03`), emergency text crawl, title cards with a typewriter effect, and subliminal single-frame flashes.

**Audio:** tape hiss, mains hum, low drone, 1 kHz test tone, wow and flutter, and glitch bursts.

**Looks:** Found tape, Rotted tape, Emergency broadcast, Surveillance, Night shift, Clean. You can copy a scene's look to every scene.

## Effect library: 1,104 effects

**46 effect families × 24 tuned variants**, in eight categories: Distort, Glitch, Color, Stylize, Film, Weather, Horror and Time. Each variant has its own seeded settings, so *Drowned Kaleidoscope* and *Feral Kaleidoscope* really are different. Search the library, click an effect to stack it on the current scene, set each layer's amount, reorder or switch layers off, or use **🎲 Random effect** and **Chaos ×3**.

Families include: kaleidoscope, tile repeat, ripple, melt, heat haze, fisheye, vortex, polar void, tunnel, splitting seam, earthquake, block shuffle, torn fields, flip flicker, static patches, corrupt text, pixel sort, channel rot, negative ghost, hue drift, duotone, gradient map, solarize, strobe, edge glow, carved, 1-bit dither, halftone, terminal ASCII, film burn, light leak, scratched print, black rain, ashfall, fog bank, bleeding frame, heartbeat, redacted, flashlight, zoom echo, spin echo, slit scan, stutter, motion reveal, time split and afterimage.

## Character creator: monsters, people, creatures

Add procedural 3D characters to any scene and shape them with sliders: height, build, hunch, number of arms and legs (0–10), limb length, head size and stretch, neck, eyes (0–16, any color, optional glow), mouth and teeth, horns, skin color, pose (stand, crawl, spider) and animation (idle, sway, walk, approach, twitch, stare, head spin, float, reach). Characters can flicker in and out and fade into the dark.

Starting types: Human, Tall man, Faceless, Smiler, Monster, Crawler, Spider, Child, Puppet, Wendigo and Many-armed. **🎲 Random monster** invents a new one each time. Put several characters in one scene.

## Inspiration

The **Inspiration** button opens a guide to well-known analog horror (Local 58, Gemini Home Entertainment, The Mandela Catalogue, The Walten Files, Kane Parsons' Backrooms, Marble Hornets, Petscop and more), with what each does well and a link to find it, plus a search box for the whole genre.

## Scripting, generative art and 3D

Every scene has a JavaScript layer that runs each frame, before the tape damage is applied. Pick an example from **Script / VFX / 3D** to start:

- Spinning cube, The figure approaches (3D), Watching eyes, Hypnotic spiral, Falling ash
- Image flicker (flashes an image from your media), Film countdown, Glitch on the beat
- Clean HUD (drawn on top of the damage), Your 3D model (`.obj` import)

```js
// a figure that turns to face you, then the tape tears
render3d(figure(), { z: 3, ry: Math.min(t, 3) * 1.05, color: '#111' });
if (t > 3 && every(0.5)) glitch();
set('noise', 20 + t * 8);           // any effect can be driven per frame
```

Script API:

| | |
|---|---|
| `ctx`, `W`, `H` | 2D canvas (640×480) |
| `t`, `T`, `dt`, `frame` | scene time, global time, frame delta, frame number |
| `state` | object that persists while the scene plays |
| `rand() noise(x,y,z) lerp clamp map` | randomness and smooth noise |
| `text(str, x, y, {size, color, align})` | VHS-font text |
| `image(name)`, `drawImage(name, x, y, w, h, {alpha, blend})` | use any image or video from your media |
| `cube() sphere() torus() pyramid() plane() figure() box() merge()` | 3D meshes |
| `model('file.obj')` | an imported 3D model (drop a `.obj` into the media bin) |
| `render3d(mesh, {x,y,z, rx,ry,rz, scale, color, wire, stroke, light, fog, cam, fov})` | flat-shaded 3D |
| `character({type, z, eyes, arms, anim, …})` | any character from the creator |
| `effect('Drowned Kaleidoscope', 80)` | any library effect by name |
| `glitch() flash() burst(level, secs) every(seconds)` | events |
| `set('effectName', value)` | override any slider for this frame |
| `after(c => …)` | draw on top of the finished, damaged frame |

Scripts are ordinary JavaScript running on your own machine. Only load scripts from projects you trust.

## Making ARG videos from Minecraft (or any game)

1. Start the game in **windowed** or **borderless** mode.
2. In HOLLOWCAST, pick a scene and click **🎮 Game capture**, then choose the game window.
3. Pick a look such as *Surveillance* or *Night shift*, set a `CAM 04` corner label, and add a script (try *The figure approaches* with `ctx.fillRect` removed so it's drawn over the game).
4. Click **Record live** while you play, or build the timeline and use **Export film**.

## Accounts

The app asks for an email and password before you can edit. The account is stored **only on this computer**: the password is hashed with PBKDF2, and the email is never sent anywhere. That makes it a local lock, not a cloud account. Real accounts that sync between devices need a server. The easiest route is to add a hosted auth service (Supabase, Firebase or Clerk) inside `auth.js`.

## Building it yourself

```bash
npm install
npm start          # run the desktop app
npm run dist:win   # build the Windows .exe into dist/
```

The web version needs no build. Open `index.html` through any local web server, for example `python3 -m http.server`.

### Releasing a new .exe from GitHub

Every push to `main` runs **Build Windows app** on GitHub's Windows machines and publishes the `.exe` to the Releases page, named after `"version"` in `package.json`. To ship a new version, bump that number (for example to `1.0.1`) and push.

To turn on the web version: go to **Settings → Pages** and set **Source** to **GitHub Actions**. Then open **Actions → Publish web version → Run workflow**.

## Tips

- Keep the HOLLOWCAST window visible while exporting, because export runs in real time.
- Exports are `.webm`. Most editors and YouTube accept them as is. Use HandBrake or ffmpeg if you need `.mp4`.
- The project file saves your edits but not your media files. Keep the media next to the project and add them again after opening it: scenes relink by file name.

## License

MIT. The VT323 font is © Peter Hull, under the SIL Open Font License (`fonts/OFL.txt`).
