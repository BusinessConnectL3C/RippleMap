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
- Registration creates the RippleMap account and org, then emails a verification link (`src/lib/verification.ts`; 24 h, single use, only a hash stored). The org's ClickUp list and private Felt project are created only when the owner verifies (`src/lib/provisioning.ts`, from `GET /api/auth/verify-email`). Unverified users are held on `/verify-email`. If `RESEND_API_KEY` is unset, verification is skipped and the org is provisioned at registration. Invite acceptance counts as verified; pre-existing users were backfilled as verified. No ArcGIS group (opt-in).
- Login / JWT session
- Onboarding flow (3 user steps, same for all org types: invite team → "also use ArcGIS?" → explore; `src/lib/onboarding/steps.ts`). BC-side setup (first map, Field Editor) is shown as status and never blocks the user. Not yet tested end to end.
- ArcGIS OAuth connect (authorization code flow, tokens encrypted and stored)
- Portal layout with onboarding gate (DB-checked, not JWT-checked)
- Vercel production build passing
- Neon DB migrations applied (2 migrations)

### Not Yet Built / Pending
- **Admin panel** — no UI for BC staff to manage users, set arcgisGroupId manually if group creation fails, etc.
- **Billing (manual, live):** `OrgBilling` holds each org's plan, status, price, cycle, dates, Felt seats and billing contact. BC staff edit it in admin (org page → Billing; overview at `/admin/billing`); org OWNER/ADMIN see it read-only at `/billing`. Never store card or bank account numbers there (BC policy). BC staff accounts don't see the portal Billing/Support pages (redirected to admin).
- **Stripe billing integration** — replacing Salesforce. Existing Salesforce code (`src/lib/salesforce/`, `/api/salesforce/`, `SalesforceLink` table) to be removed. Stripe not yet implemented.
- **ClickUp support ticket integration** — per-org ClickUp lists (created at registration, one per org, with a shared fallback list), plus two-way comment sync (`/support/[id]` thread, webhook-driven inbound sync) are implemented but not yet verified end-to-end against the real BC ClickUp workspace (need to confirm `CLICKUP_SUPPORT_FOLDER_ID`, do a live registration + ticket + webhook round-trip)

### Known Issues / Watch Points
- ArcGIS group membership (`addUserToGroup`) silently fails for unverified ArcGIS accounts — logged but non-fatal, user can still proceed
- ArcGIS `client_credentials` app token cannot manage groups — group operations use `ARCGIS_ADMIN_USERNAME/PASSWORD` via `generateToken` instead
- `TOKEN_ENCRYPTION_KEY` must be exactly 64 hex characters (`openssl rand -hex 32`) — wrong format causes hard crash on any ArcGIS token operation
- ArcGIS map/dashboard embeds (`/maps/[itemId]`) use the signed-in user's **own** linked ArcGIS token (`getUserToken`), because the token is visible in the iframe URL. Never send `getBCAppToken()`/`getAdminToken()` output to the browser: those reach every client org. Users who haven't linked ArcGIS see a connect prompt; users whose ArcGIS account isn't in the org's group can't load the map.
- Next.js 16 deprecation warning: `middleware.ts` should eventually be renamed to `proxy.ts` (non-breaking for now)

## Architecture Decisions
- **Felt is the default map platform; ArcGIS is opt-in per org** (`Organization.arcgisEnabled`). An org opts in when an owner/admin connects ArcGIS (onboarding or Account) or BC staff toggle it in admin; that is when its private ArcGIS group is created (`src/lib/arcgis/enable.ts`). Group ID is stored on `Organization.arcgisGroupId`.
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
| `RESEND_API_KEY` | Powers verification and org-invite emails (`src/lib/email/resend.ts`). **Required in production**: without it, registration skips email verification. If unset, invites fall back to a copyable link. |
| `RESEND_FROM_EMAIL` | Optional, defaults to `RippleMap <invites@ripplemap.app>`. Requires that sending domain to be verified in Resend or emails won't deliver. |
| `CLICKUP_API_TOKEN` | BC ClickUp workspace API token, used for all ticket/list/comment operations |
| `CLICKUP_SUPPORT_FOLDER_ID` | ClickUp folder that holds one auto-created list per org |
| `CLICKUP_SUPPORT_LIST_ID` | Shared fallback list used when an org has no `clickupListId` yet |
| `FELT_API_TOKEN` | Felt personal access token (`felt_pat_…`) from Workspace Settings → Developers. Workspace-scoped, acts as the account that created it, never expires — **Restricted**, server-side only. That account must be invited to every client org's private Felt project. If unset, Felt features are skipped (registration still works). |
| `NEXT_PUBLIC_ADOBE_FONTS_KIT_ID` | Optional. Adobe Fonts web project (kit) ID for the brand body font, Neue Haas Grotesk Display Pro (CSS family `neue-haas-grotesk-display`). Loaded at runtime from use.typekit.net (Adobe's licence doesn't allow bundling). Unset: body falls back to bundled Hanken Grotesk. Fonts in `src/app/layout.tsx` / `src/styles/tokens/typography.css`. |
| `RIPPLEMAP_SYSTEM_BUCKET` | Optional. Separate S3 bucket for RippleMap's own files (map thumbnails, in-flight uploads). Defaults to `AWS_S3_BUCKET`. Needs the same CORS rule (PUT from https://ripplemap.app). If you switch it, existing thumbnails stay in the old bucket: refresh them from admin. |
| `FELT_SEAT_LIMIT` | Optional, default 10. Purchased Felt seats, for the admin seat counter (Felt has no members API; counts come from `User.feltSeat`). |
| `FELT_TEMPLATE_MAP_ID` | Optional. Felt map (id or URL) that admin "New map from template" duplicates into an org's project. Keep the template itself private. |
| `CONTACT_NOTIFY_EMAIL` | BC inbox that receives website contact form messages (reply-to is the sender). Unset: messages are still saved and listed in Admin → Contacts, but nobody is emailed. Needs `RESEND_API_KEY`. |
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
- Onboarding: steps in `src/lib/onboarding/steps.ts`, page `src/app/(auth)/onboarding/page.tsx`, `POST /api/onboarding/step`
- API routes: `src/app/api/`
- RM Staff (system admin; enum value `BC_STAFF`, shown as "RM Staff" everywhere in the UI): the first account via `npm run staff:create -- --email <email> --name "<name>"` (`scripts/create-bc-staff.mjs`, needs `DATABASE_URL`). After that, RM Staff can grant or remove it on the admin org page (role dropdown), **only for people in RippleMap's own org** (an org that already has an RM Staff account), never on themselves, never removing the last one; changes log `staff_role_change`. Never grantable via registration or Account. Admin pages and admin APIs check the role in the database (`requireStaffViewer`), so grants and removals take effect on the next page load. The middleware only checks that someone is signed in for `/admin` (the JWT's role is set at sign-in and would be stale). Staff accounts can't be deleted until the role is removed.
- Felt (maps): `src/lib/felt/` — `client.ts` (API + 429 backoff), `projects.ts` (per-org private project), `maps.ts` (map helpers; Felt's API defaults `public_access` to `view_only`, so new and private maps are explicitly locked down, and Public is set only via `makeMapPublic`), `embed.ts` (embed tokens), `access.ts` (**the portal's view-permission system** — `getViewableMap`/`listVisibleMaps`; every Felt route must use it). Plan: `docs/felt-integration-plan.md`.
- Felt map viewer: `/maps/f/[feltMapId]` → `src/components/maps/MapWorkspace.tsx` (header actions + map + Add data as a side panel beside the map, over it below `lg`) → `src/components/maps/FeltMapEmbed.tsx` (JS SDK); Field Editors (`User.feltSeat`) also get an "Open in Felt" link in the header (others have no Felt account that can open a private map), token from `POST /api/felt/maps/[feltMapId]/embed-token` (permission-checked; logs `felt_embed_token` per org as a map-view usage signal). Org admins manage access in Account → Map Access (`/api/account/maps/[id]`, `/grants`).
- Printing: `src/lib/felt/print.ts` + `/api/felt/maps/[feltMapId]/print` (GET options, POST print; `maxDuration` 120), Print button in the map header → `PrintDialog`. Anyone who can view a map can print it (BC decision). Layouts = Felt built-ins + workspace layouts named `RippleMap …` + workspace layouts BC staff assigned to the org (`OrgPrintLayout`, admin org page → Print Layouts, which also sets the org's default layout, preselected in the dialog). Other saved layouts are hidden (the Felt workspace is shared by all client orgs). The picker shows wireframes like Felt's: Felt has no layout images, so `getLayoutPreviews` makes a temporary page from the layout, reads its item frames (map, locator, legend, text, image, section), deletes the page and caches them in `PrintLayoutPreview` per layout + orientation, rebuilt when the layout's `contents` change; drawn by `src/components/maps/LayoutWireframe.tsx`. A layout print creates a temporary page on the map (`RippleMap portal print (temporary)`, optionally framed to the viewer's current bounds and showing only the layers the viewer has turned on, via the page's map items' `layer_ids`), exports it (Felt waits ≤55 s) and deletes it; pages designed on the map in Felt are exported as-is. Each print logs `felt_print` (org, map, user). Felt's print API takes no filters, so a print with legend/viewer filters active (the SDK's `combined` filters per layer, sent by the dialog) is made from a **temporary copy** of the map (`exportFilteredCopy`): duplicated into the same private project and locked down, titled `TEMP_PRINT_MAP_TITLE` (`src/lib/felt/maps.ts`), layers matched to the originals, filters saved into the copy's layer styles, printed, then deleted. Up to ~2 min; route `maxDuration` 300. Sync never registers these copies and deletes any older than 15 min. Hidden legend categories may not carry over; the dialog says so. Unfiltered prints skip the copy. The dialog's **Title on the print** (default: map title) replaces `{{ map.title }}` in the layout's text items on every layout print (so a filtered print never shows the copy's temporary title), and **File name** (default: the title) becomes the print page's name, which Felt uses for the download. Both are stripped of Liquid syntax. To offer a branded layout: design a page in Felt's print editor (text can use `{{ map.title }}`, `{{ map.description }}`, `{{ date }}`), Save as layout, name it starting with "RippleMap".
- Felt map thumbnails: `src/lib/felt/thumbnails.ts` renders via Felt `image_exports` (up to ~55 s), stores JPGs in `AWS_S3_BUCKET` under `ripplemap-system/felt-thumbnails/{orgId}/`, key on `FeltMap.thumbnailKey`. Generated in `after()` when a map is registered/created/synced; admin Felt Maps card has a per-map refresh button. Framing: Felt's saved default view unless an org owner/admin or staff pressed "Use this view as thumbnail" in the viewer (`POST /api/felt/maps/[feltMapId]/thumbnail`), which saves `FeltMap.thumbnailView` for all later refreshes. Served only via `GET /api/felt/maps/[feltMapId]/thumbnail` (permission check → 302 to a presigned URL).
- Felt map sync & public maps: `src/lib/felt/sync.ts` (`syncOrgMaps`, throttled `autoSyncOrgMaps`). Runs when staff press Sync, when an org owner/admin presses "Check for new maps" (refresh icon on Account → Map Access) (`POST /api/account/maps/sync`), and automatically (≤ every 5 min per org) when an owner/admin opens Maps & Apps or Account. Felt has no webhook for new maps. Visibility `PUBLIC` = Felt public link on (viewer export still off), set by org owner/admin or staff via `setMapVisibility`. Maps found public in Felt stay public and get `madePublicInFelt` (review flag: Keep public / Make private); sync never flips public maps back.
- Felt seats & invites: Felt has no members/invite API. Admin org page → Felt Seats shows workspace and org seat counts (`src/lib/felt/seats.ts`) and, per Field Editor, the exact invite steps to do in Felt plus Invite pending/accepted (`User.feltInviteAcceptedAt`).
- Creating orgs by hand: Admin → Organizations → New organization (`/admin/organizations/new`, `POST /api/admin/organizations`, RM Staff only). Name, type, optional Owner email (sends an OWNER invite; link shown to copy if email isn't configured), Felt project: create a new private one (default), connect an existing one (`validateExistingProject` in `src/lib/felt/projects.ts`: id or Felt link, must be reachable with the portal's token, private, and not connected to another org; checked before the org is created), or not now; optional ClickUp list. Resources are created immediately (no email verification for staff-created orgs). Orgs without a project can also connect an existing one from the org's Felt Maps card (`POST /api/admin/organizations/[id]/felt-project` with `{ existingProject }`). Logs `org_created_by_staff`.
- Admin org page (`/admin/organizations/[id]`): header (logo, type, owner status) and tabs kept in `?tab=` (`AdminOrgTabs`): **Overview** (status summary linking to tabs, onboarding), **People** (users + `AdminInvitePanel`: RM Staff invite anyone incl. an Owner via `POST /api/admin/organizations/[id]/invites`, revoke via `DELETE …/invites/[inviteId]`; orgs without an Owner are flagged), **Maps** (Felt maps, print layouts), **Billing**, **Settings** (logo, details & integrations, danger zone). Org names in the admin list link to it.
- Org logos: `src/lib/org-logo.ts`, `Organization.logoKey`. PNG/JPG/WebP ≤2 MB (no SVG), size-locked presigned PUT to `SYSTEM_BUCKET` under `ripplemap-system/org-logos/{orgId}/`, then `POST /api/orgs/[id]/logo/complete`; old file deleted on replace. Served only via `GET /api/orgs/[id]/logo` (org members + RM Staff → 302 signed URL with the image content type). Managed by the org's owners/admins (Account → Organization) and RM Staff (admin Settings tab); shown under the RippleMap header in the portal sidebar.
- BC staff act as owners of their own org (edit name, invite and manage members in Account); BC staff accounts themselves can't be changed or removed from the UI.
- Map templates: `src/lib/felt/templates.ts`. BC staff tick "Offer to clients as a template" on maps in a BC-internal org (admin Felt Maps card; client-org maps are refused). Org owners/admins pick one at `/maps/new` (`POST /api/maps/from-template`): it's duplicated into their project, private and Restricted, capped at 25 maps per org. Template previews: `GET /api/felt/templates/[id]/thumbnail`.
- Plans & Add data: `src/lib/plans.ts` maps billing status to a tier (no record/FREE/CANCELED → free, TRIAL → trial, ACTIVE/PAST_DUE → paid) with upload limits (free 10 MB/3 per map, trial 50 MB/10, paid 5 GB/unlimited). `src/lib/felt/uploads.ts`: owners/admins add data from the map page. Files are PUT from the browser to `AWS_S3_BUCKET` under `ripplemap-system/uploads/` with a size-locked presigned URL, Felt imports them from a signed link (`/maps/{id}/upload` with `import_url`), and the S3 copy is deleted when Felt finishes. Links go straight to Felt. Each upload is a `MapUpload` row (audit, incl. the no-sensitive-data confirmation). **Replace data**: layers created by a portal file upload get a permanent source address (`/api/felt/sources/{sourceToken}/{file}`, a 256-bit token, answering only for 30 min after an import/replacement starts, then 404) because Felt's refresh re-fetches a layer's original import URL and can't change it. Replacing uploads a new file, points that address at it, and calls Felt `layers/{id}/refresh` (all rows replaced; styling/components kept); completion is detected via the layer's `last_refreshed_at`. Link layers get "Refresh from link". Only layers created via the portal (`MapUpload.mode = NEW`) are replaceable; Felt-built/field-collection layers never are. Layers uploaded before this existed can't be replaced (re-upload them). **Add records** (`src/lib/felt/records.ts`, Add data → Add records): Felt's API can't add a single feature, so the portal exports the layer's current data from Felt as GeoJSON (`custom_export`, kept edits made in Felt), appends the typed records (location typed or picked by clicking the map, via `rm:pick-location` window events to `FeltMapEmbed`), writes it back in the origin's format (CSV or GeoJSON) and refreshes the layer through its source address. Point layers from portal CSV/GeoJSON uploads only; ≤50 records per save, ≤60 saves/map/hour, exports ≤25 MB; `MapUpload.mode = APPEND`, not counted toward plan upload limits. Edits made in Felt during the ~1 min save can be lost. **The bucket needs a CORS rule allowing PUT from https://ripplemap.app**, plus ideally a lifecycle rule expiring `ripplemap-system/uploads/` after a few days to clear abandoned uploads.
- S3 & Media isolation: org Media pages are scoped by `src/lib/aws/media.ts` (`getOrgMediaScope`), which fails closed: prefixes always end in `/`, an org in the shared bucket must have a non-empty prefix, and nothing may reach `ripplemap-system/` (also filtered out of every listing in `src/lib/aws/s3.ts`). Staff set Media bucket/prefix on the admin org page. System files use `SYSTEM_BUCKET`.
- Support triage: tickets are tagged in ClickUp with `plan: free` / `plan: trial` / `plan: paid` + `priority support` (retried untagged if ClickUp rejects tags); admin Support Tickets shows a plan badge.
- Website & contact form: landing page `src/app/page.tsx` (sections in `src/components/marketing/`; no unverified impact figures), contact form at `/#contact` and `/contact` → `POST /api/contact` (`src/lib/contact.ts`: zod, honeypot + min fill time, 3/hour per email and 60/hour site-wide). Submissions are **customer PII**: stored in `ContactSubmission`, staff-only at `/admin/contacts` (status, delete), emailed to `CONTACT_NOTIFY_EMAIL`, and deleted after 24 months (`CONTACT_RETENTION_MONTHS`, purged on each submission and admin page view). User text is HTML-escaped in the email.
- ArcGIS tenant check: `src/lib/arcgis/access.ts` (`getOrgItem`). Every route that touches an ArcGIS item with BC's tokens must use it or `getAuthorizedLayer`.

## Database
- Provider: Neon (PostgreSQL)
- Migrations in: `prisma/migrations/`
- Do NOT truncate `_prisma_migrations` — only truncate application tables
- To reset test data: `TRUNCATE "ArcGISAccountLink", "OnboardingState", "SupportTicket", "SupportTicketComment", "FeltMapGrant", "FeltMap", "OrgBilling", "EmailVerificationToken", "User" CASCADE;` (this does not delete the orgs' Felt projects or maps in Felt)
