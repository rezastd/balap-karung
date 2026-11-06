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

## Scene

- Hemisphere + directional (shadow-mapped) lighting, fog, canvas-generated
  dirt/grass textures, PBR-ish `MeshStandardMaterial`s.
- 4 lanes, START/FINISH gates with "17 AGUSTUS • MERDEKA!" banners,
  red-white bunting triangles, waving Indonesian flags, cheering crowd,
  bazaar tents, distance markers, dust puffs + win confetti particles.
- Sack-wearing low-poly athletes (sack cone + capsule torso + head + arms)
  with squash-and-stretch hopping animation.
- Sound is 100% WebAudio oscillators (hop boings, countdown, fanfare) —
  no audio assets. Toggle with the 🔊 button.

## Files

- `index.html` — page, HUD, overlays, touch controls, import map
- `main.js` — all Three.js scene + gameplay code
- `style.css` — HUD/overlay/touch styling
- `README.md` — this file
