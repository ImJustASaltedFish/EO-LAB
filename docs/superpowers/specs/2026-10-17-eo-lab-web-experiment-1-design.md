# EO LAB Web — Experiment 1 (Laser System) Design

- **Date:** 2026-10-17
- **Status:** approved section by section in brainstorming; awaiting review of this written spec
- **Scope:** the lobby page and Experiment 1 only. Michelson and Mach–Zehnder get their own specs later (§9).

## 1. Background and goal

The existing **EO LAB** app (`LAB\VR\My project`: Unity 6000.3.11f1, URP, XR Interaction Toolkit 3.3.1, OpenXR, built as a Quest APK) has a Lobby, a **Laser System** scene and a **Michelson** scene; Mach–Zehnder is unfinished. It is used in NTUT 光電實驗(一), week 18 (「VR 實驗體驗，項目名稱：對光擴束實驗」).

The VR Laser System scene snaps four parts in order (Aperture 1 → Aperture 2 → spatial filter → convex lens) and draws the beam with hand-tuned shapes. The real procedure — 光電實驗(一)講義, 實驗一「對光、平行光、與光擴束實驗」, §4A and Fig. 1-4 — is an alignment exercise that the VR version skips.

**Goal:** a web version of Experiment 1 that students do with mouse or touch, following the handout's procedure step by step, with everything they see computed from real optics.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| What the page is | A playable lab in the browser (mouse + touch); no VR mode |
| Codebase | New, separate web codebase; the Unity project is not modified |
| Audience | Students of 光電實驗(一), before or after the real lab; TAs for demos |
| Physics | Accurate optics; the VR heuristics are not ported |
| Stack | three.js + plain HTML/CSS/JavaScript ES modules, no build step |
| First build | Lobby + Experiment 1 only |
| Procedure | Handout §4A steps (1), (2a), (2b), (3), (4); in step 4, Aperture 1 moves to between the pinhole and the lens (the user's description) |
| Language | Traditional Chinese by default, English toggle |
| Lab parts | 20× microscope objective, 25 µm pinhole, f_e = 200 mm convex lens, two irises |

### Non-goals for this build

Michelson, Mach–Zehnder, Part B of the handout (cleaning optics), VR/WebXR, accounts, saving progress, grading, and any reuse of Unity code or assets.

## 2. Users and platforms

- Desktop and laptop: current Chrome, Edge, Firefox and Safari (ES modules, import maps, WebGL 2).
- Tablets and phones with touch. Landscape recommended; portrait works with the side panel collapsed.
- WebGL 2 is required (three.js). Without it the page shows a clear message (zh/en) instead of the lab.
- The site must be served over http(s): GitHub Pages or any static host, or locally with `python tools/serve.py` (which always sends `.js` as JavaScript; `python -m http.server` works where the machine already does). Opening the HTML file from disk is not supported because browsers block ES modules on `file://`; the README says so.
- No external network requests at runtime: no CDN, no web fonts, no analytics.

## 3. Student experience

### 3.1 Pages

- **`index.html` — lobby.** Title 「EO LAB 光電實驗」. Cards:
  - 實驗一：對光、平行光、與光擴束 / Experiment 1: Alignment, Collimation & Beam Expansion → `laser.html`.
  - 邁克森干涉儀 / Michelson interferometer — 「即將推出 / Coming later」 (disabled).
  - 馬赫–曾德干涉儀 / Mach–Zehnder interferometer — 「即將推出 / Coming later」 (disabled).
  - A short controls guide (mouse / touch) and the 中 / EN switch.
- **`laser.html` — the experiment.**

### 3.2 Experiment page layout

- **3D bench** fills the page.
- **Top bar:** back to lobby; step progress 開始 · 1 · 2a · 2b · 3 · 4 · 完成; 中 / EN switch; 重新開始 Restart (new random start, asks for confirmation).
- **Side panel** — on the right, 360 px wide; below 768 px viewport width it becomes a bottom sheet with collapsed / half / full states, and the 3D view ends where the sheet starts:
  - **Step card:** title, instructions, live checklist (✓ / ✗ always with text), 提示 Hint button (reveals the step's hints one at a time), 下一步 Next button (enabled only when every check passes), and 思考題 cards for the handout questions tied to this step. Questions are paraphrased and shown **without answers** — they are report questions.
  - **Controls** for the current step. Controls from earlier steps stay available in a collapsed 「其他控制 / More controls」 group.
  - **Readouts** (§3.7).
- **Close-up insets** (2D canvases, stacked top-left, each can be toggled; the current step decides which are open by default): Aperture 1 face, Aperture 2 face, plane A (back face of Aperture 1), spatial-filter ring, screen. Each inset has a mm scale.
- **Toasts** for warnings (§3.6).

### 3.3 Bench and parts

Bench coordinates: **z** along the rail from the laser exit (z = 0) toward the far end; **y** = height above the table; **x** horizontal, positive to the right when looking along +z. All parts sit on the rail centreline (x = 0); only the knobs listed below move optics sideways.

- Breadboard 1400 × 600 mm (z from −200 to 1200 mm, so the laser body fits behind z = 0) with a 25 mm hole grid, one straight rail along it, and a beam block at the far end (z = 1150 mm) that stops the beam when nothing else does.
- A **parts rack** along the back edge of the table holds parts that are not on the rail (the VR 「component wall」). Parts not needed yet are locked, with a tooltip naming the step that uses them.

| Part (zh / en) | On the rail | Adjustable | Range / steps |
|---|---|---|---|
| 雷射 Laser | fixed at z = 0 | 電源 power switch; 俯仰 pitch and 水平 yaw knobs on its mount | ±10 mrad; fine 0.05 mrad, coarse 0.5 mrad |
| 光圈1, 光圈2 Aperture 1, 2 | yes | z; 支柱高度 post height; 孔徑 opening | height 70–130 mm, fine 0.05 mm, coarse 0.5 mm; opening Ø 1.0–12.0 mm |
| 空間濾波座 Spatial filter mount | yes | z; post height; 物鏡 objective (install); 物鏡 X/Y; 物鏡 Z focus; 針孔 pinhole (install); 針孔 X/Y | height as irises; objective X/Y ±1.0 mm, fine 5 µm, coarse 50 µm; focus travel s = 0–6 mm, fine 2 µm, coarse 50 µm; pinhole X/Y ±0.5 mm, fine 1 µm, coarse 10 µm |
| 凸透鏡 Convex lens (f_e = 200 mm, Ø 25.4 mm) | yes | z; post height | z fine 0.5 mm, coarse 5 mm; height as irises |
| 觀測屏幕 Screen (150 × 150 mm white card) | yes | z; 標記光點 mark beam position (the mark stays on the card when the screen moves) | z fine 1 mm, coarse 10 mm |

Rules:
- A part's z is the plane of its optic: the iris plate, the lens, the screen surface. For the spatial filter mount, z is the **pinhole plane**; the objective sits upstream of it (§4.1).
- z range 20–1130 mm. Mount footprints cannot overlap (minimum 5 mm gap). To move a part past another, pick it up and drop it in the new place, as on a real table.
- Removing a part: drag it back to the rack, or press its 移除 Remove button. The objective and pinhole stay in the spatial filter mount when the mount is moved or removed.

### 3.4 Interaction

- **Camera:** orbit (left-drag / one finger), pan (right-drag / two fingers), zoom (wheel / pinch); the camera cannot go below the table. Presets: 全景 Overview, 雷射端 Laser end, 空間濾波器 Spatial filter, 屏幕 Screen. Presets back the camera off until their part of the bench fits across the view; in a view taller than wide, the overview looks down the rail from behind the laser.
- **Placing:** drag a part from the rack onto the rail. It snaps to the rail line and follows the pointer along z on a 1 mm grid; release to place. Alternatives: tap a rack part (it highlights) and then tap a point on the rail; or press the part's 放上光軌 Place on rail button (puts it in the first free spot; keyboard accessible).
- **Moving:** drag a placed part along the rail, or use its ± buttons (fine / coarse).
- **Knobs:** dial widgets in the panel — drag to turn, or −/+ buttons with a fine / coarse toggle; holding a button repeats; arrow keys work on a focused control. The matching 3D knob turns too.
- **Iris opening:** slider.
- The 3D view, insets, readouts and checks update after every change, throttled to the display's frame rate.

### 3.5 Steps (handout §4A, Fig. 1-4)

Each run starts with a random, always-solvable misalignment (§4.1). Steps unlock in order; a step's controls become active when it starts. Checks are evaluated continuously; Next is enabled while all of the current step's checks pass.

**開始 Start**
- Do: turn on the laser following the TA's order (依助教說明順序打開雷射電源). Safety tip: never look into the beam.
- Check: laser on.

**步驟1 雙光圈對光 — Step 1: two-iris alignment** (§4A(1) i–iii)
- Do: close both irises to the minimum. One at a time, put each iris near the laser and change only its height until the beam just passes. Then leave Aperture 1 near the laser and move Aperture 2 to the far end. Slide the irises back and forth along the rail. If the beam is blocked, turn the laser's pitch / yaw knobs — never change the iris heights. Done when the beam passes both irises wherever they are.
- Checks:
  1. Both irises on the rail with opening ≤ 1.5 mm.
  2. Aperture 1 at z ≤ 150 mm and Aperture 2 at z ≥ 700 mm.
  3. The beam passes each iris: beam centre within 0.25 mm of the hole centre.
  4. The beam is parallel to the rail: |pitch| ≤ 0.5 mrad and |yaw| ≤ 0.5 mrad.
- After this step the laser counts as locked (warning M2).
- Hints: (1) close an iris, put it near the laser, and change only its height until the beam passes — do this for each iris; (2) move Aperture 2 to the far end — where the spot lands on its blades shows which way the beam is off; (3) when the far iris blocks the beam, turn the laser knobs, not the iris height; (4) repeat near (height) and far (laser knobs) until both pass.

**步驟2a 空間濾波座 — Step 2a: spatial filter mount** (§4A(2) i–ii, Fig. 1-4 (2a))
- Do: place the mount, without objective or pinhole, close to the laser after Aperture 1, and set its post height so the beam goes through the centre of its ring. Keep Aperture 2 behind the mount, as far away as possible. Place the screen after Aperture 2, bring it close, and mark the beam position.
- Checks:
  1. Mount on the rail between Aperture 1 and Aperture 2, at z ≤ 300 mm.
  2. Beam centre within 0.3 mm of the mount axis.
  3. Aperture 2 at least 300 mm after the mount.
  4. Screen on the rail after Aperture 2, with the beam position marked.
- Hints: (1) the mount goes in empty for now; (2) set the post height using the spatial-filter close-up; (3) Aperture 2 goes far behind; then place the screen and mark the spot.

**步驟2b 顯微物鏡 — Step 2b: objective** (§4A(2) iii, Fig. 1-4 (2b))
- Do: install the 20× objective. Turn the focus knob back and forth while using the objective X/Y knobs so that (i) the reflections on plane A (the back face of Aperture 1) are centred on its hole — the reflected light returns into the laser — and (ii) the centre of the expanded beam stays at the centre of Aperture 2. When both hold over the whole focus travel, wind the objective out to its farthest position from the pinhole ring.
- Checks:
  1. Objective installed.
  2. Plane-A ring centre within 0.5 mm of the Aperture 1 hole centre, at both ends of the focus travel (s = 0 and s = 6 mm, evaluated by the simulation).
  3. Expanded-beam centre within 1.0 mm of the Aperture 2 centre, at both ends of the focus travel.
  4. Objective at its farthest position: s ≥ 5.5 mm.
- Think card: handout question (3) — what appears on plane A, how it arises, which pattern is correct.
- Hints: (1) look at Aperture 2: which way is the expanded beam off? (2) use objective X/Y to bring it back to the centre; (3) look at plane A: the rings must be concentric with the hole; (4) sweep the focus knob to confirm both, then wind it out fully.

**步驟3 25 µm 針孔 — Step 3: pinhole** (§4A(3), Fig. 1-4 (3))
- Do: install the 25 µm pinhole, then pick up the screen and put it close after the mount, in front of Aperture 2 (Fig. 1-4 (3)). Slowly bring the objective in with the focus knob, adjusting the pinhole X/Y knobs to keep the screen as bright as possible. Airy rings mean you are close; continue with small moves until a clean, bright, round spot (a spherical wave) appears. Finally open Aperture 2 — it will set the size of the expanded beam.
- Checks:
  1. Pinhole installed.
  2. Pinhole transmission T_ph ≥ 97 % (§4.4).
  3. Aperture 2 opening ≥ 5 mm.
- Think cards: questions (1) why add a pinhole; (4) what you see on the screen while adjusting, and how you respond; (5, challenge) wrong and correct patterns and their causes.
- Hints: (1) the screen is dim at first — bring it closer; (2) move the objective a little, then maximise brightness with the pinhole X/Y knobs; repeat; (3) rings mean you are nearly there — use fine steps; (4) done when the spot is round, bright and ring-free.

**步驟4 準直透鏡 — Step 4: collimating lens** (§4A(4)–(5), Fig. 1-3, Fig. 1-4 (4))
- Do: take Aperture 2 off the rail and move Aperture 1 to between the pinhole and where the lens will go. Place the convex lens about f_e = 200 mm from the pinhole and set its height. Open the iris just enough that the beam reaching the lens is smaller than the lens. Move the lens slowly while moving the screen back and forth; the lens is right when the spot size on the screen no longer changes.
- Checks:
  1. Aperture 2 off the rail; Aperture 1 between the pinhole and the lens; nothing between the laser and the objective.
  2. Lens centred: beam centre within 0.5 mm of the lens axis.
  3. Beam extent at the lens between 10.0 and 22.9 mm, where the extent is the smaller of 1.5 × the beam's 1/e² diameter and the iris hole projected from the pinhole. (Without the iris the extent is ≈ 33 mm, so the iris must trim the beam.)
  4. Screen moved a total of ≥ 200 mm during this step behind the lens, with the lens on the rail (the collimation test; moving the screen out of the way before the lens is placed does not count).
  5. Beam collimated (§4.6).
- Think cards: questions (2) two ways to make the collimated beam 1.5× wider; (6, challenge) when an Airy pattern can be seen during step 4.
- Hints: (1) Aperture 2 off; Aperture 1 between the pinhole and the lens; (2) the lens goes about 200 mm from the pinhole; (3) open the iris so the beam is smaller than the lens; (4) move the screen: a growing spot means the lens is too close (diverging), a shrinking spot means too far (converging).

**完成 Done**
- Summary: the final layout matches Fig. 1-3; measured expanded-beam diameter compared with eq. 1-1 (2W_e = f_e / f_0 · 2W_0 = 22.2 mm before the iris trims it); time taken; number of warnings. Button: restart with a new random setup.

### 3.6 Warnings (mistake detectors)

A toast with a short message citing the handout. The action still happens — the simulation shows its real effect. A warning shows once; it can show again only after its condition has stopped being true. `{step}` in a message is filled in at runtime.

| Id | Fires when | Message (zh) |
|---|---|---|
| M1 | Step 1: an iris's height changes while that iris is more than 300 mm from the laser | 步驟1(ii)：移動光圈時高度不可改變，請調整雷射座旋鈕。 |
| M2 | After step 1 is completed: a laser knob is turned | 步驟1(iii)：對光完成後，不得再調整雷射。 |
| M3 | Steps 2a–3: Aperture 2's height changes | 光圈2 是對準參考，請勿改變它的高度。 |
| M4 | The objective is more than 0.5 mm past focus toward the pinhole (Δz < −0.5 mm) | 物鏡太靠近針孔，小心碰撞！ |
| M5 | A locked part is taken from the rack | 這個元件在步驟 {step} 才會用到。 |

English versions live in `en.js`.

### 3.7 Readouts

- 屏幕光功率 Power at screen: % of laser power reaching the screen.
- 針孔穿透率 Pinhole transmission T_ph (from step 3).
- 屏幕光斑直徑 Beam diameter at the screen: D4σ second-moment diameter (equals the 1/e² diameter for a Gaussian), in mm to 0.1 mm.
- 發散角 Divergence (mrad, edge half-angle) and state 準直 collimated / 發散 diverging / 會聚 converging (once the lens is on the rail).

### 3.8 Close-up insets

- **Aperture face (1, 2):** iris blades, the hole at the current opening, and the beam's light falling on the blades wherever it misses the hole — the view students use in the lab. Brightness uses a square-root curve (not the screen's log curve), so when the expanded beam overfills the plate in step 2b its brightest part still shows where its centre is.
- **Plane A (back face of Aperture 1):** the objective's reflection rings and the hole, after the objective is installed.
- **Spatial-filter ring:** the mount's front ring with the beam spot (step 2a).
- **Screen:** the computed screen image (§4.5) with a mm ruler and the step-2a mark.

The 3D screen card uses the same image as its texture.

### 3.9 Visual style

A calm, realistic lab: dark breadboard with a hole grid, black anodised mounts, satin posts, slightly tinted glass, a white screen card, soft lighting, no clutter. The beam is a soft glowing green tube whose radius is the larger of its real 1/e² radius and a small visibility minimum, and whose brightness follows its intensity; light spots appear where the beam meets surfaces. Panel UI: clean and high-contrast, system fonts (zh: PingFang TC, Microsoft JhengHei, Noto Sans TC).

Parts follow the lab's hardware: the spatial filter is a base block on one post centred underneath, a front plate with a bore that slides with the focus micrometer and carries the objective, and a rear plate holding the pinhole with knurled X/Y knobs on brass collars (top = vertical, side = horizontal); the irises are post-mounted iris diaphragms (round housing, blade disc) whose pin points straight up when open and swings 45° to the side as they close.

### 3.10 Glossary (UI terms)

| 中文 | English |
|---|---|
| 雷射 | laser |
| 光圈 | iris (aperture) |
| 空間濾波器 / 空間濾波座 | spatial filter / spatial filter mount |
| 顯微物鏡 | microscope objective |
| 針孔 | pinhole |
| 凸透鏡 | convex lens |
| 觀測屏幕 | observation screen |
| 光軸 | optical axis |
| 光學桌 / 光軌 | optical table / rail |
| 支柱 | post |
| 旋鈕 | knob |
| 平行光 / 準直 | collimated |
| 擴束 | beam expansion |
| 繞射 | diffraction |
| 球面波 | spherical wave |
| 平面 A | plane A |

## 4. Physics

Internal units are SI (m, rad). All constants live in `js/optics/config.js`.

### 4.1 Parameters and random start

| Quantity | Value |
|---|---|
| Wavelength λ | 532 nm (green) |
| Laser beam | TEM00, waist radius W_0 = 0.5 mm at the exit (1 mm diameter); z_R = πW_0²/λ = 1.48 m; divergence 0.34 mrad |
| Objective | 20×, f_0 = 9.0 mm; clear aperture Ø 7 mm (the beam always fits, so it is not modelled as a stop) |
| Focused spot | w_0 = λf_0/(πW) ≈ 3.05 µm; z_R0 = πw_0²/λ ≈ 55 µm |
| Objective position | objective-to-pinhole distance f_0 + Δz, with Δz = s − s_f, s_f = 1.0 mm, travel s = 0–6 mm (Δz from −1 to +5 mm); s starts at 3.0 mm. So z_obj = z_ph − (f_0 + Δz) and the focal plane is at z_focus = z_ph − Δz |
| Pinhole | Ø 25 µm (radius a = 12.5 µm) |
| Spatial filter mount ring | inner radius 4 mm |
| Objective reflecting surfaces (plane A) | three surfaces, radii R_j = 15, 22, 34 mm |
| Convex lens | f_e = 200 mm, Ø 25.4 mm, clear aperture 22.9 mm |
| Irises | opening Ø 1.0–12.0 mm |
| Dust noise | K = 24 components; each with a random direction, |ν| uniform from 4 to 15 mm⁻¹ and a random phase; total relative power ε² = 0.04 |

Hidden random values, drawn from a seeded generator (the URL parameter `?seed=` makes a run reproducible; default is a random seed):
- At start: laser exit height 100 mm + U(−3, 3) mm; laser pitch and yaw each ±U(2, 6) mrad; noise components.
- When the objective is installed: its axis is offset from the current beam position by U(0.2, 0.6) mm in a random direction.
- When the pinhole is installed: it is offset from the current focused-spot position (the waist centre ξ_c, §4.4) by U(30, 120) µm in a random direction.

All offsets lie well inside the knob ranges, so every run is solvable.

### 4.2 Beam centre (paraxial ray)

Ray state (x, y, θx, θy) at the laser exit = (0, h_L, yaw, pitch). Free space: position += angle × distance. A thin lens with axis at r_a: θ' = θ − (r − r_a)/f. Irises, the pinhole and the screen do not bend the ray. This gives the beam centre at every part's plane.

### 4.3 Beam size (Gaussian beam)

Complex beam parameter q with 1/q = 1/R − iλ/(πw²). Free space: q → q + d. Thin lens: 1/q → 1/q − 1/f. It starts at the laser waist. After the pinhole (§4.4) the beam continues as an equivalent Gaussian with its waist at the pinhole and waist radius λ/(πθ_e), where θ_e is the 1/e² half-angle of the computed far field (twice its RMS angular radius). Used for the 3D beam envelope, the readouts and the near-focus case of §4.5.

### 4.4 Spatial filter (Fourier optics — handout Fig. 1-1, 1-2)

Transverse positions are in the rail frame. Mount axis r_m; objective axis r_o = r_m + δ (install offset + objective X/Y knobs); pinhole centre r_p = r_m + p (install offset + pinhole X/Y knobs).

1. **Input at the objective:** a Gaussian of radius W (from §4.3), centred at offset u = r_beam − r_o, travelling at angle α (beam angle; the objective axis is parallel to the rail). Plus dust noise: K copies of the beam tilted by λν_k with complex amplitudes c_k. The noise pattern is treated as fixed on the beam; noise components are not propagated separately before the objective.
2. **Focal plane:** the main beam focuses to a Gaussian waist w_0 = λf_0/(πW) at ξ_c = r_o + f_0·α, its axis tilted by −u/f_0. Noise component k focuses to the same spot shifted by λf_0·ν_k (at least 19 µm, so a centred pinhole at focus blocks it).
3. **Pinhole plane** (Δz after the waist): every component is the analytic Gaussian beam at distance Δz from its waist — radius w(Δz) = w_0·√(1 + (Δz/z_R0)²), curvature R(Δz) = Δz·(1 + (z_R0/Δz)²), centre moved by (α − u/f_0)·Δz (its direction of travel after the objective; noise copies add λν_k), plus its linear tilt phase. Field E_p(ξ) = main + Σ noise.
4. **Mask and far field:** sample E_p on a 48 × 48 grid covering the pinhole (0.52 µm spacing), zero outside |ξ − r_p| ≤ a. Far field I_ff(θ) = |Σ E_p(ξ)·exp(−ik θ·ξ)|² on a 192 × 192 grid of angles spanning ±0.167 rad (3 × W/f_0), computed as a separable matrix DFT.
5. **Transmission:** T_ph = main-beam power inside the pinhole ÷ total main-beam power (normalised analytically). Noise power through the pinhole is computed the same way.
6. **No pinhole installed** (step 2b): the screen shows the magnified raw beam, I(x_s) = |E_in(−x_s·f_0/(z_s − z_focus))|² including the noise, centred on the ray.
7. **Caching:** items 3–5 rerun only when Δz, δ, p, u, α or W change.

Expected behaviour, also used as test targets:
- Far from focus the pinhole is overfilled → a faint Airy pattern with the first dark ring at 1.22λ/D = 26 mrad.
- Near focus and centred → T_ph close to 100 % and a clean Gaussian with 1/e² half-angle W/f_0 ≈ 55.6 mrad.
- Pinhole off-centre → dimmer, lopsided patterns.
- Objective decentred or beam tilted → the far field shifts.

### 4.5 Screen image

A 256 × 256 image over a square window 2.5 × the expected beam diameter at the screen (clamped to 5–150 mm); the inset ruler follows the window.

- **No objective:** the raw beam (Gaussian with noise) at the screen plane, centred on the ray, radius from §4.3.
- **Objective, no pinhole:** §4.4 item 6.
- **Pinhole, no lens:** x_s = r_p + θ·(z_s − z_ph); I_s = I_ff(θ)/(z_s − z_ph)².
- **With the lens** (axis c_L, L = z_L − z_ph, D = z_s − z_L): x_s = A·θ + B with A = L + D·(1 − L/f_e) and B = r_p − D·(r_p − c_L)/f_e; I_s = I_ff(θ)/A². If |A|·θ_e is smaller than half the Gaussian radius from §4.3 at the screen (the screen is near a focus, where diffraction dominates), the Gaussian spot from §4.3 is drawn instead.
- **Masks:** every iris between the pinhole and the screen removes the angles whose rays miss its hole; the lens removes rays outside its clear aperture.
- **Display:** fixed exposure with a log tone curve, v = log10(1 + k·I/I_ref) / log10(1 + k), k = 1000, where I_ref is the peak intensity a perfectly aligned beam would give at the same screen position. Colour: green, rolling off toward white near saturation. Faint patterns stay visible, and brighter really means brighter.

### 4.6 Collimation

- Collimated ⇔ |L − f_e| ≤ 2.2 mm.
- Divergence readout: edge half-angle θ' = θ_edge·(1 − L/f_e), where θ_edge is the smaller of θ_e and the iris-limited half-angle (iris radius ÷ its distance from the pinhole). Positive = diverging, negative = converging. At the tolerance limit with no iris, |θ'| ≈ 0.6 mrad.

### 4.7 Irises and the beam stopping

- Transmission of a Gaussian (radius w, centre offset s) through a hole of radius r: T = ∫₀ʳ (4ρ/w²)·exp(−2(ρ² + s²)/w²)·I₀(4ρs/w²) dρ, evaluated with 64-point Gauss–Legendre quadrature and the exponentially scaled Bessel I₀ (Abramowitz & Stegun 9.8.1–9.8.2).
- After the objective without the pinhole, the expanded beam is treated as a Gaussian for iris transmission; after the pinhole, transmission is the masked fraction of I_ff.
- If T < 1 % the beam is drawn as stopped at that iris. The beam also stops on the mount plate if it misses the 4 mm ring, and at the beam block if nothing else stops it. The pinhole only stops the beam below T = 10⁻⁵, so the faint Airy pattern far from focus (T ≈ 0.4 %) stays visible.
- Clipping by an iris loses power but adds no diffraction rings; only the pinhole does (a stated simplification).

### 4.8 Plane A (back-reflections)

For reflecting surface j (radius R_j), the reflection returns toward the laser. On plane A, at distance d_A = z_obj − z_A1, its centre is h + d_A·(θ_in + 2h/R_j), where h is the beam's offset from the objective axis and θ_in its angle; its radius is W·(1 + 2d_A/R_j). The three rings share a centre only when h ≈ 0 and θ_in ≈ 0.

### 4.9 Stated simplifications

Thin lenses without aberrations; scalar, monochromatic, fully coherent light; clipping by irises loses power without adding rings; dust noise is fixed on the beam; parts stay on the rail centreline apart from the listed knobs; the objective's axis is parallel to the rail; laser pointing is stable over time.

## 5. Architecture

Plain ES modules, no build step. The only third-party code is three.js **0.170.0** (single-file module build `three.module.min.js` plus `OrbitControls.js`), vendored in `js/vendor/` and mapped with an import map in each HTML page — the import map is the one place to change if the version ever changes.

```
eo-lab-web/
  index.html            lobby
  laser.html            Experiment 1
  css/style.css
  tools/
    serve.py            local static server with correct JS MIME types
    run_tests.py        runs tests/index.html in headless Edge/Chrome, prints PASS/FAIL
  js/
    app.js              input → state → bench() → scene + insets + panel + step checks
    lobby.js            lobby page script
    vendor/             three.module.min.js, addons/controls/OrbitControls.js, LICENSE-three.txt
    i18n/
      index.js          t(key), current language, switching, applyTranslations
      zh-TW.js          all zh strings: steps, hints, warnings, questions, UI
      en.js             all en strings (same keys)
    optics/             pure physics: no DOM, no three.js
      config.js         every constant and tolerance in this spec
      rng.js            seeded random generator
      complex.js        complex arithmetic
      ray.js            beam-centre ray (§4.2)
      gaussian.js       q-parameter propagation (§4.3)
      iris.js           Gaussian-through-hole transmission (§4.7)
      noise.js          fixed dust noise on the beam (§4.1, §4.4)
      pinhole.js        pinhole field → far field + transmission (§4.4)
      screen.js         screen samplers and image (§4.5), tone map and display colours
      bench.js          bench(state) → BenchResult
    lab/                pure logic: no DOM, no three.js
      state.js          createInitialState(seed), state updates
      steps.js          STEPS: checks, hints, warnings, question keys (§3.5–3.6)
    scene/              three.js
      webgl.js          WebGL 2 detection without three.js
      view.js           renderer, camera, presets, resize
      models.js         table, rail, rack, laser, irises, mount, lens, screen
      beam.js           glowing beam segments and surface spots
      interact.js       picking, dragging along the rail, rack placement
    ui/
      panel.js          step card, checklist, hints, think cards, readouts
      controls.js       knob dials, sliders, ± buttons, position inputs
      insets.js         2D close-ups with mm scales
      toast.js          warnings
  tests/
    index.html, harness.js, all.js, fixtures.js
    optics/, lab/, scene/, ui/   one test file per module
    i18n.test.js, app.test.js, lobby.test.js
  docs/superpowers/specs/…, docs/superpowers/plans/…
  README.md
```

**Data flow:** UI or 3D input → `state.js` (one bench-state object) → `bench(state)` (pure; returns everything observable) → scene, insets, panel and step checks redraw. `steps.js` evaluates checks from `(state, result)` and warnings from `(previousState, state, result)`. Nothing in `optics/` or `lab/` touches the DOM or three.js.

**Key interfaces**
- `createInitialState(seed) → BenchState` — visible part and knob values, plus a `hidden` block (laser exit height, initial pitch/yaw, install offsets once drawn, noise components, generator state).
- `bench(state) → BenchResult` — beam centre at every part; beam segments for 3D (start, end, start/end radius, power); per-part transmissions; power at the screen; `T_ph`; the far field (when the pinhole is in); the screen image (`Float32Array` 256² + window size); iris-face spots; plane-A rings; readouts.
- `STEPS` — array of `{ id, titleKey, instructionKey, unlocks, checks: [{ id, labelKey, test(state, result) }], hintKeys, warnings: [{ id, test(prev, state, result), messageKey }], questionKeys }`.
- `t(key)` — string in the current language. The choice is stored in `localStorage` (every access in try/catch); default zh-TW.

**Performance budget:** `bench()` under 30 ms on a mid-range laptop when the far field must be recomputed, under 5 ms otherwise; the 3D view at 60 fps.

## 6. Testing

**Physics tests** (`tests/optics.test.js`):
1. Free-space Gaussian propagation matches w(d) = W_0·√(1 + (d/z_R)²) (relative error < 1e-9).
2. A collimated 1 mm beam through f_0 = 9 mm gives a 3.05 µm waist (±0.5 %) at f_0 (±0.1 %).
3. Eq. 1-1: with the pinhole centred at focus and L = f_e, the beam diameter at the lens is 22.2 mm ±2 %.
4. Collimation: L = f_e → |θ'| < 0.05 mrad; L < f_e → diverging; L > f_e → converging.
5. Iris transmission: centred with r = w gives 1 − e⁻² (±1e-4); an offset case matches brute-force 2D integration (±1e-3).
6. Pinhole: overfilled (w ≫ a) → first dark ring at 1.22λ/D (±1 grid step); centred at focus → T_ph ≥ 0.999 and far-field 1/e² half-angle W/f_0 (±3 %); pinhole offset ±10 µm in x → equal transmission, decreasing with offset.
7. A lens decentred by 0.1 mm with f = 9 mm deflects the ray by −11.1 mrad (±1e-6).
8. Plane A: centred objective and parallel beam → ring offset 0; decentre δ → offset δ·(1 + 2d_A/R_j).
9. Noise: pinhole centred at focus passes ≤ 1 % of the noise power; with no pinhole the screen image shows the noise (relative intensity variance above a threshold).
10. Random start: for 200 seeds every hidden offset lies within the knob ranges.

**Step tests** (`tests/steps.test.js`):
- Step 1 passes for an aligned state (|pitch|, |yaw| ≤ 0.5 mrad, heights matched, Aperture 1 at ≤ 150 mm and Aperture 2 at ≥ 700 mm, openings ≤ 1.5 mm) and fails with pitch = 1 mrad.
- M1 fires for a height change at z = 500 mm in step 1 and not at z = 100 mm.
- M2 fires for a laser knob change in step 2a.
- Step 3 passes at T_ph ≥ 0.97 and fails at Δz = 0.5 mm.
- Step 4 passes with L = 200 ± 2 mm, the lens centred, Aperture 1 between pinhole and lens, Aperture 2 removed and ≥ 200 mm of screen travel; fails while Aperture 2 is still on the rail.

**i18n test** (`tests/i18n.test.js`): zh-TW and en have exactly the same keys, and no value is empty.

**Runner:** `tests/index.html` loads the test modules and lists pass / fail. `python tools/run_tests.py` serves the folder on a free local port, opens the page in headless Edge (or Chrome) and prints the results; exit code 0 only when nothing fails. Headless runs use virtual time, so speed is checked by hand in a real browser.

**Manual checks:** complete Experiment 1 end to end in zh and en, at desktop size and at phone size (touch emulation); the warnings appear when provoked; no console errors; a knob turn redraws in under 50 ms on desktop.

## 7. Hosting and repository

- Folder `LAB\VR\eo-lab-web\`, its own git repository; the Unity project in `LAB\VR\My project` is not modified.
- Recommended host: GitHub Pages (static files). Publishing is done by the user, or by Claude only with explicit approval.
- three.js 0.170.0 is downloaded once into `js/vendor/`, after the user approves the download.
- README: what this is, how to run it locally, how to publish it, how to change parameters in `config.js`.

## 8. Assumptions to confirm

- Laser: 532 nm with a 1 mm beam. The handout allows a He-Ne or a semiconductor laser; the VR app and the handout figures are green.
- 20× objective f_0 = 9.0 mm (a typical value for 20×).
- Convex lens diameter 25.4 mm (1″).
- The "done" thresholds above are the starting values. They live in `config.js` and may be tuned during testing so that "done" matches a pattern that looks right on screen; any change is recorded in this spec.

## 9. Next specs (not part of this build)

- **Michelson interferometer** — handout `光電實驗講義V3_徐巍峰\16-邁克森干涉儀實驗.doc`; reuses `optics/` (adds beam splitter, mirrors, two-beam interference).
- **Mach–Zehnder interferometer** — handout `17-Mach-Zehnder干涉儀實驗.doc`.
