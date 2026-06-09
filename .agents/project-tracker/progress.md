# Progress & Roadmap

## Current Phase

Early plugin marketplace and C++ hook stabilization.

## Completed

- [x] Created base repository structure with plugin marketplace, language template, and generator script.
- [x] Added C++ language hook plugin metadata and hook registrations.
- [x] Implemented C++ post-edit formatting and tidy checks for C/C++ files.
- [x] Implemented C++ stop hook for CMake/`ctest` projects.
- [x] Added SQLite-backed per-turn C++ change state to avoid redundant `ctest` runs.
- [x] Added Node hook-level regression tests for C++ stateful behavior.

## In Progress

- [ ] Align marketplace entry naming/path with the actual `plugins/cpp-lang-hooks` directory if needed.
- [ ] Keep project tracker docs synchronized with plugin and test changes.

## Known Issues & Technical Debt

- No CI pipeline currently runs the Node hook tests automatically.
- No repository-level formatter or lint configuration is present.
- `scripts/__pycache__/` exists in the worktree and is generated Python cache output.
- Old SQLite turn records are not pruned.

## Roadmap

- [ ] Add more language hook plugins using the template generator.
- [ ] Add CI for `node --test`, `node --check`, and Python generator smoke tests.
- [ ] Add pruning or retention policy for hook state if the SQLite file grows.
- [?] Add documentation or validation for plugin marketplace entry consistency.
