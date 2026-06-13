# Content-aware cutting — THE canonical method

**This is not one option among several: the combined pipeline below is THE way
every focal cut is done in every project using this skill.** It was validated
end-to-end (user-approved as "PARFAITE") after every simpler variant failed:
geometric+feather → floating slabs; flood-fill alone → interior left uncut;
protection without texture gating → haze kept, structures eaten.

The focal cut must follow real content edges. The reference implementation is
`scripts/cut_focal_hole.py` (Python, PIL+numpy+scipy) — its COMBINED logic is
the one to reuse for every project of this skill. A browser-side variant exists
for when the master image can't reach the local filesystem (see end).

## The winning recipe: COMBINE coarse + organic

`hole = (coarse ellipse ∪ organic flood-fill) − rim-connected protected structures`

Each part covers the other's weakness: the ellipse guarantees the entire
interior goes (sky, valley, river, haze — a flood-fill alone leaves "interior
midground" behind, which the user reads as "pas croppé"); the flood-fill
guarantees the edge is organic where structures exist; the protection guarantees
that objects crossing the boundary (trunk, arch, mossy lip, wheel, hand) survive
inside the zone.

## The validated logic, step by step (and why)

1. **Material classification.** Sample the actual image first, then write
   predicates for (a) the boundary material and (b) **protected structures**.
   Protection must be **texture-gated**: rough structure has high local stddev
   (7×7), distant haze is smooth. Color predicates alone will "protect" warm
   sunset mountains and keep them stuck in the scene — the texture gate is the
   discriminator that separates a trunk from haze of the same hue. Don't forget
   bright materials: golden moss/grass on the rim needs its own textured class
   (warm AND bright AND rough), or it gets swallowed by the coarse ellipse.
2. **Protection applies only to components connected to the EXTERIOR of the
   guard.** Enclosed protected fragments would float over the moving backdrop
   and ghost — they get absorbed into the hole.
3. **Flood-fill from interior seeds**, blocked by protected pixels, contained by
   a LARGE guard (×1.30). The guard must never be the visible edge: any smooth
   arc through solid content is a defect — fix predicates, don't ship.
4. **Never blanket-dilate the mask** — dilation eats structure edges. Kill thin
   leaks with morphological opening.
5. **Connectivity cleanup.** Largest hole component only; absorb enclosed
   opaque islands; gentle closing.
5b. **Targeted touch-up is legitimate finishing.** If one stubborn fragment
   survives every rule (e.g. a valley remnant fused to the rim lip), union a
   small manual force-hole ellipse over it rather than retuning global
   predicates — global retuning to kill one fragment breaks ten good edges.
6. **Defringe LAST**: dilate the final hole by ~2px before feathering — it eats
   the bright/white fringe that clings to organic edges (leaves against bright
   sky). This is safe ONLY at this stage, on the protected, cleaned mask; the
   early-iteration disaster came from dilating an unprotected mask. If fringes
   persist, increase by 1px at a time — never more.
7. **Gentle feather** (gaussian ~2.5px) — feather hides anti-aliasing, not bad
   segmentation.
8. **Versioned outputs** (`full-scene-v6.png`): changed asset = changed name.

## Backdrop (sky layer) — final validated doctrine

**Use the ORIGINAL master image, unmodified, as the backdrop.** Visible from
frame 0 — never a black start behind the hole.

Why this beats every "built" backdrop we tried: with the landing starting CLOSE
(initial scale ~1.65, hole never covering the viewport) and the backdrop zooming
in sync (relative factor ~0.35), only a thin band of backdrop is ever revealed
around the hole edge. Doubled content (backdrop pixels matching the scene's rim)
is unnoticeable on small surfaces — whereas a synthetic backdrop (stretched
clouds + pasted interior) creates a flat halo around the rim that breaks the
effect far more than the doubling does. Lesson: a defect confined to a small
revealed band beats a global artificial look.

A dedicated GENERATED backdrop (true behind-world, no doubling at all) remains
the premium option — it costs one image generation, so it belongs to the budget
question of Phase 0.

Give the backdrop a clearly stronger parallax than the scene (e.g. 35 vs 10) so
the world behind feels alive.

## Self-verification (the script produces the material — actually look at it)

- **Boundary inspection crops** at full resolution wherever structures cross the
  edge (the script writes `inspect-*.png` on magenta backing). Inspect each one.
- **Composite parallax simulation**: full-scene over backdrop offset ~18px
  (`composite-parallax.png`). This is the 50px test in image form — seams,
  halos, ghost doubles show here before any browser is involved.
- **Alpha probes** per PNG (hole center transparent, corners opaque, halves
  complementary). Probe the halves' seam OUTSIDE the hole: inside it, both
  halves are legitimately transparent and the probe would false-fail.

## Hard-won facts

- **RGB under alpha=0 is destroyed** by canvas `convertToBlob` AND Photopea
  exports (premultiplication). Keep the pristine master image; recovery from cut
  PNGs is impossible.
- The backdrop's scaled interior (175%) is slightly softer than the original at
  1:1 — invisible in motion. If the project demands perfection there, generate a
  dedicated backdrop image instead (cost tradeoff — ask the user).
- Geometric cuts with heavy feather (the lazy v1) read as floating slabs the
  moment anything moves. There is no feather radius that fixes a wrong cut.

## Browser-side variant (when the image is only reachable via URL)

Same algorithm in page JS with OffscreenCanvas (CORS fetch). Useful facts:
- Photopea's postMessage API only answers when embedded in an iframe
  (`window.parent !== window`); full-page Photopea executes scripts but replies
  never arrive. `app.open(url)` + `saveToOE("png")` from the iframe is the
  no-CORS escape hatch.
- Package outputs as ONE store-method zip and trigger a single `<a download>` —
  Chrome silently drops rapid successive programmatic downloads. If a download
  doesn't appear on disk, re-click the same anchor.
- Writing into a Cowork-mounted folder: deletion may be blocked; overwrite via
  `cat src > dest` instead of unzip-in-place.
- After extracting any archive, reconcile its file list against what the HTML
  references — a layer silently missing from the zip (it happened: the backdrop)
  stays stale on disk with zero error anywhere.
