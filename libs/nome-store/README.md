# nome-store

Server-side persistence of a nome, shared by `apps/api` and `apps/worker`.

- `NomesRepository` loads and saves a nome (lock, state, history of cards).
- `advanceNomeTo` advances a nome to a game-hour instant and persists it.
- `findWorld` and `findCurrentReign` are the queries both apps start from.

## Building

Run `nx build nome-store` to build the library.
