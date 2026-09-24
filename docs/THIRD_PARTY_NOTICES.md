# Third-Party Notices

Learnova Suite uses open-source npm packages. The buyer installs them from the npm registry with `npm install`; `node_modules` is not included in the CodeCanyon ZIP.

## Direct Runtime Dependencies

| Package | Purpose | License |
|---|---|---|
| `next` | Next.js application framework | MIT |
| `react` | UI library | MIT |
| `react-dom` | React DOM renderer | MIT |
| `@prisma/client` | Prisma database client | Apache-2.0 |
| `bcryptjs` | Password hashing helper | MIT |
| `clsx` | Class name helper | MIT |
| `ioredis` | Optional Redis client for production cache/queues | MIT |
| `jose` | JWT/JWS/JWE utilities | MIT |
| `lucide-react` | Icon components | ISC |
| `zod` | Runtime schema validation | MIT |

## Development And Build Dependencies

Development dependencies include TypeScript, Prisma CLI, ESLint, Vitest, Playwright, Tailwind CSS, PostCSS, and related type packages. They are installed from npm and are used for local development, testing, linting, and building.

## Buyer Notes

- Keep `package-lock.json` with the package to provide reproducible installs.
- Review dependency licenses again if you add or replace packages.
- Do not redistribute `node_modules`; let buyers install dependencies with npm.

