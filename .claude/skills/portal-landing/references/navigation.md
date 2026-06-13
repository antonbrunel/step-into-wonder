# Narrative navigation — the scene IS the sitemap (OPTIONAL module)

**Status: optional, never mandatory — but field-validated and spectacular.**
This module exists so you know these possibilities EXIST and work incredibly
well. When the page has real destinations (portfolio sections, product areas),
PROPOSE this to the user as a menu of possibilities; let them pick. A simple
hero with classic links is a legitimate choice — but if they want the full
experience, everything below is proven.

Validation verdicts from the reference project (user's own words):
- Envelopment/garden curtain: "MAGNIFIQUE"
- Mood shift/nightfall: "fonctionne parfaitement"
- Portal dive: works beautifully — despite initial doubts (the early version
  exposed the whole backdrop; fixed by the close-start + synced backdrop zoom,
  see master-prompt). Don't let the first draft of a traversal scare you off.
- Growth/plant: warm and personal, ideal for contact.

## The core idea

Layers are not decoration with buttons on top. **Each section of the site is a
STATE of the scene** (folded shut, enveloped, nightfall, flown-through). The
hero becomes a spatial sitemap the visitor travels through. Generalizes to any
theme: a car dealership can "turn on the headlights" (mood shift), "open the
garage" (curtain), "get in and drive" (dive); a beekeeping site can open a
hive, follow a bee into golden light.

## Order of operations (validated)

1. **Define the buttons BEFORE the effects.** Interview: primary audience →
   the ONE action a visitor should take in 30s → tone → real available content
   (a nav item is a promise of content — never promise an empty section).
   Few honest labels beat many hollow ones (4 real sections > 7 empty).
2. **Map gesture to meaning.** The transition must keep the label's promise:
   "wander the garden" → vegetation envelops you; "say hi" → a warm plant
   grows with the contact message. A spectacular but incoherent transition is
   a gimmick.
3. Write real placeholder copy per destination from day one: two
   masked-reveal lines + a sub line, same entrance language as the hero title,
   plus a constant small credit caption.

## The four validated archetypes (implementation-level detail)

**Traversal (dive)** — accelerate INTO the focal point; the inverse of the
landing. RAF-driven: progress q over ~1500ms, eased q² (pure acceleration),
scene scale 1 → ~4.4 (focal origin), overlay wrappers 1 → ~6, backdrop boost
×~1.3 (slower = parallax). Golden bloom overlay (radial at focal point) fades
in at q≈0.55, dims to ~0.22 once through; section copy reveals on arrival.

**Envelopment (curtain)** — corner/edge elements grow toward the center until
they cover the frame. CSS transitions on the WRAPPERS (the RAF only drives the
inner imgs after landing, so wrappers are free): per-corner transform-origins
("0% 0%", "100% 0%", "0% 100%", "100% 100%"; flora border "50% 110%"), scale
~2.7 (corners) / ~2.3 (border), spring easing
cubic-bezier(0.3, 1.08, 0.35, 1) over 1.5s, plus a radial vignette for text
legibility.

**Mood shift (dusk)** — a grading filter cascades layer by layer, back to
front (~160ms stagger — the cascade itself showcases the depth system):
`brightness(0.36) saturate(0.72) hue-rotate(-8deg)`, transition 1.3s. Ambient
particles drift in (6 fireflies: radial-gradient dots + glow shadow, spawned
at random positions in the lower 2/3, sinusoidal drift amp 14-30px with
random period/phase per particle, driven in the same RAF loop).

**Growth (plant)** — ONE element grows from its natural anchor
(transform-origin at its attached corner) to scale ~3.4 over 1.7s, covering
part of the frame (e.g. the title); vignette + slight backdrop zoom
(target-lerped in the RAF: boost 1.06, lerp 0.04).

End state for ALL: section copy (masked line reveal, staggered 120ms) +
pill-links to the OTHER sections + a dashed "← back" pill + credit caption.

## Reversibility and chaining (hard rules)

- **Never design an entrance without its exact reverse.** Back = the same
  animation played backwards. CSS effects: remove the class/inline transform
  with an expo-out (cubic-bezier(0.16,1,0.3,1), ~1.25s). RAF effects: same
  trajectory with inverted progress (dive-out: diveE = (1−u)²). Nearly free if
  planned at design time, painful to retrofit.
- **Generic chaining**: exit current in reverse, then enter the next — UI
  stays retreated, no home flash. Zero pair-specific code, correct site loop.
- **Covered-swap (the elegant loop)**: when a state fully covers the screen
  (curtain shut, night dark, backdrop-only), SWAP the world state underneath
  (set the target end-state instantly), then play the cover's reverse — it
  opens directly onto the next section. Validated: garden-shut → leaves
  reopen straight onto the sky world. Requires a flag so the RAF releases the
  covering elements to CSS control during the swap (wrapFree pattern).

## State guards (all validated the hard way)

- One `busy` lock around every transition; ignore clicks while true. Mind the
  release points (each entrance releases when its copy reveals; reversals on
  settle).
- Transitions enabled only after the landing completes (`zoomDone`).
- The timeline starts on the first VISIBLE frame (`document.hidden` +
  visibilitychange) — Chrome freezes occluded tabs and a hidden start leaves
  half-faded states.
- UI retreats during any travel (one `.demo-active` class: opacity 0 +
  pointer-events none on hero text / nav / cards), returns on settle-home.
- On settle-home, restore focal transform-origins (per-corner effects
  repurposed them) — one call to the geometry function.
