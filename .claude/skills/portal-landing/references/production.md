# Production playbook — asset pipeline, intro screen, visual testing, deploy

Field-proven solutions from the reference project. **None are mandatory** —
they are available patterns with their instructions, to adapt when the need
arises. Consult before: optimizing image assets, touching the intro / any
wait state, visually verifying an animation, or deploying.

## 1. Images: WebP pipeline

**When**: any new image asset, or any weight/load-time concern. AI-generated
PNGs come out at 7–8 MB; WebP brings them under 1 MB with no visible loss.

Principles (the exact pipeline is adaptable):
- Master PNGs stay **local and gitignored** (`images/*.png`); only WebP files
  are committed and shipped. Any retouch (flip, crop…) happens on the master,
  then re-encode.
- Reference command:
  `cwebp -q 90 -m 6 -sharp_yuv -exact -mt in.png -o out.webp`
- **Hard-won lesson — banding**: on images with partial alpha (sky gradients
  under transparency), omitting `-exact` posterizes the gradients (horizontal
  bands inside the portal). `-exact` preserves the RGB of semi-transparent
  pixels. q82 without `-exact` produced the defect; q90 + `-exact` removed it.
- **Visually check every produced WebP** (open and look at it, not just
  compare file sizes) before updating the references in the HTML.

## 2. Cinematic intro screen (the wait, turned into an asset)

**When**: any incompressible wait must be masked (image decode, loading).
The validated stance: no spinner — film-credit text cards on black. If a new
wait need appears, **adapt this existing mechanism** rather than adding a
competing loader.

This pattern is the validated EVOLUTION of the bare decode-gate described in
master-prompt.md: instead of holding frame 0 silently, the wait becomes part
of the experience.

Non-negotiable principles:
- Everything is clocked on the **RAF clock**, never `setTimeout` (decode
  starves the main thread and timers fire seconds late).
- The "ready?" checkpoint happens only **between two cards**, never
  mid-sentence.
- The curtain-lift reveals a **static-but-alive** state (parallax active),
  breathes (~350 ms), **then** sets `t0`: the transition never masks the
  start of the main animation.
- `t0` is only ever set from inside a RAF frame — therefore from a visible
  tab, structurally guaranteed (no separate visibilitychange plumbing).
- Cards: primary language first, secondary if the wait continues, then
  alternating patience cards. Texts live in one constant for easy editing.

## 3. Real-time visual testing (CDP) — the only honest way to see motion

**When**: verifying an animation, the intro, a hover behavior — anything a
static check can't show.

**Known trap**: Chrome headless `--virtual-time-budget` advances only timers,
**not rAF** — all RAF-clocked logic stays frozen. Real time is required.
(Equally: driving a visible browser whose window is occluded freezes RAF and
transitions — screenshots then capture frozen mid-states and lie to you.)

**Bundled tool**: `scripts/shoot.py` — drives headless Chrome over CDP in one
continuous session, dated screenshots + optional mouse dispatch. Adapt the
CHROME path constant to the host OS. Requires `websockets` (pip).

```bash
# serve the site
python3 -m http.server 8123 &
# fast path: captures at key instants (ms)
python3 shoot.py "http://localhost:8123/" /tmp/shot- 1600,4700,8500,13000
# throttled network (kbps) to test wait states
python3 shoot.py "http://localhost:8123/" /tmp/slow- 1800,6000,17800 3200
# hover test: mouse dispatched at (x,y) at t ms
python3 shoot.py "http://localhost:8123/" /tmp/hover- 13000,15000 "mouse=1260,745,13200"
```

Then READ the produced PNGs to validate each moment of the choreography
(letter cascade, curtain lift, final state…) — looking is the verification.

## 4. Deploy & production verification (GitHub Pages)

- Push to `main` → GitHub Pages rebuilds automatically (legacy build).
- Wait for `built`:
  `gh api repos/<owner>/<repo>/pages/builds/latest --jq .status`
- Verify prod by **downloading to a file** then grepping
  (`curl -s URL -o /tmp/f && grep … /tmp/f`) — grepping a curl pipe directly
  can be filtered by the environment and yield false negatives.
- Edge cache ~10 min on `/`: a hard refresh may be needed browser-side.

## Rules

- Never commit master PNGs; keep `git ls-files "*.png"` empty.
- Any visual or animation change is validated with the CDP shooter before
  commit (minimum: one instant during the intro, one after).
- The §2 principles (checkpoint between cards, non-masking reveal, RAF clock)
  take precedence over any new wait implementation.
