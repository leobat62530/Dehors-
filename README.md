# Dehors !

Jeu de distance au coup de pied, pensé comme une mini-app Telegram en portrait. TypeScript + Vite, rendu Canvas 2D, zéro dépendance d'exécution.

## Commandes

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests Vitest
npm run build      # bundle statique dans dist/
npm run size       # vérifie le budget de 2 Mo
npm run sim        # simulateur d'équilibrage (valeurs de balance.ts)
```

## Organisation

- `src/config/balance.ts` : toutes les valeurs chiffrées du jeu, et nulle part ailleurs.
- `src/core` : boucle à pas fixe (120 Hz), entrées, générateur aléatoire à graine.
- `src/game` : physique, coup de pied, course, monde, entités, progression (XP, niveaux, améliorations), sauvegarde.
- `src/ui` : écrans, textes, formats.
- `src/theme` : palette et sprites placeholder dessinés en code.
- `src/telegram` : SDK Telegram (ready, expand, portrait, thème, haptique, CloudStorage, partage par requête inline).
- `src/core/audio.ts` : sons courts synthétisés en WebAudio. `src/ui/fx.ts` : traînée, particules, onde de choc, bandeaux de record.
- `public/sw.js` : service worker, le jeu reste jouable hors-ligne après le premier chargement.
- `src/game/premium.ts` : billets (monnaie premium achetée en Stars), pass, packs, gadgets d'une course, paliers de l'accélérateur, plafond de dépense par jour. `src/game/retention.ts` : série de connexions, roue quotidienne gratuite, défis du jour, bonus anti-décrochage, « presque gagné ».
- `src/telegram/payments.ts` : factures Stars via le serveur (`PAYMENTS_URL` dans `src/config/links.ts`, vide tant que le serveur n'est pas déployé : la boutique affiche alors les prix sans vendre). `src/core/analytics.ts` : événements anonymes, en file d'attente jusqu'à ce qu'un collecteur soit branché.
- `tests` : physique, pas fixe, monde, entités, progression, sauvegarde et migration, économie premium et rétention.

Règle d'économie : tout ce qui se paie est connu d'avance. L'aléatoire (roue, multiplicateurs) est toujours gratuit.

## Telegram

Le bundle se charge tel quel dans une mini-app : créer le bot avec BotFather, activer le mode inline (`/setinline`, nécessaire au bouton Partager) et déclarer l'URL de la page avec `/newapp` ou comme bouton de menu. Hors Telegram, la page fonctionne comme un site classique (sauvegarde locale, partage par la Web Share API ou le presse-papiers).

## Déploiement

Chaque push sur `main` publie `dist/` sur GitHub Pages via `.github/workflows/pages.yml`. Il faut activer Pages avec la source « GitHub Actions » dans les réglages du dépôt.
