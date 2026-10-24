# EO LAB Web — Michelson Interferometer Design

- **Date:** 2026-10-24
- **Status:** approved; built on branch `feat/michelson` (see `docs/superpowers/plans/2026-10-24-eo-lab-web-michelson.md`)
- **Scope:** the Michelson experiment page and the lobby card that opens it. Experiment 1 (`docs/superpowers/specs/2026-10-17-eo-lab-web-experiment-1-design.md`) is the reference for everything this spec does not change.

## 1. Background and goal

The handout chapter is 光電實驗講義V3（徐巍峰）實驗十六「邁克森干涉儀實驗」(`16-邁克森干涉儀實驗.doc`). Its goal is for students to understand interference and how a Michelson interferometer is set up. Its procedure (§4) is: (1) lay out the parts roughly, with M1 and M2 about equally far from the beam splitter; (2) build the collimated beam as in Experiment 1 and close the second iris; (3) level the beam, centre the beam splitter and turn each mirror so its reflection goes back along the incoming path; (4) tune M1 until fringes are clear; (5) measure the coherence length by moving M1; (6) put a convex lens in each arm to get ring fringes.

The VR app's Michelson scene draws two spots and a hand-tuned interference shader whose phase follows the path lengths. The web version computes the fringes from the real beams, like Experiment 1.

**Goal:** a browser version of the Michelson experiment that follows the handout's steps (3), (4) and (6) the way the user's lab does them, with everything on screen computed from paraxial optics.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Light source | Ready-made: the Experiment 1 expander (laser, spatial filter, f = 200 mm lens, iris) is already aligned. Only the power switch and the iris are controls |
| Laser | Green 532 nm, the same as Experiment 1 |
| Placing parts | Free placement on the breadboard; the hole grid is the reference. Tips help a student who gets lost |
| Alignment practice (the user's lab) | Slide the screen along each arm's hole row, near and far: the spot must stay on the same point of the card. Then turn each mirror until its reflected spot comes back onto the iris hole |
| Coherence length | Not measured (handout step 5 is skipped). It is still in the physics: fringes need the two arms matched within about one hole |
| Ring fringes | Two 2-inch convex lenses, f = 100 mm, one per arm. The answer: each lens about 10 cm from its mirror, placed and slid by the student |
| Approach | A new page with its own state, steps and breadboard tracer, reusing the tested optics and UI modules. Experiment 1 behaviour does not change |

### Non-goals for this build

Measuring the coherence length, white-light fringes, a compensator plate, corner-cube reflectors, measuring refractive index or vibration, and the Mach–Zehnder interferometer (its own spec).

## 2. Users and platforms

As Experiment 1 §2: students of 光電實驗(一) with mouse or touch, current desktop and mobile browsers with WebGL 2, served over http(s), no network requests at runtime.

## 3. Student experience

### 3.1 Pages

- **`index.html` — lobby.** The 邁克森干涉儀 / Michelson interferometer card becomes active, with a short description and a 開始實驗 Start link to `michelson.html`. The Mach–Zehnder card stays 「即將推出 / Coming later」.
- **`michelson.html` — the experiment.** Title 「EO LAB · 邁克森干涉儀」 / "EO LAB · Michelson".

### 3.2 Page layout

As Experiment 1 §3.2: the 3D table fills the page; a top bar (back to lobby; progress 開始 · 1 · 2 · 3 · 4 · 完成, only the current chip below 768 px; the mm:ss timer that stops at 完成; 中 / EN; 重新開始 Restart); the side panel (bottom sheet on narrow screens) with the step card, controls, a collapsed 其他控制 group and readouts; close-up insets top left; toasts for warnings.

### 3.3 Bench and parts

Table coordinates match Experiment 1: **z** along the source beam, away from the laser; **x** across the table, positive to the right when looking along +z (toward the front edge, where the camera usually is); **y** height above the table. The source beam runs along the hole row x = 0 at y = 100 mm.

- **Breadboard** 1400 × 900 mm: z from −500 to 900 mm, x from −450 to 450 mm, M6 holes every 25 mm (z = −475 … 875, x = −425 … 425).
- **Parts rack** along the back edge (−x side), off the working area, as in Experiment 1. Parts not needed yet are locked, with a tooltip naming their step.
- **Ready source**, fixed on row x = 0 and not movable: laser (exit at z = −320 mm), spatial filter (pinhole at z = −270 mm), collimating lens f = 200 mm (z = −70 mm), iris (z = −25 mm). It delivers a collimated beam, 2W = 22.2 mm (Experiment 1 eq. 1-1), clipped by the iris. The holes it covers cannot take parts.

| Part (zh / en) | Placement | Adjustable | Range / steps |
|---|---|---|---|
| 雷射光源 Ready source | fixed | 電源 power; 光圈 iris opening (slider) | Ø 1.0–12.0 mm, step 0.1 mm; starts at 12.0 mm |
| 分光鏡 Beam splitter (50:50 plate, Ø 25.4 mm, ring mount on a rotation stage) | on a hole; heading in 45° steps | 旋轉 rotation (about the vertical); 俯仰 tilt | rotation ±50 mrad, fine 0.05 mrad, coarse 1 mrad; tilt ±20 mrad, fine 0.05 mrad, coarse 1 mrad |
| 反射鏡 M1 (Ø 25.4 mm flat mirror, kinematic mount, on a micrometer stage) | on a hole; heading in 45° steps | 水平 / 垂直 horizontal and vertical tilt knobs; 測微頭 micrometer stage | tilts ±25 mrad, fine 0.02 mrad, coarse 0.5 mrad; stage 0–25 mm, fine 0.05 µm, coarse 10 µm, starts at 12.5 mm |
| 反射鏡 M2 (the same mirror and mount, no stage) | on a hole; heading in 45° steps | horizontal and vertical tilt knobs | as M1 |
| 觀測屏幕 Screen (150 × 150 mm card with the target paper, Experiment 1 §3.8) | on a hole; heading in 45° steps | — (also used as the alignment card) | — |
| 凸透鏡 L1, L2 (2″, Ø 50.8 mm, f = 100 mm) | on a hole row, sliding along it in 1 mm steps (clamping fork); heading in 45° steps | — | — |

Rules:
- A part's **position** is the point its optic sits over: the plate centre (BS), the mirror surface (M1 at stage reading 12.5 mm; the stage moves the mirror along its normal, larger readings away from the face it looks at), the card centre, the lens plane. All optics are centred at y = 100 mm.
- A part's **heading** is the direction its optical face points, in 45° steps. A newly placed part faces the laser (−z); the beam splitter starts at the heading that reflects the beam toward +x (the front).
- Each part arrives with a small, fixed hand error (§4.1), corrected with its knobs.
- Footprints are rectangles turned with the part (BS 40 × 40 mm, M1 60 × 50 mm, M2 40 × 40 mm, lens 20 × 70 mm, screen 20 × 160 mm); two footprints keep a 5 mm gap. Parts must stay on the breadboard and off the source's holes.
- Removing a part: drag it back to the rack, or press its 移除 Remove button.

### 3.4 Interaction

- **Camera:** as Experiment 1. Presets: 全景 Overview (looking down at the whole table), 光源 Source (the iris face), 分光鏡 Beam splitter, 屏幕 Screen.
- **Placing and moving:** drag a part from the rack or the table; it follows the pointer and snaps to the hole under it (lenses: to the hole row under it, in 1 mm steps along the row); release to place. A refused spot (overlap, off the table) snaps back. On touch: tap a part, then tap a hole.
- **Turning:** ⟲ / ⟳ buttons next to the selected part (and the R key) turn it by 45°.
- **Panel alternatives** for keyboard and no-WebGL use: 放上 Place (the part's layout-guide position, §3.6, or the nearest free hole to it), hole column / row steppers (±1 hole; lenses ±1 mm along the row, ±1 row across), ⟲ / ⟳, 移除 Remove.
- **Knobs:** as Experiment 1 (dial, −/+ with fine / coarse, hold to repeat, arrow keys).
- **Tap the table:** a 輕拍桌面 Tap the table button (from step 3) makes the fringes shake and settle (§4.9).

### 3.5 Steps (handout §4 steps 3, 4 and 6)

Checks are evaluated continuously; 下一步 Next is enabled while all of the current step's checks pass. Step ids: `miStart`, `mi1` … `mi4`, `miDone` (i18n keys `step.<id>.…`, questions `question.mi1` … `question.mi5`).

**開始 Start** (`miStart`)
- Do: turn on the laser. The light source is already aligned as in Experiment 1. Never look into the beam.
- Check: laser on.

**步驟1 分光鏡 — Step 1: beam splitter** (`mi1`)
- Do: close the iris to the minimum. Put the beam splitter on a hole in the beam's row and turn it to about 45°: the reflected spot appears on a perpendicular row. Put the screen on that row near the beam splitter, then farther away, and turn and tilt the beam splitter until the spot stays on the target centre at every hole: the reflected beam then runs along the hole row, level with the table. The transmitted beam keeps the source's row.
- Checks:
  1. `irisClosed` — iris opening ≤ 1.5 mm.
  2. `bsOnBeam` — the beam hits the beam splitter within 2 mm of its centre.
  3. `along` — the reflected beam runs along a hole row: within 1 mrad of the row direction, and within 1 mrad of level.
  4. `cardTested` — during this step the screen caught the reflected beam at two places at least 150 mm apart along it.
- Hints: (1) close the iris; the beam runs along the centre row, so the beam splitter goes on a hole in that row; (2) at 45° the reflected beam leaves along a perpendicular row; (3) slide the screen along that row: a spot that drifts sideways means turn the beam splitter, a spot that drifts up or down means tilt it; (4) when the spot stays on the target centre near and far, the reflected beam runs along the holes.

**步驟2 反射鏡 — Step 2: mirrors** (`mi2`)
- Do: put M1 on the transmitted beam's row and M2 on the reflected beam's row, the same number of holes from the beam splitter. Each mirror sits slightly crooked: turn its knobs until its reflected spot comes back onto the iris hole (the iris close-up labels the two spots 1 and 2); the light then returns into the laser.
- Checks:
  1. `onBeams` — one mirror on each arm, each hit within 3 mm of its centre.
  2. `equalArms` — the two beam-splitter-to-mirror distances differ by at most 12.5 mm (the same hole count).
  3. `returned` — with the iris still closed (≤ 1.5 mm), both reflected spots land within 0.5 mm of the iris hole centre.
- Hints: (1) count the holes from the beam splitter to each mirror; (2) look at the iris close-up: spot 1 is M1's, spot 2 is M2's; (3) a spot to one side means turn that mirror's horizontal knob, a spot above or below means its vertical knob; (4) both spots on the hole: both beams go back exactly the way they came.

**步驟3 干涉條紋 — Step 3: fringes** (`mi3`)
- Do: open the iris and put the screen at the fourth side of the beam splitter, facing it, where both returning beams leave together. Fine-tune M1's knobs until a few broad, straight fringes cross the spot. (Perfectly parallel beams give a uniform spot.) M1's micrometer makes the fringes scroll: one fringe for every λ/2 of mirror travel.
- Checks:
  1. `irisOpen` — iris opening ≥ 8 mm.
  2. `screenOut` — both returning beams land on the screen.
  3. `overlap` — their centres on the screen are within 1 mm of each other.
  4. `visible` — fringe contrast V ≥ 0.5 (§4.5).
  5. `spacing` — straight-fringe spacing between 1 and 5 mm.
- Think cards: handout questions (1) the conditions for two beams to interfere; (2) whether perfectly parallel, overlapping beams show fringes without lenses, and how to get straight fringes; (4) what tapping the table does to the fringes (with the Tap the table button).
- Hints: (1) open the iris; (2) the combined beam leaves the beam splitter on the side opposite M2; (3) many thin fringes mean the beams cross at too large an angle: make them more parallel with M1's fine steps; (4) no fringes at all: the beams are exactly parallel, so tilt M1 a little; or the arms differ by more than the coherence length, so count the holes again.

**步驟4 環狀干涉 — Step 4: ring fringes** (`mi4`)
- Do: put a 100 mm lens in each arm, between the beam splitter and the mirror, and slide it along the row. About one focal length (10 cm) from the mirror the light focuses on the mirror and rings appear on the screen once the two lenses sit at slightly different distances.
- Checks:
  1. `lensesIn` — one lens in each arm between the beam splitter and the mirror, the beam within 1 mm of its centre.
  2. `focusOnMirror` — each lens 100 ± 10 mm from its mirror, along the beam.
  3. `rings` — at least 3 rings across the spot, with the ring centre inside the spot (§4.5).
- Think cards: handout questions (3) Fizeau, Mach–Zehnder and Sagnac interferometers; (5, challenge) how the Michelson differs from the Mach–Zehnder.
- Hints: (1) one lens per arm, centred on the beam; (2) about 10 cm from the mirror the focus lands on the mirror; (3) both lenses at exactly the same distance give no rings: move one by 1–2 mm; (4) more rings mean a bigger difference between the two lens distances.

**完成 Done** (`miDone`)
- Summary: the layout matches the handout's Fig. 16-3; time taken; number of warnings. Button: restart with a new random setup.

### 3.6 Tips when lost

The 提示 Hint button first shows a **tip about what is wrong right now**, computed from the bench, then the step's general hints one at a time. After the last hint a 版面參考 **Layout guide** toggle draws the standard arrangement as faint outlines on the table: beam splitter at z = 300 mm on row x = 0 (reflecting toward +x), M1 at z = 500 mm on row x = 0, M2 at x = +200 mm on row z = 300 mm, screen at x = −250 mm on row z = 300 mm, and in step 4 the lenses 100 mm from each mirror. In step 1 the screen's guide position is the alignment card on the reflected row instead (x = +100 mm on row z = 300 mm, facing the beam splitter); from step 2 it is the output position. The panel's Place button uses the same positions. The first matching tip is shown, for example:

| Step | Situation | Tip (zh) |
|---|---|---|
| 1 | the beam misses the beam splitter | 光束沿著中央那排孔前進，把分光鏡放在這一排的孔上。 |
| 1 | the reflected beam is off its row by θ | 反射光偏離孔排 {θ} mrad：左右偏用旋轉旋鈕，上下偏用俯仰旋鈕。 |
| 1 | the card has not been tried near and far | 把屏幕放在反射光那排孔上，先靠近分光鏡，再移遠至少 150 mm。 |
| 2 | a mirror is off its beam by d | {mirror} 離光束 {d} mm，把它移到光束經過的那排孔上。 |
| 2 | the arms differ by n holes | 兩臂相差 {n} 個孔位，數一數孔，讓兩面鏡子離分光鏡一樣遠。 |
| 2 | a reflected spot is off the iris hole | {mirror} 的反射光點偏離光圈中心 {d} mm，調整它的{knob}旋鈕。 |
| 3 | the fringes are finer than 1 mm | 條紋太密（{s} mm），用 M1 的微調讓兩道光更平行。 |
| 3 | the beams are almost exactly parallel | 兩道光幾乎完全平行，所以看不到條紋：把 M1 稍微轉一點。 |
| 3 | the contrast is low | 兩臂光程差 {dl} mm，超過同調長度：數孔位，或用 M1 的測微頭。 |
| 4 | a lens is far from its focal distance | {lens} 離鏡子 {d} mm，焦點應該落在鏡面上（約 100 mm）。 |
| 4 | the two lenses sit at the same distance | 兩個透鏡離鏡子一樣遠，所以沒有環：把其中一個移 1–2 mm。 |

English versions live in `en.js`.

### 3.7 Warnings

| Id | Fires when | Message (zh) |
|---|---|---|
| `miBs` | after step 1: the beam splitter is moved, turned or tilted | 分光鏡已對準，移動它會讓兩臂都要重新對準。 |
| `miStage` | M1's stage reaches either end of its travel | M1 已到微調平台的行程極限，請把整個 M1 移一個孔位。 |
| `m5` (shared) | a locked part is taken from the rack | 這個元件在步驟 {step} 才會用到。 |

A warning shows once and re-arms when its condition stops being true, as in Experiment 1.

### 3.8 Readouts

- 屏幕光功率 Power at screen (% of the laser power).
- 條紋對比 Fringe contrast V (0–1).
- 條紋間距 Fringe spacing (mm), or 「—」 when there are no straight fringes.
- 環數 Rings (count), once a lens is on the table.

### 3.9 Close-up insets

- **Iris face (光圈正面):** the iris plate and hole (Experiment 1's iris close-up) with each reflected spot drawn where it lands, labelled 1 (from M1) and 2 (from M2). Open by default in steps 1–2.
- **Screen (觀測屏幕):** the computed fringe image (§4.8) with the mm ruler and the target paper. Open by default from step 1 (it doubles as the alignment-card view).

### 3.10 Visual style

As Experiment 1 §3.9. The beam splitter is a thin, slightly mirrored glass disc in a ring on a rotation stage; the mirrors are silvered discs in square kinematic mounts with two knobs; M1 sits on a linear stage with a micrometer; the 2″ lenses are large clear discs; the ready source reuses the Experiment 1 models (laser, spatial filter, lens, iris) on a short rail.

### 3.11 Glossary additions

| 中文 | English |
|---|---|
| 分光鏡 | beam splitter |
| 反射鏡 | mirror |
| 干涉條紋 | interference fringes |
| 條紋間距 / 對比 | fringe spacing / contrast |
| 光程差 | optical path difference |
| 同調長度 | coherence length |
| 環狀干涉 | ring fringes |
| 微調平台 / 測微頭 | translation stage / micrometer |
| 麵包板孔位 | breadboard hole |

## 4. Physics

Internal units are SI. Constants live in `js/michelson/config.js`; shared optics constants stay in `js/optics/config.js`.

### 4.1 Parameters and random start

| Quantity | Value |
|---|---|
| Wavelength λ | 532 nm |
| Source beam | collimated Gaussian, field radius W = 11.1 mm, along x = 0 at y = 100 mm, clipped by the iris (radius a = opening / 2) at z = −25 mm |
| Beam splitter | thin plate, intensity reflectance R = 0.5 and transmittance T = 0.5, Ø 25.4 mm |
| Mirrors | reflectance 1, Ø 25.4 mm |
| Lenses | thin, f = 100 mm, clear aperture Ø 48 mm |
| Coherence length | l_c = 30 mm |
| Screen | Experiment 1's card (150 mm, target paper) |

Hidden hand errors, drawn once per run from the seeded generator (`?seed=` reproduces a run), each with a random sign:
- beam splitter heading U(0.5°, 2°) and tilt U(0.1°, 0.5°);
- M1 and M2: horizontal and vertical tilt U(0.2°, 1°) each.

All lie inside the knob ranges, so every run is solvable.

### 4.2 Ray tracing (centre rays)

Each beam is traced as a centre ray in 3D, starting at the iris, (x, y, z) = (0, 100 mm, −25 mm), going +z, with power 1 × the iris transmission (Experiment 1 §4.7, Gaussian through a hole).
- Every placed part is a plane through its position, with a normal from its heading, hand error and knobs, holding an optic aperture (a disc; the screen's is its 150 mm square) inside its mount face. A ray meets the nearest part plane ahead of it whose mount face it hits; inside the optic aperture the part acts on it, outside it the ray stops on the mount.
- **Beam splitter:** the ray splits into a reflected child (direction d − 2(d·n)n, power × R) and a transmitted child (direction unchanged, power × T).
- **Mirror:** reflection; a tilt error ε turns the beam by 2ε.
- **Lens:** thin-lens deflection of the direction by −(p − c)/f in the lens plane (paraxial), where p is the hit point and c the lens centre.
- **Screen:** the ray stops; its hit point is recorded in card coordinates (u to the right and v up as seen facing the card).
- **Iris and source face (returning rays):** the ray stops on the source face, a 60 mm square around the iris; its offset from the hole centre is recorded for the iris close-up, which draws the whole face, so a spot that misses the iris itself (a mirror up to 1° off in both tilts) still shows. Light through the hole returns into the laser and is not traced further.
- Rays also stop when they leave the breadboard, fall below 1 % power, or after 8 interactions.
- Each ray keeps its optical path length from the beam-splitter split point (for the arms) and its path signature.

### 4.3 Beam size and curvature per ray

Along each ray a paraxial ray matrix (A B; C D) is multiplied up: free space P(d), lens L(f), flat surfaces identity. For the parallel input rays, at the end point the beam is magnified by A (spot radius |A|·a, Gaussian radius |A|·W) and its wavefront radius is R = A / C (infinite when C = 0; positive = diverging). A lens at distance f + δ from its mirror gives, for the double pass, A = −1 − 2δ/f and C = 2δ/f², the same as a diverging lens of focal length f²/(2δ) (δ = 1 mm → 5 m). When |A|·a falls below 50 µm (the screen at a focus), a diffraction-limited Gaussian spot of that size is used instead.

### 4.4 Fields on the screen

Each ray i reaching the screen gives a field on the card, s = (u, v):

E_i(s) = √(P_i) · g_i(s) · exp(i·φ_i(s)), with
- g_i(s) = exp(−|s − c_i|² / (A_i W)²) inside the disc |s − c_i| ≤ |A_i| a, zero outside, normalised so that ∫|g_i|² = 1;
- φ_i(s) = k·OPL_i + k·t_i·(s − c_i) + k·|s − c_i|² / (2R_i), where k = 2π/λ, c_i is the hit point and t_i the ray direction's components along u and v.

The two arms each reach the screen with P = R·T = 0.25 of the beam power.

### 4.5 Interference and fringe numbers

I(s) = Σ_i |E_i|² + Σ_{i<j} 2|E_i||E_j| · V_ij · S_ij(s) · cos(φ_i − φ_j + ψ(t)), where
- V_ij = exp(−ln 5 · (2ΔL_ij / l_c)²) is the contrast set by the path difference ΔL_ij = OPL_i − OPL_j (V = 0.2 at ΔL = l_c / 2);
- S_ij(s) = sinc(|∇(φ_i − φ_j)| · p / 2) averages fringes finer than a pixel of size p, so dense fringes turn grey instead of aliasing;
- ψ(t) is the tap-the-table phase (§4.9), added to one arm.

Fringe numbers for the checks and readouts, from the two arm rays:
- contrast V = V_12;
- relative tilt α = |t_1 − t_2|; straight-fringe spacing Λ = λ / α (shown as 「—」 above 50 mm);
- ring count N = a_s² · |1/R_1 − 1/R_2| / (2λ), with a_s the smaller spot radius on the screen;
- ring centre s*: where ∇(φ_1 − φ_2) = 0, i.e. (t_1 − t_2) + (s* − c_1)/R_1 − (s* − c_2)/R_2 = 0; "inside the spot" means |s* − c| < a_s with c the mean of the two hit points.

### 4.6 Reflected spots on the iris

The returning arm rays cross the beam splitter again; the halves heading back to the source land on the iris plane. Their offsets from the hole centre and their spot radii feed the iris close-up and the `returned` check.

### 4.7 Beam drawing

The traced rays become the glowing segments of Experiment 1's beam view (start, end, radius from §4.3, power), outgoing and returning. Spots where rays end (screen, iris, mounts, table edge) are drawn on the surface they hit, facing along its normal.

### 4.8 Screen image

Experiment 1's renderer draws I(s) on the 256 × 256 window (2.5 × the combined spot diameter, clamped to 5–150 mm) and on the 128 × 128 card texture. Brightness is v = √(I / I_peak), with I_peak = the centre intensity two perfectly aligned arms would give (constructive), and Experiment 1's green-to-white colour on the dim card, with the target paper printed over it. The square root keeps fringe contrast readable (Experiment 1's log curve would flatten it).

### 4.9 Tap the table

ψ(t) = 3π · e^(−t / 0.4 s) · sin(2π · 12 Hz · t + φ_0) with a random φ_0, for 1.5 s. Meanwhile the screen close-up and card redraw every animation frame; nothing else changes.

### 4.10 Stated simplifications

Thin beam splitter (no plate offset, ghosts or dispersion); thin lenses without aberrations; clipping without diffraction rings; geometric beam spread outside foci; scalar, monochromatic light with a smooth Gaussian spectrum (no laser mode revivals); a mirror's tilt does not shift its surface; parts stand perfectly upright apart from the listed tilts.

## 5. Architecture

Plain ES modules, no build step, three.js 0.170.0 as in Experiment 1.

```
eo-lab-web/
  michelson.html              the page
  js/
    michelson-app.js          input → state → bench → scene, close-ups, panel, steps
    michelson/
      config.js               every Michelson constant and tolerance in this spec
      state.js                parts on holes, headings, hand errors, knob values, placement rules
      bench.js                michelsonBench(state) → everything observable
      steps.js                STEPS, checks, hints, tips, warnings, card-trial tracking
    optics/
      tracer.js               3D centre-ray tracing through posed parts (§4.2–4.3); reusable for Mach–Zehnder
      interference.js         sampler for I(s) and the fringe numbers (§4.4–4.5)
    scene/
      table.js                breadboard picking and dragging: hole snapping, 1 mm lens slides, 45° turns
      michelson-models.js     beam splitter, kinematic mirror mounts (M1 on its stage), 2″ lenses, ready source
```

Changed, backward-compatibly:
- `index.html` / `js/lobby.js` — the Michelson card becomes a link.
- `js/scene/beam.js` — spots take an optional surface normal (default: facing along the rail, as now).
- `js/ui/insets.js` — the iris close-up takes several labelled beams (the single `beam` form keeps working).
- `js/i18n/zh-TW.js`, `en.js` — the Michelson strings (`lobby.michelson.*`, `step.mi*.*`, `question.mi*`, `tip.mi*`, `warning.mi*`, `control.mi.*`, `readout.mi.*`).
- `js/optics/rng.js` — a new salt for the hand errors.
- `js/optics/screen.js` — `brightPixel` (a card lit with no tone curve, for the fringes).
- `js/ui/panel.js` — `renderTip` (the tip line under the hint button).
- `js/scene/view.js` — custom camera presets and a world point to look at.
- `js/scene/models.js` — `createScreenModel` with a pixel mapping; `buildLaser` exported.
- `css/style.css` — the tip line, the placement buttons, and the close-up toggles on a line of their own on narrow screens.
- `tests/page.js` — the iframe page loader, shared by the two page tests.

Reused unchanged: `js/optics/{config,gaussian,iris}.js`, `js/ui/{controls,toast,clock,target}.js`, `js/scene/{interact,webgl}.js` and the Experiment 1 part models.

**Data flow:** as Experiment 1: UI or 3D input → `state.js` → `michelsonBench(state)` → scene, close-ups, panel, checks. `steps.js` evaluates checks from (state, result, flow), warnings from (flow, previous state, state, result), and records card trials from each result.

**Key interfaces**
- `createMichelsonState(seed)`; `placePart(state, id, hole, heading)`; `movePart`; `turnPart`; `removePart`; `setValue(state, path, value)` — every update returns a new state; a refused update returns the same object.
- `trace(source, parts) → { rays, hits }` — each ray: points, direction, power, OPL, signature, ray matrix, end (screen, iris, part, edge).
- `interferenceSampler(beams, { coherenceLength, pixel, extraPhase }) → (u, v) => intensity`; `fringeNumbers(beamA, beamB, coherenceLength) → { contrast, alpha, spacing, rings, centre }`.
- `michelsonBench(state, { render, tapPhase }) → { laserOn, rays, segments, spots, iris: { spots }, screen: { window, card, beams }, fringe, power, arms }`.
- `STEPS`, `evaluateChecks`, `canAdvance`, `advance`, `detectWarnings`, `observe(flow, result)` (card trials), `tipFor(flow, state, result) → { key, params }`.

**Performance budget:** `michelsonBench` under 10 ms (no Fourier transforms); a full redraw under 16 ms; tap-the-table animation at the display rate.

## 6. Testing

TDD with the existing headless runner (`python tools/run_tests.py`); Experiment 1's 83 tests must keep passing.

**Tracer** (`tests/optics/tracer.test.js`):
1. A mirror tilted by ε turns a ray by 2ε (±1e-9 rad).
2. A beam splitter at 45° sends the reflected child at 90° and keeps the transmitted direction; powers 0.5 / 0.5.
3. Thin-lens deflection −(p − c)/f; a lens at f + δ from a mirror gives the double-pass matrix A = −1 − 2δ/f, C = 2δ/f² (±1e-9).
4. Rays end on the screen, the iris, the table edge, or after 8 interactions.

**Interference** (`tests/optics/interference.test.js`):
1. Two equal collimated beams with relative tilt α: the fringe period measured in the rendered profile is λ/α (±2 %).
2. Contrast 0.2 at ΔL = 15 mm and 1 at ΔL = 0 (±1e-9).
3. Different curvatures and zero path difference (a bright centre): the n-th bright ring radius is √(2nλ / |1/R₁ − 1/R₂|) (±2 %).
4. Fringes finer than a pixel average to the mean intensity (contrast < 0.05).

**State** (`tests/michelson/state.test.js`): hole snapping and lens 1 mm slides; refused overlaps and off-table spots; hand errors within their ranges for 200 seeds; the same seed gives the same state; updates never mutate their input.

**Bench and steps** (`tests/michelson/bench.test.js`, `steps.test.js`):
- The standard layout with corrected knobs gives zero path difference, overlapping spots and returned spots on the iris hole.
- Each check fails for its typical mistake: the beam splitter off the beam row; the reflected beam 2 mrad off its row; M2 one hole farther than M1 (no fringes); a mirror 1 mrad off (spot off the iris hole); beams exactly parallel (no straight fringes); both lenses at 100 mm (no rings).
- Ideal actions complete every step for five seeds.
- Card trials need two places at least 150 mm apart; warnings fire and re-arm; tips match their situations.

**Page** (`tests/michelson-app.test.js`): boots without errors, turns the laser on, advances to step 1, places the beam splitter with the panel controls. The lobby test checks the Michelson card links to `michelson.html`. The i18n test checks every Michelson step, check, hint, question, tip and warning key exists in both languages.

**Manual checks:** play the experiment end to end in zh and en, at desktop and phone sizes; the warnings, tips, layout guide and Tap the table behave as described; no console errors; a knob turn redraws in under 50 ms.

## 7. Hosting and repository

Same repository and GitHub Pages site as Experiment 1. Work happens on branch `feat/michelson` and reaches `main` through a pull request; a merge redeploys the site.

## 8. Assumptions to confirm

- The beam splitter is a 50:50 plate in a ring mount, modelled as thin.
- Mirrors Ø 25.4 mm; M1's micrometer stage travels 25 mm.
- Coherence length 30 mm for the green laser (only decides how closely the arms must match).
- The ready source's beam is at 100 mm on hole row x = 0; breadboard 1400 × 900 mm.
- The thresholds above (1 mrad, 0.5 mm, 1–5 mm spacing, 10 ± 1 cm, ≥ 3 rings) are starting values; they live in `config.js` and may be tuned during testing, with any change recorded here.
