# AGENTS.md

## Stacks

Most of these are provided by MCP servers via Context7.

- Node.js v22
- Bun (Package Manager / Test)
- Biome (Linter / Formatter)
- TypeScript
- Nitro
- Discord.js v14
- Zod
- Drizzle ORM
- Railway
- PostgreSQL

## Setup commands

- Install deps: `bun i`
- Start dev server: `bun dev`

## Code style

### TypeScript

- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible

## Notes

- Nitro auto-imports files in the utils directory.
- Please make sure the following is in English.
    - `console.log`
    - `console.error`
    - `console.warn`
- If you find any potential bugs, please fix them accordingly and suggest them.
- To use the latest packages, use `bun add` instead of adding them directly to package.json.
