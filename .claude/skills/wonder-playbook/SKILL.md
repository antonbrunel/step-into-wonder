---
name: wonder-playbook
description: Savoir-faire établis du projet step-into-wonder — optimisation d'images WebP, écran de démarrage cinématique, test visuel temps réel via CDP, déploiement GitHub Pages. À consulter avant d'optimiser des assets, de toucher à l'intro ou de vérifier visuellement une animation.
---

# /wonder-playbook - Savoir-faire du projet

Ce projet est une scène interactive (portail, parallaxe, timeline RAF) en
HTML/CSS/JS pur, déployée sur GitHub Pages. Cette skill recense les solutions
éprouvées ici. **Elles ne sont pas obligatoires** : ce sont des patterns
disponibles, avec leur mode d'emploi, à adapter si le besoin se présente.

## 1. Images : pipeline WebP

**Quand y penser** : tout nouvel asset image, ou tout problème de poids/temps
de chargement. Les PNG IA sortent à 7-8 MB ; le WebP les ramène à <1 MB sans
perte visible.

**Principes** (le pipeline exact est adaptable) :
- Les masters PNG restent **locaux et gitignorés** (`images/*.png`) ; seuls
  les WebP sont commités et shippés. Une retouche (flip, recadrage…) se fait
  sur le master, puis on ré-encode.
- Commande de référence : `cwebp -q 90 -m 6 -sharp_yuv -exact -mt in.png -o out.webp`
- **Leçon apprise — banding** : sur une image avec alpha partiel (dégradés de
  ciel sous transparence), l'absence de `-exact` posterise les dégradés
  (bandes horizontales dans le portail). `-exact` préserve les RGB des pixels
  semi-transparents. q82 sans `-exact` avait produit ce défaut ; q90 + `-exact`
  l'a éliminé.
- **Toujours vérifier visuellement chaque WebP produit** (l'ouvrir/le lire,
  pas seulement comparer les tailles) avant de mettre à jour les références
  dans `index.html`.

## 2. Écran de démarrage cinématique

**Quand y penser** : si un temps d'attente incompressible doit être masqué
(décodage d'images, chargement). Le parti pris du projet : pas de spinner —
des cartons de texte façon générique de film sur fond noir. Si un nouveau
besoin d'attente apparaît, **adapter ce mécanisme existant** plutôt que
d'ajouter un loader concurrent.

**Où ça vit** : machine à états dans `script.js` (section « Intro
cinématique »), styles `#intro` dans `style.css`, bloc `#intro` dans
`index.html`.

**Principes non négociables du pattern** :
- Tout est cadencé sur **l'horloge RAF**, jamais `setTimeout` (le décodage
  étrangle le main thread et fausse les timers).
- Le checkpoint « prêt ? » n'a lieu qu'**entre deux cartons**, jamais en
  cours de phrase.
- Le lever de rideau révèle un état **statique mais vivant** (parallaxe
  active), respire (~350 ms), **puis** pose `t0` : la transition ne masque
  jamais le début de l'animation principale.
- `t0` n'est posé que depuis un frame RAF — donc onglet visible, garanti
  structurellement.
- Cartons : EN d'abord, FR si l'attente continue, puis cartons d'attente en
  alternance. Textes dans la constante `CARDS`.

## 3. Test visuel temps réel (CDP)

**Quand l'utiliser** : pour vérifier une animation, l'intro, un comportement
au survol — tout ce qu'un test statique ne montre pas.

**Piège connu** : `--virtual-time-budget` de Chrome headless n'avance que les
timers, **pas le rAF** — toute logique cadencée RAF reste figée. Il faut du
temps réel.

**Outil du projet** : `tools/shoot.py` — pilote Chrome via CDP, une session
continue, screenshots datés + dispatch souris optionnel.

```bash
# servir le site
python3 -m http.server 8123 &
# chemin rapide : captures à des instants clés (ms)
python3 tools/shoot.py "http://localhost:8123/" /tmp/shot- 1600,4700,8500,13000
# réseau throttlé (kbps) pour tester les états d'attente
python3 tools/shoot.py "http://localhost:8123/" /tmp/slow- 1800,6000,17800 3200
# test de survol : souris dispatchée à (x,y) à t ms
python3 tools/shoot.py "http://localhost:8123/" /tmp/hover- 13000,15000 "mouse=1260,745,13200"
```

Lire ensuite les PNG produits pour valider visuellement chaque moment de la
chorégraphie (cascade de lettres, lever de rideau, état final…).

## 4. Déploiement et vérification prod

- Push sur `main` → GitHub Pages rebuild automatiquement (build « legacy »).
- Attendre `built` : `gh api repos/antonbrunel/step-into-wonder/pages/builds/latest --jq .status`
- Vérifier la prod en **téléchargeant vers un fichier** puis grep
  (`curl -s URL -o /tmp/f && grep ... /tmp/f`) — le grep direct sur un pipe
  curl peut être filtré par l'environnement et donner des faux négatifs.
- Cache edge ~10 min sur `/` : un hard refresh peut être nécessaire côté
  navigateur.

## Règles

- Ne jamais commiter de PNG master ; vérifier `git ls-files "*.png"` reste vide.
- Toute modification visuelle ou d'animation se valide avec `tools/shoot.py`
  avant commit (au minimum : un instant pendant l'intro, un après).
- Les principes du §2 (checkpoint entre cartons, révélation non masquante,
  horloge RAF) priment sur toute nouvelle implémentation d'attente.
