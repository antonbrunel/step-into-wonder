/* Step Into Wonder — timeline + interactions
   Zoom portail : requestAnimationFrame (PAS de keyframes CSS).
   Corrections v4 :
   - zoom centré sur le TROU (origin dynamique) et échelle initiale calculée
     pour démarrer À L'INTÉRIEUR du cercle (l'extérieur n'est jamais visible)
   - les overlays (feuillage, fleurs) zooment AVEC la scène via #fx-zoom
   - crossfade sans creux d'opacité : full-scene fond par-dessus les moitiés
     restées opaques, qui ne sont coupées qu'une fois le fondu terminé
   - parallaxe du ciel renforcée (35) pour un fond vivant */

(() => {
  "use strict";

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const sky = $("sky");
  const portalLeft = $("portal-left");
  const portalRight = $("portal-right");
  const fullScene = $("full-scene");
  const flowers = $("flowers");
  const wrapFlowers = $("wrap-flowers");
  const foliageWraps = Array.from(document.querySelectorAll(".foliage-wrap"));
  const foliages = ["foliage-tl", "foliage-tr", "foliage-bl", "foliage-br"].map($);
  const cursorEl = $("cursor");

  // ---------- Config ----------
  // Géométrie du trou dans l'image maître (fractions)
  const IMG = { W: 2752, H: 1536, fx: 1392 / 2752, fy: 652 / 1536, holeW: 800, holeH: 792 };
  const ZOOM_TO = 1.0, ZOOM_MS = 2500;
  const PARALLAX = { sky: 35, fullScene: 10, flowers: 40, portal: 12, foliage: 30 };
  const FOLIAGE = { radius: 400, push: 48, lerp: 0.08 };
  const CURSOR_LERP = 0.18;

  // cubic-bezier(0.65, 0, 0.35, 1)
  function cubicBezier(p1x, p1y, p2x, p2y) {
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    const sX = (t) => ((ax * t + bx) * t + cx) * t;
    const sY = (t) => ((ay * t + by) * t + cy) * t;
    const sDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = sX(t) - x;
        const d = sDX(t);
        if (Math.abs(e) < 1e-5 || d === 0) break;
        t -= e / d;
      }
      return sY(Math.min(1, Math.max(0, t)));
    };
  }
  // Décélération PURE : départ à vitesse max, on ne fait que ralentir.
  // (un ease-in-out laisse ~1s de quasi-immobilité au début = sensation
  // d'attente avant que le voyage commence)
  const zoomEase = cubicBezier(0.16, 1, 0.3, 1);

  // ---------- Géométrie dynamique (cover mapping) ----------
  // Position du centre du trou dans le viewport + échelle de départ pour que
  // l'ouverture couvre tout l'écran au lancement.
  // Départ PROCHE de la position finale : le cadre est visible dès la première
  // frame, le trou ne couvre jamais tout l'écran (sinon la première impression
  // est l'image de fond entière, dézoomée — exactement ce qu'on ne veut pas).
  const ZOOM_FROM = 1.65;
  // Zoom du fond : un peu plus marqué au départ (+3.5%) et un peu moins à
  // l'arrivée (-2.5%) que la version précédente — le fond voyage en synchro
  // avec la scène mais reste toujours en retrait (parallaxe préservée).
  const SKY_START = 1.42; // au lancement
  const SKY_END = 1.09;   // au repos
  // Flottement d'inactivité : dérive sinusoïdale ultra légère, périodes et
  // phases désynchronisées — un écho, jamais un mouvement mécanique.
  const FLOATS = [
    { amp: 4.0, period: 8.5,  phase: 0.0 },
    { amp: 3.5, period: 10.5, phase: 1.7 },
    { amp: 4.5, period: 7.5,  phase: 3.9 },
    { amp: 3.0, period: 9.5,  phase: 5.2 },
  ];
  const FLOWERS_FLOAT = { amp: 2.5, period: 11.5, phase: 2.6 };
  function computeGeometry() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.max(vw / IMG.W, vh / IMG.H); // object-fit: cover
    const dispW = IMG.W * s, dispH = IMG.H * s;
    const offX = (dispW - vw) / 2, offY = (dispH - vh) / 2;
    const ox = IMG.fx * dispW - offX;
    const oy = IMG.fy * dispH - offY;
    const origin = `${ox}px ${oy}px`;
    portalLeft.style.transformOrigin = origin;
    portalRight.style.transformOrigin = origin;
    sky.style.transformOrigin = origin;
    fullScene.style.transformOrigin = origin;
    wrapFlowers.style.transformOrigin = origin;
    foliageWraps.forEach((w) => { w.style.transformOrigin = origin; });
  }

  // ---------- Transitions de démo ----------
  const fx = { mode: null, start: 0, bloomShown: false, textShown: false };
  let skyBoostT = 1, skyBoost = 1;
  const fireflies = [];
  computeGeometry();
  window.addEventListener("resize", computeGeometry);

  // ---------- Souris ----------
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let nx = 0, ny = 0, pnx = 0, pny = 0;
  let curX = mouseX, curY = mouseY;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    nx = (e.clientX / window.innerWidth) * 2 - 1;
    ny = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // ---------- Feuillage : centres mesurés sur les vrais éléments ----------
  // Centre de répulsion abaissé pour le buisson bas-droit : son bbox remonte
  // haut au-dessus des cards, et un centre au milieu ferait qu'un curseur posé
  // sur les boutons (donc SOUS le centre) pousse le buisson vers le HAUT.
  // Ancré à 85% de sa hauteur, le centre passe sous le bas du viewport :
  // le curseur est toujours au-dessus -> poussée vers le bas, jamais vers le haut.
  const FOLIAGE_ANCHOR_Y = { "foliage-br": 0.85 };
  const folState = foliages.map((el) => ({ el, baseX: 0, baseY: 0, x: 0, y: 0, r: 0, ay: FOLIAGE_ANCHOR_Y[el.id] ?? 0.5 }));

  function measureFoliage() {
    for (const f of folState) {
      const prev = f.el.style.transform;
      f.el.style.transform = "";
      const rct = f.el.getBoundingClientRect();
      f.baseX = rct.left + rct.width / 2;
      f.baseY = rct.top + rct.height * f.ay;
      f.el.style.transform = prev;
    }
  }
  window.addEventListener("load", measureFoliage);
  window.addEventListener("resize", measureFoliage);
  setTimeout(measureFoliage, 300);

  // ---------- Timeline pilotée par l'horloge RAF ----------
  // Jamais de setTimeout pour la timeline : le décodage des grandes images
  // étrangle le main thread et les timers partent avec du retard.
  // La timeline ne démarre qu'au lever du rideau d'intro — lui-même conditionné
  // au décodage de TOUTES les images (machine à états plus bas).
  let t0 = null;
  let zoomScale = ZOOM_FROM;
  let zoomDone = false;

  const steps = [
    // (le fond — image originale brute — est visible dès la frame 0)
    // Les overlays apparaissent TÔT : ils voyagent avec le zoom
    { at: 250, run: () => {
        $("wrap-flowers").classList.add("on");
        document.querySelectorAll(".foliage-wrap").forEach((w) => w.classList.add("on"));
      } },
    // Crossfade APRÈS la fin du zoom : full-scene (au-dessus) fond par-dessus
    // les moitiés opaques -> aucun creux d'opacité.
    { at: 2400, run: () => $("hero-text").classList.add("on") },
    { at: 2500, run: () => $("wrap-full-scene").classList.add("on") },
    { at: 2550, run: () => $("nav").classList.add("on") },
    { at: 2650, run: () => $("cards").classList.add("on") },
    // Les moitiés sont coupées net une fois entièrement recouvertes.
    { at: 3600, run: () => {
        $("wrap-portal-left").classList.add("off");
        $("wrap-portal-right").classList.add("off");
      } },
  ];
  let stepIdx = 0;

  const allImgs = Array.from(document.querySelectorAll("img"));
  const ready = Promise.allSettled(allImgs.map((im) => im.decode ? im.decode() : Promise.resolve()));
  let imagesReady = false;
  ready.then(() => { imagesReady = true; });

  // ---------- Intro cinématique (machine à états sur l'horloge RAF) ----------
  // Cartons de texte sur rideau noir pendant le décodage, façon générique de
  // film : EN, puis FR si les images n'ont pas suivi, puis cartons d'attente
  // en alternance. Le checkpoint n'a lieu qu'EN FIN de carton (jamais en cours
  // de phrase) ; le lever de rideau révèle le frame-0 vivant (parallaxe déjà
  // active), respire, PUIS pose t0 — le voyage part totalement à découvert.
  const CARDS = [
    { kicker: "a demo by",             main: "Antton Brunel" },
    { kicker: "une démo proposée par", main: "Antton Brunel" },
    { kicker: "still loading",         main: "wonder takes a moment" },
    { kicker: "thank you for waiting", main: "it’s on its way" },
  ];
  const CARD_OUT = 3050;   // sortie du texte (lettres posées + tenue écoulée)
  const CARD_END = 4200;   // fin du carton : sortie 700ms + battement noir 450ms
  const CURTAIN_GO = 1500; // fondu du rideau 1150ms + respiration 350ms -> t0

  const intro = {
    el: $("intro"),
    content: $("intro-content"),
    kicker: $("intro-kicker"),
    main: $("intro-main"),
    state: "card", idx: 0, start: null, outAdded: false,
  };

  function introSetCard(idx) {
    // Au-delà de la liste : alternance des deux cartons d'attente
    const card = idx < CARDS.length ? CARDS[idx] : CARDS[2 + (idx % 2)];
    intro.kicker.textContent = card.kicker;
    intro.main.innerHTML = "";
    let li = 0;
    for (const word of card.main.split(" ")) {
      const w = document.createElement("span");
      w.className = "w";
      for (const ch of word) {
        const l = document.createElement("span");
        l.className = "l";
        l.textContent = ch;
        l.style.transitionDelay = (350 + li * 45) + "ms"; // cascade d'écriture
        w.appendChild(l);
        li++;
      }
      intro.main.appendChild(w);
    }
  }

  function introTick(now) {
    // Onglet gelé pendant un carton : au retour, l'horloge a sauté et on passe
    // directement au checkpoint — état cohérent, personne ne regardait. t0 ne
    // peut être posé que par un frame RAF, donc onglet visible.
    if (intro.state === "done") return;

    if (intro.start === null) { // premier frame visible : carton 1
      intro.start = now;
      introSetCard(0);
      intro.content.classList.add("in");
      return;
    }
    const e = now - intro.start;

    if (intro.state === "card") {
      if (e >= CARD_OUT && !intro.outAdded) {
        intro.outAdded = true;
        intro.content.classList.add("out");
      }
      if (e >= CARD_END) {
        if (imagesReady) {
          intro.state = "reveal";
          intro.start = now;
          intro.el.classList.add("reveal"); // lever de rideau sur le plan vivant
        } else {
          // Carton suivant : retour à l'état caché SANS animation, puis cascade
          intro.idx++;
          intro.start = now;
          intro.outAdded = false;
          intro.content.classList.add("reset");
          intro.content.classList.remove("in", "out");
          introSetCard(intro.idx);
          void intro.content.offsetWidth;
          intro.content.classList.remove("reset");
          intro.content.classList.add("in");
        }
      }
    } else if (intro.state === "reveal" && e >= CURTAIN_GO) {
      intro.state = "done";
      intro.el.classList.add("gone");
      t0 = now; // départ du voyage : rideau levé + respiration écoulée
    }
  }

  // ---------- Boucle RAF ----------
  function frame(now) {
    introTick(now);
    // Tant que le rideau n'est pas levé (t0 null), on rend l'état frame-0
    // (moitiés zoomées, parallaxe active) — jamais la scène à l'échelle 1.
    const elapsed = t0 === null ? 0 : now - t0;
    while (stepIdx < steps.length && elapsed >= steps[stepIdx].at) {
      steps[stepIdx].run();
      stepIdx++;
    }
    const p = Math.min(1, elapsed / ZOOM_MS);
    zoomScale = ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * zoomEase(p);

    pnx += (nx - pnx) * 0.06;
    pny += (ny - pny) * 0.06;

    // Plongée dans le portail (effet "work") : accélération pure ; "dive-out"
    // est la même trajectoire jouée à l'envers (back / navigation inverse)
    let diveE = 0;
    if (fx.mode === "dive") {
      const q = Math.min(1, (now - fx.start) / 1500);
      diveE = q * q;
      if (q > 0.55 && !fx.bloomShown) { fx.bloomShown = true; $("bloom").classList.add("show"); }
      if (q >= 1 && !fx.textShown) { fx.textShown = true; $("bloom").classList.add("dimmed"); showOverlay("dive"); busy = false; }
    } else if (fx.mode === "dive-out") {
      const u = Math.min(1, (now - fx.start) / 1100);
      diveE = (1 - u) * (1 - u);
      if (u >= 1) { $("bloom").classList.remove("show", "dimmed"); settleHome(); }
    }
    skyBoost += (skyBoostT - skyBoost) * 0.04;

    const zr = (zoomScale - 1) / (ZOOM_FROM - 1); // 1 au départ, 0 à l'arrivée
    const skyScale = (SKY_END + (SKY_START - SKY_END) * zr) * skyBoost * (1 + diveE * 0.3);
    sky.style.transform = `translate(${-pnx * PARALLAX.sky}px, ${-pny * PARALLAX.sky}px) scale(${skyScale})`;
    fullScene.style.transform = `translate(${-pnx * PARALLAX.fullScene}px, ${-pny * PARALLAX.fullScene}px) scale(${1 + diveE * 3.4})`;
    const ts = now / 1000;
    const ff = FLOWERS_FLOAT;
    const fdx = Math.sin(ts * 2 * Math.PI / ff.period + ff.phase) * ff.amp;
    const fdy = Math.cos(ts * 2 * Math.PI / (ff.period * 1.3) + ff.phase) * ff.amp * 0.6;
    flowers.style.transform = `translate(${-pnx * PARALLAX.flowers + fdx}px, ${-pny * PARALLAX.flowers + fdy}px)`;
    const halfT = `translate(${-pnx * PARALLAX.portal}px, ${-pny * PARALLAX.portal}px) scale(${zoomScale})`;
    portalLeft.style.transform = halfT;
    portalRight.style.transform = halfT;

    // Les overlays zoument AVEC la scène mais à des vitesses différentes :
    // le premier plan voyage plus vite (fleurs ×1.5, feuillage ×1.3) que les
    // moitiés (×1.0) — c'est cette différence qui crée la parallaxe du landing.
    if (p < 1) {
      const zf = (k) => 1 + (zoomScale - 1) * k;
      wrapFlowers.style.transform = `scale(${zf(1.5)})`;
      foliageWraps.forEach((w) => { w.style.transform = `scale(${zf(1.3)})`; });
    } else if (!zoomDone) {
      wrapFlowers.style.transform = "";
      foliageWraps.forEach((w) => { w.style.transform = ""; });
      zoomDone = true;
      measureFoliage();
    } else if ((fx.mode === "dive" || fx.mode === "dive-out") && !fx.wrapFree) {
      const s = `scale(${1 + diveE * 5})`;
      wrapFlowers.style.transform = s;
      foliageWraps.forEach((w) => { w.style.transform = s; });
    }

    // Dérive des lucioles (effet crépuscule)
    for (const fl of fireflies) {
      const t2 = now / 1000;
      fl.el.style.transform = `translate(${Math.sin(t2 * fl.w + fl.p) * fl.amp}px, ${Math.cos(t2 * fl.w * 0.8 + fl.p) * fl.amp * 0.7}px)`;
    }

    for (let i = 0; i < folState.length; i++) {
      const f = folState[i];
      const dx = f.baseX - mouseX, dy = f.baseY - mouseY;
      const dist = Math.hypot(dx, dy);
      let tx = 0, ty = 0;
      if (dist < FOLIAGE.radius && dist > 0.001) {
        const fall = Math.pow(1 - dist / FOLIAGE.radius, 2);
        const k = (FOLIAGE.push * fall) / dist;
        tx = dx * k;
        ty = dy * k;
      }
      f.x += (tx - f.x) * FOLIAGE.lerp;
      f.y += (ty - f.y) * FOLIAGE.lerp;
      f.r += ((f.x * 0.04) - f.r) * FOLIAGE.lerp;
      // Dérive flottante (désynchronisée par calque)
      const fl = FLOATS[i];
      const w = 2 * Math.PI / fl.period;
      const flx = Math.sin(ts * w + fl.phase) * fl.amp;
      const fly = Math.cos(ts * w * 0.8 + fl.phase) * fl.amp * 0.7;
      const flr = Math.sin(ts * w * 0.6 + fl.phase) * 0.25;
      f.el.style.transform = `translate(${f.x + flx - pnx * PARALLAX.foliage}px, ${f.y + fly - pny * PARALLAX.foliage}px) rotate(${f.r + flr}deg)`;
    }

    curX += (mouseX - curX) * CURSOR_LERP;
    curY += (mouseY - curY) * CURSOR_LERP;
    cursorEl.style.transform = `translate(${curX}px, ${curY}px)`;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // t0 est posé par la machine d'intro (rideau levé + respiration). Seul un
  // frame RAF — donc un onglet visible — peut le poser : la garde "ne jamais
  // démarrer caché" est structurelle (Chrome gèle le RAF des onglets occlus).

  document.querySelectorAll("a, .card").forEach((el) => {
    el.addEventListener("mouseenter", () => cursorEl.classList.add("grow"));
    el.addEventListener("mouseleave", () => cursorEl.classList.remove("grow"));
  });

  // ---------- Sections de démo : contenu, navigation, aller-retour ----------
  const COPY = {
    dive:    { l1: "Selected work,",  l2: "coming soon.",   sub: "Real projects with real outcomes — currently being replanted here." },
    curtain: { l1: "Welcome to",      l2: "the garden.",    sub: "Experiments, prototypes and notes — things grow wild here." },
    dusk:    { l1: "Night falls,",    l2: "stories begin.", sub: "I'm Antton — I craft AI-powered experiences with care and curiosity." },
    plant:   { l1: "Let's talk,",     l2: "shall we?",      sub: "antton.brunel@gmail.com — always happy to meet kind, curious people." },
  };

  let busy = false;
  const hero = document.querySelector(".hero");

  function showOverlay(name) {
    $("dl1").textContent = COPY[name].l1;
    $("dl2").textContent = COPY[name].l2;
    $("dsub").textContent = COPY[name].sub;
    document.querySelectorAll("[data-goto]").forEach((a) => {
      a.style.display = a.dataset.goto === name ? "none" : "";
    });
    $("demo-overlay").classList.add("show");
  }
  function hideOverlay() {
    $("demo-overlay").classList.remove("show");
  }
  function settleHome() {
    fx.mode = null;
    fx.wrapFree = false;
    fx.bloomShown = false;
    fx.textShown = false;
    skyBoostT = 1;
    hero.classList.remove("demo-active");
    computeGeometry(); // restaure les origins focales des wrappers
    busy = false;
  }

  function spawnFireflies() {
    for (let i = 0; i < 6; i++) {
      const f = document.createElement("div");
      f.className = "firefly";
      f.style.left = (10 + Math.random() * 80) + "vw";
      f.style.top = (35 + Math.random() * 55) + "vh";
      hero.appendChild(f);
      requestAnimationFrame(() => f.classList.add("show"));
      fireflies.push({ el: f, p: Math.random() * 6.28, w: 0.25 + Math.random() * 0.35, amp: 14 + Math.random() * 16 });
    }
  }
  function clearFireflies() {
    for (const fl of fireflies) {
      fl.el.classList.remove("show");
      setTimeout(() => fl.el.remove(), 1700);
    }
    fireflies.length = 0;
  }

  const SPRING_IN = "transform 1.5s cubic-bezier(0.3, 1.08, 0.35, 1)";
  const EASE_OUT = "transform 1.25s cubic-bezier(0.16, 1, 0.3, 1)";
  const DUSK_ORDER = () => [sky, fullScene, flowers, ...foliages];

  function enter(name) {
    fx.mode = name;
    fx.start = performance.now();
    hero.classList.add("demo-active");

    if (name === "curtain") {
      const origins = ["0% 0%", "100% 0%", "0% 100%", "100% 100%"];
      foliageWraps.forEach((w, i) => {
        w.style.transformOrigin = origins[i];
        w.style.transition = SPRING_IN;
        w.style.transform = "scale(2.7)";
      });
      wrapFlowers.style.transformOrigin = "50% 110%";
      wrapFlowers.style.transition = SPRING_IN;
      wrapFlowers.style.transform = "scale(2.3)";
      $("vignette").classList.add("show");
      setTimeout(() => { showOverlay(name); busy = false; }, 1250);
    } else if (name === "plant") {
      const w = foliageWraps[2];
      w.style.transformOrigin = "0% 100%";
      w.style.transition = "transform 1.7s cubic-bezier(0.3, 1.08, 0.35, 1)";
      w.style.transform = "scale(3.4)";
      skyBoostT = 1.06;
      $("vignette").classList.add("show");
      setTimeout(() => { showOverlay(name); busy = false; }, 1350);
    } else if (name === "dusk") {
      DUSK_ORDER().forEach((el, i) => setTimeout(() => el.classList.add("duskfx"), i * 160));
      setTimeout(spawnFireflies, 700);
      setTimeout(() => { showOverlay(name); busy = false; }, 1600);
    }
    // "dive" : l'overlay est déclenché par la boucle RAF (q >= 1)
  }

  // Rejoue l'animation de la section À L'ENVERS, puis rend la main
  function exitFx(mode, cb) {
    hideOverlay();
    if (mode === "curtain") {
      foliageWraps.forEach((w) => { w.style.transition = EASE_OUT; w.style.transform = ""; });
      wrapFlowers.style.transition = EASE_OUT;
      wrapFlowers.style.transform = "";
      $("vignette").classList.remove("show");
      setTimeout(() => { cb ? cb() : settleHome(); }, 1280);
    } else if (mode === "plant") {
      const w = foliageWraps[2];
      w.style.transition = EASE_OUT;
      w.style.transform = "";
      skyBoostT = 1;
      $("vignette").classList.remove("show");
      setTimeout(() => { cb ? cb() : settleHome(); }, 1280);
    } else if (mode === "dusk") {
      const order = DUSK_ORDER().reverse();
      order.forEach((el, i) => setTimeout(() => el.classList.remove("duskfx"), i * 130));
      clearFireflies();
      setTimeout(() => { cb ? cb() : settleHome(); }, 1450);
    } else if (mode === "dive") {
      fx.mode = "dive-out"; // trajectoire inverse, gérée par la boucle RAF
      fx.start = performance.now();
      $("bloom").classList.remove("dimmed");
      // settleHome arrive via la RAF (u>=1) ; pour un chaînage, on reprend
      // la main juste après (busy re-verrouillé car settleHome l'a relâché)
      if (cb) setTimeout(() => { busy = true; cb(); }, 1180);
    }
  }

  function goto(name) {
    if (busy || !zoomDone || name === fx.mode) return;
    busy = true;
    if (!fx.mode) { enter(name); return; }

    // Cas spécial validé : depuis le jardin refermé, les feuilles se
    // rouvrent DIRECTEMENT sur le ciel et les montagnes (état "work"),
    // sans repasser par l'accueil — la boucle du site.
    if (fx.mode === "curtain" && name === "dive") {
      hideOverlay();
      fx.mode = "dive";
      fx.start = performance.now() - 99999; // diveE = 1 : scène déjà traversée
      fx.wrapFree = true;                   // les feuilles restent pilotées en CSS
      fx.bloomShown = true;
      fx.textShown = true;
      $("bloom").classList.add("show", "dimmed");
      foliageWraps.forEach((w) => { w.style.transition = "transform 1.5s cubic-bezier(0.16, 1, 0.3, 1)"; w.style.transform = ""; });
      wrapFlowers.style.transition = "transform 1.5s cubic-bezier(0.16, 1, 0.3, 1)";
      wrapFlowers.style.transform = "";
      $("vignette").classList.remove("show");
      setTimeout(() => { showOverlay("dive"); busy = false; }, 1400);
      return;
    }

    // Chaînage générique : on rejoue la section courante à l'envers,
    // puis on enchaîne la suivante (l'UI reste en retrait, pas de retour accueil)
    exitFx(fx.mode, () => enter(name));
  }

  document.querySelectorAll("[data-fx]").forEach((el) => {
    el.addEventListener("click", (e) => { e.preventDefault(); goto(el.dataset.fx); });
  });
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", (e) => { e.preventDefault(); goto(el.dataset.goto); });
  });
  $("back").addEventListener("click", (e) => {
    e.preventDefault();
    if (busy || !fx.mode) return;
    busy = true;
    exitFx(fx.mode, null);
  });
})();
