# Vue 3 Web Frontend

This directory contains the new Vue 3 presentation layer for `cn-math-taxonomy`.

## Stack

- Vue 3 + `<script setup lang="ts">`
- Vite
- TypeScript strict mode
- Vue Router
- Pinia
- Tailwind CSS v4
- Cytoscape.js + dagre + cytoscape-dagre
- qrcode-generator
- Vitest
- Playwright (system Chrome channel)
- ESLint

## Boundaries

This package is presentation-only.

- It reads generated static JSON packages from `public/data` during runtime.
- It does not modify knowledge graph build scripts.
- It does not introduce a Node backend or database.
- The Python graph/question build pipeline remains authoritative.
- The legacy static pages remain available until the replacement is accepted.

## Development

```bash
npm install
npm run dev
```

`npm run dev` first runs `npm run data:build`, which reads the root project's formal `data/*.json` files and generates subject packages in `.generated/data/`. The Vite dev server serves these files at `/data/`.

## Data packages

The generated runtime data is split by subject:

```text
.generated/data/stats.json
.generated/data/subjects/math.json
.generated/data/subjects/math-questions.json
.generated/data/subjects/english.json
.generated/data/subjects/english-questions.json
...
```

- `{subject}.json` contains topics, edges, standards and aliases for graph browsing.
- `{subject}-questions.json` contains questions for diagnosis and is loaded only by the diagnosis flow.
- `stats.json` contains subject counts for the home page.

Development batches, second-pass review files and screenshots are not deployed.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run preview
```

`npm run build` executes:

1. subject data package generation;
2. `vue-tsc --noEmit`;
3. Vite production build;
4. service worker generation with hashed asset precache entries;
5. generated data copying into `dist/data/`.

Playwright uses the locally installed system Chrome through `channel: 'chrome'` and does not require downloading Playwright's bundled Chromium.

## Current Migration Status

Implemented:

- Vue 3/Vite/TypeScript project foundation;
- Vue Router routes, SPA fallback and legacy root hash redirects;
- Pinia subject, graph-data, question, diagnose, children and UI stores;
- typed data loading and runtime JSON validation;
- Tailwind-based responsive layout;
- subject-scoped data packages and separate question packages;
- home page with subject statistics and grade entry;
- knowledge graph browser using Cytoscape + dagre;
- subject, grade, domain, text and ancestor-depth filtering;
- textbook volume/chapter browser;
- topic details, standards and diagnostic sample questions;
- target, multi-target and chapter diagnosis;
- grade/book screen diagnosis through the legacy deterministic engine;
- choice/numeric answering, answer/explanation review, manual fallback and skipping;
- mastery/shaky/weak/untested result summary;
- learning-path graph;
- weak roots and prerequisite path;
- undo, restart, print and JSON export;
- Canvas share poster with QR code;
- demo mode (`/diagnose/?target=cnm_221&demo=1`);
- localStorage session compatibility using the same subject keys;
- child profiles, local history and JSON backup import/export by reusing the audited legacy profile logic;
- PWA manifest, icons and generated service worker;
- hashed asset precache and visited data runtime caching;
- Vitest unit tests and Playwright end-to-end tests;
- production static build in `dist/`.

Not yet replaced or still requiring product review:

- the original 1:1 visual design of every legacy screen;
- complete chapter/section tree parity for every textbook-specific naming case;
- full share-poster pixel parity with the old image;
- finer mobile layouts for long chapter trees and dense result content;
- production deployment switch and Cloudflare Pages project update;
- future backend/PostgreSQL productization.

## Important Paths

```text
src/data/          Static data types, guards, subject registry and data client
src/stores/        Pinia stores
src/engine/        TypeScript adapter around the deterministic legacy engine
src/components/    Vue components and Cytoscape graph wrapper
src/pages/         Routed pages
src/children/      Legacy audited child-profile storage logic
src/share/         Canvas share-card generator
scripts/           Data package, service worker and deployment helpers
e2e/               Playwright tests
```
