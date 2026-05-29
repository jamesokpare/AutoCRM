# crm-tool

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env` and fill in real values:

```bash
cp apps/web/.env.example apps/web/.env
```

All of the following are **required** — they are validated at startup
(`packages/env/src/server.ts`), and a missing or invalid value will cause the
server to fail to boot, which shows up in the UI as `Sign up failed (status 500)`:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL / Neon connection string |
| `BETTER_AUTH_SECRET` | Must be at least 32 characters (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Base URL of the web app |
| `CORS_ORIGIN` | Allowed auth origin (usually same as `BETTER_AUTH_URL`) |

## Database Setup

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up and `DATABASE_URL` configured (see above).
2. Apply the schema to **the same database the app connects to**:

```bash
pnpm run db:push
```

> [!IMPORTANT]
> If sign up / login fail with `Sign up failed (status 500)`, the most common
> cause is that the schema has not been applied to the database the app is
> pointing at. The server log will show a Prisma `P2021` error
> (`The table "public.user" does not exist`). Run `pnpm run db:push` against
> the correct `DATABASE_URL` to fix it.

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@crm-tool/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
crm-tool/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
