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

## Plan — J1 · Cité solo

Validation : le test de propriété d'`advance` est vert.

| # | Tâche | Branche | Modèle | Dépend de |
| --- | --- | --- | --- | --- |
| 1 | Données provisoires (paramètres, carte et stocks de départ) et contrat de `libs/data` | `feat/j1-data-contract` | Opus | — |
| 2 | Import des nouvelles données (carte, stocks, paramètres, céréales) | `feat/j1-import-data` | DeepSeek | 1 |
| 3 | Calendrier du Nil : `phaseAt`, `nextBoundary` | `feat/j1-rules` | Opus | 1 |
| 4 | État du nome, main-d'œuvre, constructions, maisons, actions pures (`build`, `assignWorkers`), cité de départ | `feat/j1-rules` | Opus | 3 |
| 5 | `advance` et son test de propriété | `feat/j1-rules` | Opus | 4 |
| 6 | DTO du nome, du rapport et des actions (`libs/contracts`) | `feat/j1-contracts` | Opus | 4 |
| 7 | API du nome : pipeline d'action (verrou, `advance`, validation, écriture, `ActionLog`), `GET /nomes/me`, construire, affecter, cité de départ au `join` | `feat/j1-nome-api` | Sonnet | 5, 6 |
| 8 | Écrans Rapport, Cité, Ouvriers et barre d'onglets | `feat/j1-web-city` | Sonnet | 6 |
| 9 | Textes français et tests unitaires complémentaires | `chore/j1-i18n` | DeepSeek | 8 |
| 10 | Revue de chaque livraison, test de bout en bout, captures | — | Opus | tout |

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

### 2026-11-17 — J1 · Cité solo

- La PR de J0 reste ouverte ; J1 se construit sur `milestone/j1`, branchée sur `milestone/j0`.
- Les questions ouvertes de J0 n'ont pas reçu de réponse. Opus a pris des valeurs provisoires, rangées dans les CSV et marquées « Provisoire J1 » (voir décisions).
- Contrat de données étendu (Opus) : carte de départ, stocks de départ, paramètres de la cité, drapeau « céréale ».
- `libs/rules` (Opus) : calendrier du Nil, main-d'œuvre, flux de ressources, `advance`, actions pures (`foundNome`, `build`, `assignWorkers`), prévisions (`forecast`). 40 tests, dont le test de propriété `advance(a→c) = advance(b→c) ∘ advance(a→b)`, vert sur 8 séries de 300 tirages.
  - Premier contre-exemple trouvé par le test : un stock au-dessus de la capacité qui baisse était ramené à la capacité au mauvais moment. Corrigé : l'arrondi aux bornes suit le sens de variation.

- Import des nouvelles données (DeepSeek) accepté sans retouche : 36 tests, `check-data` vert.
- API du nome (Sonnet) acceptée sans retouche : pipeline unique (verrou `FOR UPDATE`, `advance`, validation par `libs/rules`, écriture, `ActionLog`), cité de départ au `join`, horloge injectable. 46 tests d'intégration ; le test de concurrence échoue bien sans le verrou.
- Écrans Rapport, Cité, Ouvriers (Sonnet) acceptés sans retouche : 94 tests.
- Test de bout en bout par Opus dans la pile Docker et Chromium (captures dans `docs/img/j1/`) : connexion, fondation du nome, construction d'un champ d'orge (40 deben débités, chantier « prêt dans 52 min » à la vitesse 7), prévision de récolte, rapport après 42 h d'absence (24 blés consommés, 3 deben d'impôts, les mêmes chiffres que le test unitaire).
- Validation de J1 tenue : test de propriété vert. 220 tests au total, lint et build verts sur les 8 projets.
- Aucune escalade.

#### Décisions

- **`advance` exact plutôt que par pas de 6 h.** Entre deux instants fixes du jeu, tous les débits sont constants. Quand un stock touche zéro ou sa capacité, l'intervalle est recoupé à cet instant. Le découpage ne dépend donc ni des connexions ni de la grille, et le test de propriété tient à 1e-6 près. La grille de 6 h ne sert plus qu'à juger les maisons.
- **Pénurie** : un stock vide partage son flux entrant entre ses consommateurs au prorata de leur demande (ateliers, temple, maisons). Un atelier ou un service s'arrête en proportion de son entrée la plus rare ; une maison prend ce qu'elle peut de chaque besoin.
- **Stockage** : capacité par ressource = stockage de base + capacité d'un grenier × occupation de chaque grenier. L'excédent est perdu en continu et noté dans le rapport.
- **Maisons** : jugées aux points de la grille (toutes les 6 h) sur la case écoulée. Une parcelle livrée en cours de case n'est jugée qu'à partir de la case suivante.
  - Montée : besoins du niveau couverts, services du niveau suivant à portée, et chaque ressource du niveau suivant en stock, pendant 24 h. Interprétation de « tous les besoins couverts » qui évite qu'une maison monte puis redescende aussitôt.
  - Descente : un besoin manquant pendant 24 h donne un avertissement, pendant 48 h une descente. Jamais sous le niveau 1. Villa exclue (hors MVP).
- **Services** : actifs dès qu'un ouvrier y travaille. Le temple doit en plus avoir reçu tout son pain sur la case. Portée = distance de Chebyshev sur la grille ≤ `portee_parcelles` (remplacée en J2, voir plus bas).
- **Champs** : pendant Akhet, ils ne demandent pas d'ouvriers. Récolte à 120 h = sortie annuelle × occupation moyenne pendant Peret × multiplicateur de crue. Tribut à 166 h : 10 % des céréales (blé, orge) récoltées dans l'année, plafonné au stock.
- **Impôts** : continus, par habitant, sans condition de besoins.
- **Main-d'œuvre** : ouvriers disponibles d'une classe = ⌊habitants × taux d'activité⌋. Un îlot de maisons ne fournit que la classe de son niveau.
- Constantes de la spec gardées dans `libs/rules/src/lib/calendar.ts` (phases 48/120, récolte 120, tribut 166, grille 6 h, seuils 24/48 h), comme `REIGN_YEARS`.
- **Valeurs provisoires** (`parametres.csv`, `carte_depart.csv`, `stocks_depart.csv`) :
  - stockage de base 200 par ressource, grenier +400 ;
  - 3 maisons par îlot, 30 deben, 4 h de construction, sur Ville, Terre noire ou Désert ;
  - 300 deben et 150 blés au départ ;
  - carte 4 × 4 (une ligne par zone), cité de départ du GDD : 3 huttes, 1 puits, 1 grenier, 1 champ de blé ;
  - même carte pour toutes les régions : l'effet des régions attend J3.
- **Routes** : la spec écrit `/nomes/me`, mais un joueur peut avoir un nome par monde. Les routes du nome vivent donc sous `/worlds/:id/nome/…`.
- **Rapport de l'intendant** : accumulé dans `Nome.pendingReport` depuis le dernier « C'est noté » (`POST …/report/ack`).

### 2026-11-18 — J2 · Cycle du Nil

- PR de J0 et J1 toujours ouvertes ; J2 se construit sur `milestone/j2`, branchée sur `milestone/j1`.
- Réponses du joueur au rapport de J1 : valeurs provisoires non testées (gardées), portée « le mieux possible » avec une carte plus grande, régions sans avis, rouleaux selon la recommandation d'Opus, pas de fournisseur d'e-mail pour l'instant.

#### Décisions

- **Carte 5 × 4 = 20 parcelles**, le maximum du GDD (« 12 à 20 parcelles »). La cité simulée de `batiments.csv` (`nombre_simu`) compte 28 bâtiments et 7 îlots : elle ne tient pas sur la carte, ce qui garde la tension « une maison sur la terre noire n'est plus un champ ».
- **Portée en pas orthogonaux** : une portée de 1 couvre la parcelle et ses quatre voisines (« sa parcelle et les parcelles voisines » du GDD), sans les diagonales. Le temple (portée 2) couvre un losange de 13 parcelles au lieu de toute la carte.
- **Rouleaux** : 20 rouleaux au départ (`stocks_depart.csv`) amorcent la boucle scribes ↔ maisons de niveau 3 avant les greniers royaux de J3.
- **E-mail** : le mailer de dev (lien dans les journaux de l'API) reste le seul transport.
- **Régions** : toujours sans effet ; Opus proposera des valeurs chiffrées au début de J3.
- **Cartes d'événement** (Opus, `libs/rules/src/lib/cards.ts`) :
  - tirées dans `advance` à instants fixes (toutes les 8 h de jeu), avec un générateur initialisé par l'id du nome et le numéro du tirage : le tirage ne dépend pas des connexions, le test de propriété le couvre ;
  - une carte au plus une fois par année du Nil, 3 en attente au maximum ; poids 3 pour une carte à déclencheur d'état, 1 pour « Aléatoire », 0,2 pour « Rare » ;
  - choix par défaut appliqué à l'expiration (24 h), coûts plafonnés à ce que le nome possède ; un choix du joueur dont les coûts certains dépassent les stocks est refusé (`cannot_afford`) ;
  - « Tutoriel » (C01) et « Prix du pain » (C28) ne sont jamais tirés en J2 : ils attendent le tutoriel (J4) et le marché (J3) ;
  - « Paysans occupés à 100 % depuis 48 h » : tous les paysans disponibles affectés, mesuré sur la grille de 6 h ;
  - « une maison : montée bloquée » s'applique à tous les îlots ; « grenier inaccessible » ne réduit pas la capacité (le stockage est passif) ;
  - « production −N % pendant H h » se lit comme une baisse des ouvriers de toutes les classes : un atelier à l'arrêt ne consomme pas ses entrées ;
  - C17 « dieu du temple −10 » (aucun dieu du temple parmi les cinq) devient « tous les dieux −2 » dans `cartes.csv`.
- **Dieux** (Opus, `gods.ts`) : jauge de 0 à 100, départ 50, baisse continue de 0,1/h (compensée par un temple actif, +0,1/h à chaque dieu), une offrande par 24 h (+10, coût dans `dieux.csv`). Bénédictions à 70 : Hâpy adoucit la crue basse (0,8 au lieu de 0,6), Osiris +10 % de récolte (−10 % s'il est négligé, sous 30), Bastet fait monter les maisons en 18 h au lieu de 24. Hâpy négligé : la crue haute perd son bonus. Thot et Sekhmet n'agissent que par leurs cartes en J2 (contrats en J3).
- **Faveur royale** : +0,2 par unité de tribut payée, −0,5 par unité manquante ; seuil « élevée » à 50.
- **Cultures** : un champ peut changer de céréale pendant Akhet, gratuitement ; verrouillé à l'heure 48.
- **Fin de règne** : trois classements figés (richesse = deben + stocks au prix de référence, piété = somme des faveurs, faveur royale), ex æquo au même rang, prestige 10/6/3 puis 1 de participation. Table `ReignRanking`.
- Toutes ces valeurs sont « Provisoire J2 » dans `parametres.csv` et `dieux.csv`.
- Import des cartes et des dieux (DeepSeek) accepté sans retouche : grammaire des effets et des déclencheurs, 115 tests.
- API du nome J2 (Sonnet) acceptée ; Opus a corrigé le contrat (`ReignDto` déclaré deux fois, renommé `NomeReignDto`) et ajouté `drawnAt` aux cartes appliquées par défaut. 56 tests.
- Écrans Cartes, Dieux (avec le panneau du Nil), choix des cultures, ajouts au rapport, bandeau de fin de règne (Sonnet) acceptés ; Opus a corrigé une donnée de test et le contraste des boutons désactivés (opacité remplacée par des couleurs, 7:1). 195 tests.
- Worker (Sonnet) accepté : file BullMQ `reign` (`reign.start`, `nile.phase`, `reign.end`), réconciliation au démarrage, traitements idempotents. La sauvegarde d'un nome est extraite dans `libs/nome-store`, partagée par l'API et le worker. 14 tests.
- Tirage des crues (Opus) : `drawFloods(reignId)` dans `libs/rules`, 25 % basse, 20 % haute (provisoire). Le worker avait gardé quatre crues bonnes en attendant.
- Aucune escalade.

#### Décisions (suite)

- Ids des jobs BullMQ séparés par `_` (BullMQ refuse `:`).
- Funérailles : `FUNERALS_HOURS = 24` dans le worker, dérivé de la fin de la dernière année.
- Fin de règne : le joueur n'a plus de nome dans le règne suivant tant qu'il ne l'a pas rejoint. L'écran de résultats du règne terminé (classements, prestige) arrive avec les classements (J4) ; d'ici là le joueur retombe sur « rejoindre un monde ».
- Rattrapage : après un long arrêt, le worker enchaîne les règnes en retard d'un monde (vu sur le monde de test des tests `db`, 80 règnes de 4 jours depuis janvier). Comportement voulu, à surveiller en bêta.
- Les tests de l'API, du worker et de `db` partagent la base de dev.

#### Validation de J2

- Simulation d'un règne complet (`nx run reign-sim:simulate`) : 4 joueurs robots via l'API HTTP, API et worker réels, monde accéléré (règne de 10 minutes, vitesse 4032). 1 269 requêtes, 0 erreur HTTP, 0 erreur dans les journaux de l'API et du worker. 185 cartes tranchées, 101 offrandes, 33 constructions, 29 changements de culture. Le worker a clos le règne : nomes avancés à l'heure 672, 12 lignes de classement, prestige versé, crues révélées, règne suivant créé.
- La spec demande un règne en 4 jours à la vitesse 7 : la simulation accélérée prouve le même parcours ; le règne réel de 4 jours reste à lancer sur un serveur.
- Suite complète : test, lint et build verts sur les 10 projets.
- Captures à 390 px dans `docs/img/j2/` (rapport, carte, dieux, champ).
