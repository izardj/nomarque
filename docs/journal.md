# Journal de développement

Une entrée par session : ce qui a été fait, par quel modèle, ce qui a échoué et pourquoi, les décisions prises.

Modèles : **Opus** (tech lead), **Sonnet** (`claude-sonnet-5-5`), **DeepSeek** (`opencode/deepseek-v4.1-flash-free`).

## Organisation Git

- Une branche de jalon (`milestone/j0`, `milestone/j1`…) part de `main` et reçoit une pull request vers `main` à la fin du jalon.
- Une branche par tâche (`chore/j0-scaffold`, `feat/j0-auth`…), fusionnée dans la branche de jalon après relecture d'Opus.
- Les délégations tournent dans des worktrees isolés pour pouvoir avancer en parallèle.

## Plan — J0 · Socle

Validation : un joueur se connecte par lien magique et rejoint un monde.

| # | Tâche | Branche | Modèle | Dépend de |
| --- | --- | --- | --- | --- |
| 0 | Décisions d'architecture : outillage, tags Nx, frontières entre libs | — | Opus | — |
| 1 | Squelette Nx : `apps/api`, `apps/worker`, `apps/web`, `libs/rules`, `libs/data`, `libs/contracts`, lint et tests qui passent | `chore/j0-scaffold` | DeepSeek | 0 |
| 2 | Docker Compose (postgres, redis, mailpit), Dockerfiles, `.env.example` | `chore/j0-docker` | DeepSeek | 1 |
| 3 | CI GitHub Actions : lint, tests, build des projets touchés | `chore/j0-ci` | DeepSeek | 1 |
| 4 | Types des données de jeu (`libs/data`) et table des identifiants | `feat/j0-data-contract` | Opus | 1 |
| 5 | Script `tools:import-data` CSV → JSON validé par Zod | `feat/j0-import-data` | DeepSeek | 4 |
| 6 | Schéma Prisma complet et première migration | `feat/j0-prisma` | Opus | 1 |
| 7 | Auth par lien magique (jetons, sessions, cookie, garde) | `feat/j0-auth` | Opus | 6 |
| 8 | DTO de `libs/contracts` pour auth, monde, nome | `feat/j0-contracts` | Opus (contrat) | 6 |
| 9 | Module `worlds` de l'API : `GET /worlds/:id`, `POST /worlds/:id/join` | `feat/j0-worlds` | Sonnet | 7, 8 |
| 10 | Écrans web minimaux : connexion, choix de région, arrivée dans le monde | `feat/j0-web-onboarding` | Sonnet | 8 |
| 11 | Seed : un monde et son premier règne | `feat/j0-seed` | DeepSeek | 6 |
| 12 | Revue de chaque livraison, test de bout en bout de la validation | — | Opus | tout |

## Décisions d'architecture (J0)

- **pnpm** comme gestionnaire de paquets, Nx en version courante.
- **Tags Nx** et règle `@nx/enforce-module-boundaries` :
  - `type:rules` (`libs/rules`) ne dépend que de `type:data`. Aucune dépendance npm à l'exécution.
  - `type:data` (`libs/data`) ne dépend de rien.
  - `type:contracts` (`libs/contracts`) ne dépend que de `type:data` (identifiants de ressources et de bâtiments).
  - `scope:server` (`apps/api`, `apps/worker`) et `scope:web` (`apps/web`) ne s'importent jamais l'un l'autre.
- **Prisma** vit dans `libs/db` (`scope:server`), partagée par l'API et le worker, jamais importée par le client.
- **Tests** : Vitest pour les libs, `fast-check` (dépendance de dev uniquement) pour le test de propriété d'`advance`.
- **E-mail** : SMTP générique configuré par `.env`. En local, Mailpit dans Docker Compose capte les liens magiques. Le choix d'un fournisseur réel attend une décision (service externe).

## Sessions

### 2026-11-15 — Lancement de J0

- Lecture complète des documents de conception, des CSV et des maquettes (Opus).
- Plan du jalon J0 ci-dessus.
