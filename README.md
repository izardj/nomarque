# Nomarque

Jeu de gestion multijoueur asynchrone dans l'Égypte antique, jouable sur mobile et navigateur. Chaque joueur dirige un nome le long du Nil, bâtit sa cité au rythme des crues, commerce avec les autres nomarques et contribue au monument du pharaon. Une saison = un règne de 4 semaines.

> Nom de projet provisoire.

## Documents

| Document | Contenu |
| --- | --- |
| [Game design](docs/game-design.md) | Vision, boucles de jeu, gestion, multijoueur, fin de règne, onboarding, monétisation, périmètre MVP |
| [Spec technique](docs/spec-technique.md) | Stack, modèle de données, temps du jeu, algorithme de production, marché, API, jalons |
| [Direction artistique](docs/direction-artistique.md) | Palette, typographie, principes, écrans mobiles |
| [Données d'économie](data/economie) | Bâtiments, maisons, besoins, ressources, paramètres, expéditions, 30 cartes d'événement (CSV) |
| [Maquettes](design/maquettes) | Sources des 6 écrans mobiles et de la planche de DA |

Les sources vivantes (à modifier en priorité, puis réexporter ici) :

- [Game design](https://claude.ai/artifact/MSxBCyzAJhHd5BVmjarzny)
- [Spec technique](https://claude.ai/artifact/NBmTQeeKnEpkcEwTVjF6Z3)
- [Tableur d'économie](https://claude.ai/artifact/TZyzzqauHMzUrxxHxbGwjG) (formules et simulation d'un nome)
- [Canvas DA et maquettes](https://claude.ai/artifact/AYX1CtXsXhVCRddFgL5eRh)

## Stack prévue

Monorepo Nx en TypeScript : Angular + PixiJS (PWA) pour le client, NestJS pour l'API et le worker, BullMQ sur Redis pour les échéances, PostgreSQL + Prisma. Les règles du jeu vivent dans `libs/rules`, une librairie pure partagée entre client et serveur.

## Prochaine étape

Jalon J0 (socle) puis J1 (cité solo : `libs/rules` et la fonction `advance`). Voir le [plan de développement](docs/spec-technique.md#plan-de-développement).
