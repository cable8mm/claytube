# ClayTube — TECH_STACK

## 1. Languages / Runtimes / Frameworks / Libraries

- MUST use Node.js 24.x.
- MUST set `engines.node` in `package.json` to 24.x.
- MUST NOT target any other Node.js major version.
- MUST use TypeScript ^6 for all ClayTube source code.
- MUST use ECMAScript Modules.
- MUST set `"type": "module"` in `package.json`.
- MUST use npm as the package manager.
- MUST commit `package-lock.json`.
- MUST use Astro 7.x as the website framework.
- MUST use `yaml` ^2 as the YAML parser.
- MUST use `commander` ^15 as the CLI argument parser.
- MUST call the YouTube Data API v3 REST endpoints using Node.js built-in `fetch`.
- MUST use Vitest ^5 as the test framework.
- MUST use ESLint ^10 for linting.
- MUST use `typescript-eslint` ^8 as the TypeScript ESLint integration.
- MUST use Prettier ^3 for formatting.
- MUST use `@types/node` ^24 for Node.js type definitions.
- MUST use GitHub Actions for CI and release.
- MUST use JSON for synchronized content data.
- MUST use YAML for project configuration.
- MUST declare each dependency above with the caret range on the major version stated.
- MUST resolve exact versions through `package-lock.json`.
- MUST NOT use `latest`, `*`, or unbounded version ranges.

## 2. Framework- or Tool-Mandated Paths and File Names

- MUST name the dependency manifest `package.json`.
- MUST name the lockfile `package-lock.json`.
- MUST name the TypeScript configuration `tsconfig.json`.
- MUST name the Astro configuration file per Astro convention (`astro.config.*`).
- MUST place Astro pages in `src/pages/`.
- MUST place static assets copied without processing in `public/`.
- MUST write the TypeScript compile output (`tsc` `outDir`) to `dist-cli/`.
- MUST write the Astro build output to `dist/`.
- MUST name the project configuration file `claytube.config.yaml`.
- MUST name the local environment file `.env`.
- MUST name the environment example file `.env.example`.
- MUST name the ignore file `.gitignore`.
- MUST expose the executable `claytube` through the `bin` field of `package.json`.

## 3. Coding Conventions

- MUST import Node.js built-in modules with the `node:` prefix.
- MUST use ESM `import` / `export` only.
- MUST NOT use CommonJS (`require`, `module.exports`).
- MUST set `module` to `NodeNext` in `tsconfig.json`.
- MUST set `moduleResolution` to `NodeNext` in `tsconfig.json`.
- MUST write relative import paths with the `.js` extension in TypeScript source.
- MUST use `import type` for type-only imports.
- MUST compile the published CLI with `tsc`.
- MUST NOT use a separate TypeScript runner (`tsx`, `ts-node`) in the published CLI.
- MUST NOT suppress type errors (`@ts-ignore`, `@ts-expect-error`) to pass compilation.
- MUST fail with a non-zero exit code on CLI errors.
- MUST NOT silently ignore errors.
- MUST resolve Astro from the current project's installed dependencies.
- MUST NOT depend on a globally installed Astro executable.
- MUST fail with an explicit error when Astro is not installed.
- MUST read the YouTube API key from `process.env.YOUTUBE_API_KEY`.
- MUST fail with an explicit error when `YOUTUBE_API_KEY` is missing.

## 4. Testing Rules

- MUST run tests with `npm run test`.
- MUST run lint with `npm run lint`.
- MUST run the format check with `npm run format:check`.
- MUST name test files `<implementation>.test.ts`.
- MUST place each test file next to the implementation it tests.
- MUST NOT enforce a coverage threshold in `npm run test` or CI.
- MUST make unit tests deterministic.
- MUST NOT make network requests in unit tests.
- MUST NOT require a real `YOUTUBE_API_KEY` in unit tests.
- MUST separate tests that call the real YouTube API from unit tests.
- MUST NOT include real-network tests in `npm run test`.
- MUST NOT run real-network tests in the CI test step.
- MUST read credentials for real-network tests from environment variables.
- MUST NOT hard-code credentials in any test.
- MUST run the production build in CI.
- MUST fail CI when the build fails.

## 5. Configuration Rules

- MUST store project and site configuration in `claytube.config.yaml`.
- MUST NOT store `YOUTUBE_API_KEY` in `claytube.config.yaml`.
- MUST store local secrets in `.env`.
- MUST list `.env` in `.gitignore`.
- MUST NOT commit `.env`.
- MUST commit `.env.example`.
- MUST NOT put real credentials in `.env.example`.
- MUST use `YOUTUBE_API_KEY` as the only YouTube credential variable name.
- MUST NOT store secrets in JSON data files.
- MUST NOT hard-code secrets in source code.
- MUST encode generated JSON as UTF-8.

## 6. Deployment Rules

- MUST use GitHub Pages as the hosted deployment target.
- MUST use GitHub Actions for the GitHub Pages workflow.
- MUST use Node.js 24.x in every workflow.
- MUST install dependencies with `npm ci`.
- MUST build the Astro website in the Pages workflow.
- MUST upload `dist/` as the Pages artifact.
- MUST deploy the artifact with GitHub Pages deployment actions.
- MUST use GitHub-provided workflow permissions for deployment.
- MUST NOT hard-code credentials in workflows.
- MUST distribute ClayTube as an npm package.
- MUST license the package under MIT.
- MUST include the runtime files required by the CLI in the published package.
- MUST NOT depend on development-only files excluded from the published package.
- MUST version releases with semver.
- MUST name release tags `vX.Y.Z`.
- MUST trigger the release workflow on a pushed `v*.*.*` tag.
- MUST match the tag version to the `version` field in `package.json`.
- MUST run `npm ci`, `npm run lint`, `npm run format:check`, `npm run test`, and the production build before `npm publish`.
- MUST publish to npm from the release workflow using npm Trusted Publishing (OIDC).
- MUST NOT use a long-lived `NPM_TOKEN` for publishing.

## 7. Security Rules

- MUST NOT write `YOUTUBE_API_KEY` to `claytube.config.yaml`.
- MUST NOT write `YOUTUBE_API_KEY` to JSON data files.
- MUST NOT write `YOUTUBE_API_KEY` to `dist/`.
- MUST NOT write `YOUTUBE_API_KEY` to generated HTML, JavaScript, or CSS.
- MUST NOT reference `YOUTUBE_API_KEY` in Astro pages, layouts, or components.
- MUST NOT expose `YOUTUBE_API_KEY` through Astro `PUBLIC_`-prefixed environment variables.
- MUST NOT commit secrets to Git.
- MUST NOT include `.env` in the published npm package.
- MUST NOT hard-code credentials in workflows or tests.
- MUST install dependencies in CI with `npm ci` only.

## 8. Non-Goals (Excluded Technologies and Tools)

- MUST NOT use Node.js major versions other than 24.x.
- MUST NOT use Deno or Bun as a runtime.
- MUST NOT use yarn, pnpm, or Bun as a package manager.
- MUST NOT use JavaScript as the source language.
- MUST NOT use CommonJS.
- MUST NOT use a web framework other than Astro.
- MUST NOT use Astro server adapters or server-side rendering.
- MUST NOT use a database.
- MUST NOT use the `googleapis` client library.
- MUST NOT use a test framework other than Vitest.
- MUST NOT use a CI system other than GitHub Actions.
- MUST NOT use a hosted deployment target other than GitHub Pages.
- MUST NOT use a configuration format other than YAML for project configuration.
- MUST NOT use a YAML parser or CLI parser other than `yaml` and `commander`.
- MUST NOT introduce a new runtime, framework, package manager, test framework, deployment platform, or secret-management mechanism without updating this document.
