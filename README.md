# Balap Karung 3D — 17 Agustus Sack Race Simulator 🇮🇩

A realistic 3D browser simulator of **Balap Karung** (Indonesian sack race),
the classic 17-Agustus Independence Day game. Race 50 m down a dirt track
against 3 AI opponents.

## Run

```bash
cd balap-karung
python3 -m http.server
# open http://localhost:8000
```

No build step. Three.js r160 loads from unpkg CDN via import map
(internet required).

## How to play / Cara main

| Input | Action |
|---|---|
| `◀` / `▶` or `A` / `D` **alternately** | Hop forward (rhythm = speed; same key twice = weak hop) |
| `SPACE` | Jump over kardus (cardboard) obstacles |
| `C` | Toggle follow-cam / free orbit cam |
| `R` / `Enter` | Restart |
| Touch buttons | ◀ KIRI, ▶ KANAN, ⤒ LOMPAT (mobile) |

- First to **50 m** wins. Stumbling on a box without jumping costs ~1 s.
- Stamina drains per hop and regenerates — pace yourself!
- HUD: timer ⏱, distance, live position P1–P4, progress bar, stamina bar.
- Overlays and results are bilingual (Indonesian + English).

## Scene — Realism upgrade

- **Renderer:** `ACESFilmicToneMapping` (exposure 1.1), sRGB output,
  `PCFSoftShadowMap`, warm sun + hemisphere + ambient bounce, fog.
- **Sky & environment:** gradient sky dome (canvas), drifting low-poly
  clouds, distant tree/house silhouette layer, village houses (walls +
  roof prisms), coconut trees (trunk + frond planes), warung tents.
- **Ground & track:** multi-layer procedural dirt (base + speckles +
  patches + roughness variation), grass, scattered grass tufts / stones /
  puddles, lane ropes + pegs, 10 m distance markers with number sprites,
  landing skid furrow decals that fade, START/FINISH gates, red-white
  bunting and vertex-wave Indonesian flags (sin-wave plane geometry).
- **Characters:** articulated racers — torso pivot at hips, head pivot
  at neck, shoulder arm pivots; varied skin tones / shirt colors, eyes +
  nose, cap/brim vs hair variation. Sack is burlap canvas texture (map +
  bump + roughness) with stitched seam and tied top rim; legs tucked in
  sack. Animation is physics-driven: limb swing phase tied to velocity /
  effort, arm flail from vertical velocity, torso lean, head bob,
  squash-stretch from hop physics (real parabola).
- **Crowd & feedback:** animated crowd (phase-offset jumps + arm waves)
  on both sides, cardboard obstacles with printed tape texture, dust
  bursts scaled by landing impact, subtle camera shake on landing /
  stumble, follow camera with lag, red-white confetti on win.
- **Performance:** shared geometries/materials, capped dust (240) /
  confetti (500) pools, reused temp vectors — no per-frame allocations
  in the hot loop.
- Sound is 100% WebAudio oscillators (hop boings, countdown, fanfare) —
  no audio assets. Toggle with the 🔊 button.

## Realism pass 2

- **Image-based lighting:** the sky gradient + sun disc + earth bounce are
  prefiltered with `PMREMGenerator` into `scene.environment`, so dirt,
  burlap and puddles pick up real sky colour instead of flat ambient.
- **Procedural normal maps:** a CPU Sobel pass derives tangent-space normal
  maps from the existing canvas textures — dirt track, lane stripes,
  grass, burlap sacks, cardboard boxes, bamboo.
- **Shadows:** 2048 map with `radius` blur + `normalBias`, shadow frustum
  follows the player down the track (crisp near, no acne).
- **Atmosphere:** warm near-horizon dust band, sun bloom sprite, animated
  wind gusts driving flags / bunting / clouds together, circling birds,
  drifting leaves, soft round dust sprites (was square points).
- **Camera:** handheld micro-sway layered on the follow cam.
- **Ambience:** synthesised wind bed, crowd murmur, grass hiss and random
  cicada chirps (WebAudio, no assets); mute with the 🔊 button.
- **Anatomy:** hands, collar, drooping coco-palm fronds with coconut
  clusters, sack-rim grip pose instead of a T-pose.


## Files

- `index.html` — page, HUD, overlays, touch controls, import map
- `main.js` — all Three.js scene + gameplay code
- `style.css` — HUD/overlay/touch styling
- `README.md` — this file
