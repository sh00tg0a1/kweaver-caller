# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a bootstrap for a TypeScript CLI that calls KWeaver. Keep the root clean and move implementation into standard locations as the project grows:

- `src/`: CLI entrypoint, command modules, API client, and shared utilities
- `bin/`: executable shim published to npm, for example `bin/kweaver-caller`
- `test/`: automated tests for commands and API behavior
- `ref/`: reference material only, including OAuth notes and API experiments

Prefer small modules with one responsibility. Put HTTP logic under `src/api/` and command parsing under `src/commands/`.

## Build, Test, and Development Commands
Use `nvm use` first; the repo pins Node in `.nvmrc`. Keep scripts predictable and conventional:

- `npm install`: install dependencies
- `npm run dev`: run the CLI in watch mode with `tsx` or equivalent
- `npm run build`: compile TypeScript to `dist/`
- `npm test`: run the test suite
- `npm run lint`: run linting and formatting checks

If you add scripts, keep names conventional so the CLI is easy to install and use.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and semicolons. Prefer `camelCase` for variables and functions, `PascalCase` for types/classes, and kebab-case for command names and executable files. Keep user-facing CLI commands short and explicit, for example `kweaver login` or `kweaver call`.

Use ESLint and Prettier once configured. Avoid default exports for shared modules.

## Testing Guidelines
Place tests in `test/` or next to source files as `*.test.ts`. Cover command parsing, auth flows, and API error handling first. Mock external requests; do not depend on live KWeaver endpoints in routine tests. Add at least one success case and one failure case for each new command.

## Commit & Pull Request Guidelines
Current history starts with `Initial commit`, so adopt a simple imperative style now: `add login command`, `wire oauth token refresh`, `fix cli exit code`. Keep commits focused.

PRs should include a short summary, testing notes, related issue links, and example terminal output for user-facing CLI changes.

## Security & Configuration Tips
Never commit tokens, `.env` files, or captured credentials. Keep local secrets in environment variables. Treat files in `ref/` as non-production references and sanitize any new API samples before committing.
