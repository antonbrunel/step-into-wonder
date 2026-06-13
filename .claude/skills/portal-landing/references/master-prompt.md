# Build specification (master prompt, corrected architecture)

Plain HTML/CSS/JS, three files + `images/`. No frameworks, no build step.

## Files in ./images/
Structural (cut from master image, 16:9):
`sky.png` (opaque), `full-scene.png` (hole transparent), `portal-left.png`,
`portal-right.png`.
Overlays (independently generated, alpha-cropped):
`foliage-tl.png`, `foliage-tr.png`, `foliage-bl.png`, `foliage-br.png`,
`foreground-flowers.png`.
All already correctly oriented — never apply flip transforms.

## Layer stack (z-index back → front)
1. sky (z:1) · 2. portal-left (z:2, landing only) · 3. portal-right (z:3, landing
only) · 4. full-scene (z:4, idle) · 5. foreground-flowers (z:5) · 6. foliage
corners ×4 (z:6) · UI (z:10–20) · custom cursor (z:999)

Scene layers: full-frame `<img>` with object-fit: cover (never background-image).
Overlays: individually positioned `<img>`:
- flowers: bottom ≈ −16vh, width ≈ 108vw (frames the bottom quarter, must not
  swallow the scene)
- top corners: top ≈ −3vh, widths ~31–36vw; bottom corners: bottom ≈ −4/−5vh,
  widths ~29–30vw; all overflow the frame slightly

Each layer lives in a wrapper div: wrapper handles opacity transitions (CSS),
inner img handles RAF transforms. This keeps fades and motion independent.

## Timeline (corrected, validated)
Frame 0: sky 0, halves opacity 1 zoomed, everything else 0.

**Timing engine — two hard rules:**
- The timeline waits for ALL layer images to be decoded
  (`Promise.allSettled(imgs.map(i => i.decode()))`) before starting; until then
  the RAF renders the frame-0 state. Otherwise the backdrop appears alone while
  the multi-MB halves are still decoding. The validated EVOLUTION of this bare
  gate is the cinematic intro-cards screen (see production.md §2): the wait
  becomes film credits, the checkpoint sits between cards, and t0 is set after
  the curtain-lift breath — from a RAF frame, hence a visible tab.
- The timeline is driven by the RAF clock (elapsed thresholds inside the frame
  loop), NEVER by setTimeout: decoding large PNGs starves the main thread and
  timers fire seconds late, leaving fades stuck mid-transition.

**Landing depth — overlays zoom at their OWN speed:** apply
`scale(1 + (zoom−1)·K)` per plane (flowers K≈1.5, corner foliage K≈1.3, scene
halves K=1.0), same focal origin. Identical K for everything reads as a rigid
flat zoom and kills the parallax; the foreground must travel faster.

**Zoom geometry — start CLOSE to the final position.** The frame must be
visible from the very first frame; the focal opening must NEVER cover the whole
viewport (if it does, the first impression is the entire backdrop, dezoomed —
the one thing the visitor must not see):
- initial scale ≈ **1.65** (modest but lively), shrinking to 1.0 over 2500ms,
  driven by requestAnimationFrame — NOT CSS keyframes
- easing = **pure deceleration** (cubic-bezier(0.16,1,0.3,1) or similar
  expo-out): the journey starts at max speed and only slows down. An
  ease-in-out leaves ~1s of near-stillness at the start — a "waiting" beat the
  visitor feels immediately
- backdrop = the original master image, opacity 1 from frame 0 (never black),
  with its own zoom curve tied to the landing progress: ~**1.42 at start →
  1.09 at rest** (focal origin). At rest, content through the hole stays
  slightly magnified — breaking 1:1 alignment with the scene for depth, without
  the exaggerated frozen-zoom feel of higher values (1.75 was rejected)
- transform-origin of the halves, backdrop and overlay wrappers = the focal
  center, computed dynamically from the cover mapping (image fraction →
  element px, recomputed on resize)
- **the backdrop zooms in sync too**, with a smaller relative factor composed
  with its base zoom (`1.12 × (1 + (zoom−1)·0.35)`): through the hole, less of
  the backdrop is revealed at the start, while the factor gap (0.35 vs 1.0 vs
  1.3–1.5 overlays) preserves the landing parallax

**Overlays ride the zoom**: flowers + foliage live inside a single full-viewport
container (#fx-zoom) that receives the same scale in the RAF loop (same origin),
then neutralizes to none when the zoom ends (re-measure push centers then).
They fade in EARLY (~250ms) so they travel with the scene — not after it.

**Crossfade without the opacity dip**: never fade two stacked copies in opposite
directions simultaneously (at mid-fade the background shows through both = a
visible brightness dip). Instead: full-scene (z-above) fades IN over the halves
which STAY OPAQUE (2500ms, 1s fade), then the halves are cut instantly
(transition: none) once fully covered (3600ms).

- 100ms: sky fades in
- 250ms: flowers + foliage fade in (in place, opacity only)
- 2400ms: hero text — masked line reveal (see UI choreography)
- 2500ms: full-scene fades in over opaque halves
- 2550ms: nav slides down into place
- 2650ms: cards cascade up from below
- 3600ms: halves cut instantly (fully covered by now)

## UI entrance choreography (orchestrated, subtle, high-end)

All UI entrances share ONE easing family — expo-out cubic-bezier(0.16,1,0.3,1)
for reveals, a gentle spring cubic-bezier(0.22,1.42,0.36,1) for the cards — so
the whole sequence reads as one gesture:
- **Title**: line-by-line masked reveal. Each line wrapped in
  `.line { overflow:hidden } > .line-inner { translateY(112%) → 0 }`,
  0.95s, staggered 120ms per line. Subtitle follows at +0.5s (opacity +
  translateY(14px) → 0).
- **Nav**: fade + translateY(−14px) → 0, 0.8s.
- **Cards**: per-card cascade from below — opacity 0, translateY(30px)
  scale(0.96) → rest, 0.85s, staggered 120ms, slight spring overshoot. Use a
  one-shot @keyframes WITHOUT persistent fill so the element returns to its
  stylesheet state and hover transitions keep working (the keyframes ban only
  concerns the portal zoom). Cards stay strictly static once landed.

## Idle drift (optional, project-specific — design it, don't copy it)

The scene should never feel 100% frozen: an ultra-light sinusoidal drift of the
overlay elements relative to each other — "a faint echo" — keeps it alive.
Validated baseline for the organic forest: foliage amp 3–4.5px, periods
7.5–10.5s, desynchronized phases per layer, x/y on different frequencies,
±0.25° rotation breathing; flora border amp ~2.5px, slower. UI stays strictly
static.

The CHARACTER of this motion is a per-project design decision, not a constant:
an organic scene breathes (foliage sway), a car showroom might have nothing but
floating dust or a slow light sweep, an underwater scene drifts more, a
corporate hero may want none. Choose amplitude/period/which-elements to match
the subject — keep it subtle enough that the visitor feels it more than sees
it, and propose it to the user.

## Depth polish — bokeh (optional, ASK the user)

When the context fits, a bokeh-style blur on the element(s) closest to the
viewer — or on part of one (e.g. the bottom edge of the foreground flora, one
corner branch) — strongly reinforces the depth-of-field feel, like a real lens.
Pure CSS (`filter: blur(2-3px)`, optionally partial via a `mask-image`
gradient), zero asset cost. It is a taste call that changes the page's
character, so propose it to the user in Phase 0 or at delivery rather than
imposing it.

## Idle interactions (single RAF loop)
Parallax (lerp 0.06 toward normalized mouse −1..1): sky 20, full-scene 10,
flowers 40, halves 12 (composed with zoom transform), foliage corners ~30.

Cursor-reactive foliage: influence radius 400px, push 45–50px away from cursor,
quadratic falloff `(1 − d/R)²`, lerp 0.08, subtle rotation from push x
(~0.04 deg/px). Push centers = element bounding-box centers measured with
transforms zeroed, re-measured on resize and after image load.

Custom cursor: 30×30 white-border circle, mix-blend-mode: difference, lerp 0.18,
grows to 50×50 over interactive elements. body { cursor: none }.

Cards (3, stacked bottom-right): glassmorphism rgba(255,255,255,0.15) +
backdrop-filter blur(12px). STATIC at idle. Hover: translateY(−15px) scale(1.25),
easing cubic-bezier(0.34,1.56,0.64,1); siblings pushed via
`.card:has(+ .card:hover)` and `.card:hover + .card`.

## Layout
Full-screen hero (100vw×100vh, overflow hidden). Centered top nav:
Home · Studio · Experiences · ✦ · Technologies · Journal · Contact.
Hero text left, vertically centered, serif: "STEP › INTO WONDER" on 3 lines +
subtitle. 3 cards bottom-right.

## Hard prohibitions
1. No flip transforms on any layer
2. No CSS @keyframes for the portal zoom (RAF only)
3. No background-image for layers
4. No continuous/idle animation on cards
5. No sliding the halves off-screen — they fade in place at scale 1.0
6. No translate-fades on layers that overlap existing content
7. No "improvements" deviating from this spec

## Delivery
Show the file tree, give the local run command
(`python3 -m http.server 8080`), do not auto-run. Verify the three states and the
50px test before handing over.
