---
name: portal-landing
description: Build immersive layered hero landing pages from AI-generated scenes — a focal subject (portal, car, product, person, hive, anything) framed by depth layers, cursor-reactive accents, parallax, and a cinematic landing animation. Universal across themes and layouts (car dealership hero, beekeeping site, personal portfolio, corporate hero, training company, web agency...). Use this skill whenever the user wants a portal landing, parallax hero, immersive or cinematic landing page, layered PNG scene, cursor-reactive elements, "step into wonder" pattern, or simply a "wow" hero section — even if they never say "portal" or "parallax".
---

# Portal Landing — immersive layered hero pages

One pattern, infinite themes: a full-screen scene built as stacked PNG layers
(backdrop → focal subject → reactive accents → UI), animated with a landing
sequence and cursor-driven depth. The "forest portal" is the canonical example;
the same architecture serves a car in a showroom, a product on a workbench, a
beehive in a meadow, a portrait for a portfolio. Layout, palette and subject are
unique per project — the engineering and quality doctrine below are constants.

## Working stance (read this as a commitment)

This skill exists to produce a perfect result in one pass, with zero
back-and-forth. That means: go to the very end of every small detail,
precautiously, verifying each one at 100% — and ask the user the moment an input
is genuinely needed rather than guessing. Claude effort is free; image
generations and user round-trips are not. Maximize the first, economize the
second. Never trade quality for laziness: every shortcut here costs 10x
downstream.

## Phase 0 — Project interview (always, before any generation)

Ask (one AskUserQuestion round, concise):
1. **Theme & focal subject** — what is at the center, what frames it, desired
   mood/palette. Sketch the layout in words and confirm it.
2. **Asset budget strategy** — image generation costs real money; Claude effort
   doesn't. Offer the three valid strategies:
   - **A. Single master, engineered for cutting** (cheapest): one image whose
     prompt is designed so every needed element has clean separable silhouettes
     (clear contrast edges, no critical overlaps). All layers cut locally.
   - **B. Master + asset sheet** (balanced): one scene + ONE extra image — a
     "planche" of all accent elements laid out on a uniform background, same
     style contract — then cut/background-remove locally. Many elements for one
     generation; easiest style persistence.
   - **C. Master + individual transparent assets** (max quality, max cost):
     each accent generated separately with `transparent: true`. Perfect
     silhouettes for free, validated best quality.
3. **Style references** — brand DA, reference artists/photographers, or free rein.

## Style persistence — the two-stage prompt redaction

Every image of a project shares one immutable **style contract** (header/footer
of every prompt), with only a **variant block** changing per image. The contract
must be specific enough to forbid drift while allowing subject diversity:
- Photoreal: name the camera body, the exact lens reference, aperture, time of
  day, light quality ("golden hour 19:40, backlit, soft haze") — not just
  "realistic".
- Painterly/illustration: painter, year, movement, the professional terms for
  canvas and paint type, even named works it should resemble.
- Brand: hex palette, material vocabulary, composition rules.

The variant block describes only what is unique: subject, which sides/zones must
remain empty or transparent, light direction (hence shadows), composition notes.

This matches documented expert practice (reusable style blocks pasted verbatim,
structured prompts, locked lighting/composition vocabulary). When the image API
accepts input images (GPT-image edits, Gemini), a generated-upfront reference
image is even stronger — use it if the MCP supports it; otherwise the verbal
contract is the fallback.

## The doctrine of cutting (where projects fail)

1. **A layer is an object, not a zone.** Every cut must follow real content
   edges. A properly cut region *shaped like* a circle is 10x cleaner than a
   geometric circle — and the extra effort is small. No geometric shortcuts,
   ever, even for a proof of concept.
2. **One pixel, one layer.** Never duplicate scene pixels into a movable layer;
   movement reveals ghost doubling instantly. Remove from below, or use new
   content.
3. **Cut from the master only what is structural** (the focal opening/subject
   boundary, complementary halves, backdrop). Accents come from strategy A
   (engineered cuts), B (asset sheet), or C (transparent generations).
4. **Protect innocent structures.** Segmentation must never bite into objects
   crossing the boundary (a trunk, a wheel, a hand). After any automated cut,
   inspect the boundary at full resolution where objects cross it. A containment
   guard (enlarged ellipse/box) must never become the visible edge: any smooth
   arc through solid content is a defect — fix the segmentation, don't ship it.
5. **Fade in place.** Layers overlapping existing content appear with opacity
   only — never translate-fades.
6. **The 50px test (final gate).** Every layer must move 50px any direction
   without revealing a straight edge, ghost double, or missing backdrop.

Technique and validated code: `references/cutting.md` (browser pipeline,
Python pipeline, alpha-probe verification).

## Serving, cache and versioning (hard-won rules)

- **Never serve with bare `python -m http.server`** — it sends no cache headers
  and browsers will re-serve stale bytes when filenames are reused. Use the
  bundled `scripts/serve_nocache.py` (Cache-Control: no-store).
- **Changed asset = changed filename** (`full-scene-v2.png`), or at minimum a
  `?v=N` cache-buster in the HTML. Never silently overwrite a same-named asset
  the browser has already seen.
- **After extracting any archive**: reconcile the file list against what the
  HTML references — sizes AND names. A missing layer (e.g., a backdrop that
  stayed v1) is silent until it isn't.
- **Diagnosing "old render"**: compare served bytes to disk bytes
  (`curl -so /dev/null -w '%{size_download}' URL` vs `stat`) before theorizing.

## Build & interactions

Full spec in `references/master-prompt.md`: layer stack, RAF-driven landing zoom
(never CSS keyframes), crossfade timing, parallax strengths, cursor-reactive
push (radius 400px, 45–50px, quadratic falloff, lerp 0.08), custom cursor,
:has() dock cards, layout. Adapt subject/layout freely; keep the invariants.

## Narrative navigation (OPTIONAL module — propose it, never impose it)

When the page has real destinations (portfolio sections, product areas), read
`references/navigation.md` and OFFER the user this possibility: the scene
becomes the sitemap — each section is a state of the scene, reached through
four field-validated effect archetypes (traversal, envelopment, mood shift,
growth), each with its exact reverse (back), chainable into a full site loop
(covered-swap technique). These are proven to work spectacularly well in the
reference project; they are a menu of possibilities for the user to pick from,
not a requirement. Buttons are always defined BEFORE effects (audience → one
action → tone → real content).

## Production playbook (assets, intro, visual testing, deploy)

Before optimizing images (WebP pipeline + the `-exact` banding lesson),
masking a wait (cinematic intro cards — the validated evolution of the
decode-gate), visually verifying any animation (CDP real-time shooter,
`scripts/shoot.py` — `--virtual-time-budget` does NOT advance rAF), or
deploying to GitHub Pages: read `references/production.md`. Available
patterns, not obligations.

## Final verification (non negotiable)

Render the page yourself (inject in a browser tab if no server is reachable) and
check: landing animation → invisible crossfade → idle reactivity. Run the 50px
test per layer, the alpha probes per PNG, and the served-bytes-vs-disk check.
Only then hand over, with the no-cache run command.
