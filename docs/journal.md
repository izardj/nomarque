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
- Squelette Nx (DeepSeek) accepté. Complété par Opus : lint de pureté de `libs/rules` (`Date`, `Math.random`, `process`, `fetch`, minuteurs interdits), types Node retirés des libs partagées.
- Contrat de `libs/data` et table libellés → identifiants (Opus). Import CSV → TypeScript validé par Zod (DeepSeek) accepté ; Opus a étendu la validation croisée à tous les bâtiments (le temple consomme du pain) et ajouté `check-data` à la CI.
- Schéma Prisma et migration initiale (Opus). Prisma fixé en 7.10.1 : le tag `latest` de npm pointe sur une release candidate 8.0.
- Auth par lien magique (Opus) : jeton et session stockés hachés, consommation atomique du lien, quota par adresse sans révéler son existence, limite par IP, cookie httpOnly SameSite=Lax. 13 tests d'intégration.
- CI GitHub Actions (DeepSeek) acceptée telle quelle.
- Docker Compose et images (DeepSeek) acceptés avec deux corrections d'Opus : nginx retirait le préfixe `/api` (toutes les routes auraient répondu 404), et les ports étaient ouverts sur toutes les interfaces alors que l'API fait confiance à `X-Forwarded-For`.
- Module `worlds` (Sonnet) accepté sans retouche : 16 tests d'intégration, dont deux `join` simultanés.

- Écrans web de connexion, choix du monde et de la région (Sonnet) acceptés sans retouche : 34 tests.
- Seed d'un monde de test (DeepSeek) accepté. Opus a sérialisé les tests qui touchent la base (`api:test`, `db:test` en `parallelism: false`) : ils vidaient les mêmes tables en parallèle en CI.
- Défauts trouvés par Opus au test de bout en bout, corrigés :
  - `pnpm install --frozen-lockfile` échouait en CI (`ERR_PNPM_IGNORED_BUILDS`) : scripts de build de Prisma autorisés dans `pnpm-workspace.yaml` ;
  - l'image de l'API plantait au démarrage (`Cannot find module '@prisma/adapter-pg'`) : les libs sont embarquées dans le bundle mais leurs dépendances npm restent externes, elles doivent être déclarées dans `apps/api/package.json` ;
  - dans Docker, l'API visait un SMTP sur `localhost` et des liens vers le serveur de dev : redirigés vers Mailpit et le front nginx.
- Validation de J0 tenue : parcours complet dans la pile Docker (nginx → API → PostgreSQL → Mailpit), par script et dans Chromium (captures dans `docs/img/j0/`).

#### Décisions

- Le jeton de lien magique porte l'e-mail ; le compte joueur n'est créé qu'à la vérification (pas de comptes fantômes).
- Le front vérifie le lien par un `POST /auth/verify` depuis la page `/login/verify`, et non par un `GET` sur l'API : les antivirus de messagerie qui suivent les liens ne consomment pas le jeton.
- Protection CSRF : cookie SameSite=Lax et API servie sur la même origine que le front (proxy). Pas de CORS.
- `Reign.dataVersion` plutôt que `World.dataVersion` : la spec dit que le monde enregistre la version « avec laquelle le règne a démarré », ce qui est une propriété du règne.
- Prix du marché et des contrats en centièmes de deben (entiers) ; stocks et deben du nome en flottants pour `advance`. À revoir en J3 avec le moteur de marché.
- `Nome.rulesState` (JSON) porte les accumulateurs propres à `libs/rules` (compteurs des besoins, occupation moyenne en Peret, effets actifs), pour ne pas figer leur forme en base avant J1.
- TypeScript 6 : `rootDir` vaut désormais par défaut le dossier du tsconfig ; les apps serveur le fixent à la racine du dépôt.
- `REIGN_YEARS = 4` vit dans `libs/rules` faute de colonne dans `parametres.csv`.
- Rejoindre un monde crée un nome sans parcelle et avec 0 deben : la cité de départ attend les données manquantes (voir questions).

#### Questions ouvertes pour J1 (données d'équilibrage)

1. Zone « Rive » (fosse d'argile, potier) absente de la DA : rattachée provisoirement au fleuve.
2. Capacité des greniers et stockage de base sans grenier : absents.
3. Îlots de maisons : coût, durée de construction et nombre de maisons par parcelle absents (la maquette montre « Huttes ×3 »).
4. Stocks et deben de départ, plan des parcelles (nombre, zones) par région : absents.
5. Haute-Égypte : aucune ressource ne lui est rattachée, et l'effet chiffré d'une région n'est défini nulle part.
6. Rouleaux : il faut des scribes pour en produire, et des maisons de niveau 3 (qui en consomment) pour avoir des scribes. Seuls les greniers royaux (J3) cassent la boucle.
7. Villa : aucun besoin en ressources dans `besoins_maisons.csv` (hors MVP, à compléter plus tard).
