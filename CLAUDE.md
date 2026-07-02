@AGENTS.md

# RippleMap Client Portal — Project Status

## What This Is
A Next.js 16 client portal for Business Connect L3C's RippleMap product. Clients register, connect their ArcGIS Online account, and access their maps, FieldMaps forms, support tickets, and billing through a branded portal at **https://ripplemap.app**.

## Stack
- **Framework**: Next.js 16.2.6 (Turbopack, App Router)
- **Auth**: NextAuth v5 (beta.31) — JWT strategy, Credentials provider
- **Database**: Neon (PostgreSQL) via `@prisma/adapter-pg` + Prisma 7.8.0
- **Hosting**: Vercel (production branch: `main`)
- **ArcGIS**: ArcGIS Online OAuth2 + REST API
- **Support tickets**: ClickUp API
- **Billing**: Salesforce API
- **File storage**: AWS S3

## Current State (as of 2026-05-20)

### Working
- Registration (creates RippleMap account + auto-creates a private ArcGIS group for the client)
- Login / JWT session
- Onboarding flow (4 steps: profile → arcgis-connect → group-join → explore)
- ArcGIS OAuth connect (authorization code flow, tokens encrypted and stored)
- Portal layout with onboarding gate (DB-checked, not JWT-checked)
- Vercel production build passing
- Neon DB migrations applied (2 migrations)

### Not Yet Built / Pending
- **Email confirmation on registration** — still no verification-token flow on registration itself. (Org-invite emails, however, now send via Resend — see below.)
- **Admin panel** — no UI for BC staff to manage users, set arcgisGroupId manually if group creation fails, etc.
- **Stripe billing integration** — replacing Salesforce. Existing Salesforce code (`src/lib/salesforce/`, `/api/salesforce/`, `SalesforceLink` table) to be removed. Stripe not yet implemented.
- **ClickUp support ticket integration** — per-org ClickUp lists (created at registration, one per org, with a shared fallback list), plus two-way comment sync (`/support/[id]` thread, webhook-driven inbound sync) are implemented but not yet verified end-to-end against the real BC ClickUp workspace (need to confirm `CLICKUP_SUPPORT_FOLDER_ID`, do a live registration + ticket + webhook round-trip)
- **AWS S3** — dependency in package.json, not yet used in any feature
- **Full onboarding completion** — the "explore" step and `api/onboarding/complete` route exist but haven't been tested through to dashboard

### Known Issues / Watch Points
- ArcGIS group membership (`addUserToGroup`) silently fails for unverified ArcGIS accounts — logged but non-fatal, user can still proceed
- ArcGIS `client_credentials` app token cannot manage groups — group operations use `ARCGIS_ADMIN_USERNAME/PASSWORD` via `generateToken` instead
- `TOKEN_ENCRYPTION_KEY` must be exactly 64 hex characters (`openssl rand -hex 32`) — wrong format causes hard crash on any ArcGIS token operation
- Next.js 16 deprecation warning: `middleware.ts` should eventually be renamed to `proxy.ts` (non-breaking for now)

## Architecture Decisions
- **Per-customer ArcGIS groups**: Each registered client gets their own private ArcGIS Online group created at registration. Group ID stored on `User.arcgisGroupId`. Maps and FieldMaps pages fetch from the user's own group, not a shared one.
- **Per-org ClickUp lists**: Each org gets its own ClickUp list, created at registration inside `CLICKUP_SUPPORT_FOLDER_ID` (best-effort, non-fatal — same pattern as the ArcGIS group). List ID stored on `Organization.clickupListId`; the list name embeds the org id so the "does one already exist" lookup can't match a different org with the same display name. Tickets fall back to the shared `CLICKUP_SUPPORT_LIST_ID` list if an org has none yet. BC staff can set `clickupListId` manually from the admin org page.
- **Prisma driver adapter**: Prisma 7 removed the native binary engine. Using `@prisma/adapter-pg` with `pg.Pool` for Neon compatibility.
- **Split NextAuth config**: `auth.config.ts` is edge-safe (JWT only, no DB imports) for middleware. `auth.ts` has the full config with Prisma adapter for server components and API routes.
- **Onboarding gate in portal layout**: Middleware can't reliably gate on `onboardingCompleted` (stale JWT). The portal layout server component checks the DB directly.

## Required Environment Variables (Vercel Production)
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon pooler connection string |
| `AUTH_SECRET` | Random string, 32+ chars (`openssl rand -base64 32`) |
| `AUTH_URL` | `https://ripplemap.app` |
| `TOKEN_ENCRYPTION_KEY` | 64 hex chars (`openssl rand -hex 32`) |
| `ARCGIS_CLIENT_ID` | ArcGIS app registration (developers.arcgis.com) |
| `ARCGIS_CLIENT_SECRET` | ArcGIS app registration |
| `ARCGIS_OAUTH_REDIRECT_URI` | `https://ripplemap.app/api/arcgis/oauth/callback` |
| `ARCGIS_ORG_URL` | e.g. `https://businessconnect.maps.arcgis.com` |
| `ARCGIS_ADMIN_USERNAME` | BC org admin ArcGIS username (for group management) |
| `ARCGIS_ADMIN_PASSWORD` | BC org admin ArcGIS password |
| `DIRECT_URL` | Neon **non-pooled** connection string. Used only by `prisma.config.ts` for `migrate deploy` — advisory locks used to serialize migrations aren't reliable over the pooled connection. Same credentials as `DATABASE_URL`, host without `-pooler`. |
| `RESEND_API_KEY` | Optional. Powers org-invite emails (`src/lib/email/resend.ts`). If unset, inviting a member falls back to a copyable link instead of sending anything — nothing breaks either way. |
| `RESEND_FROM_EMAIL` | Optional, defaults to `RippleMap <invites@ripplemap.app>`. Requires that sending domain to be verified in Resend or emails won't deliver. |
| `CLICKUP_API_TOKEN` | BC ClickUp workspace API token, used for all ticket/list/comment operations |
| `CLICKUP_SUPPORT_FOLDER_ID` | ClickUp folder that holds one auto-created list per org |
| `CLICKUP_SUPPORT_LIST_ID` | Shared fallback list used when an org has no `clickupListId` yet |
| `CLICKUP_WEBHOOK_SECRET` | Shared secret ClickUp signs webhook payloads with (HMAC-SHA256 over the raw body, sent as `X-Signature`) — this is the `secret` returned when the webhook is created via ClickUp's API, not a value you invent |

## Key File Locations
- Auth config (edge-safe): `src/lib/auth.config.ts`
- Auth config (full): `src/lib/auth.ts`
- Middleware: `src/middleware.ts`
- ArcGIS auth/tokens: `src/lib/arcgis/auth.ts`
- ArcGIS group management: `src/lib/arcgis/groups.ts`
- ClickUp per-org lists: `src/lib/clickup/lists.ts`
- ClickUp tickets/comments: `src/lib/clickup/tickets.ts`
- DB client: `src/lib/db.ts`
- Portal layout (onboarding gate): `src/app/(portal)/layout.tsx`
- Onboarding steps: `src/app/(auth)/onboarding/[step]/steps/`
- API routes: `src/app/api/`

## Database
- Provider: Neon (PostgreSQL)
- Migrations in: `prisma/migrations/`
- Do NOT truncate `_prisma_migrations` — only truncate application tables
- To reset test data: `TRUNCATE "ArcGISAccountLink", "OnboardingState", "SupportTicket", "SupportTicketComment", "SalesforceLink", "User" CASCADE;`
