# RippleMap Client Portal — Architecture

## System Overview

The portal is a Next.js 16 application hosted on Vercel that acts as a unified client-facing interface. It connects five external platforms: ArcGIS Online, Neon (PostgreSQL), Stripe, ClickUp, and AWS S3. All communication with external platforms happens server-side (API routes or server components) — no credentials or tokens are ever exposed to the browser.

```
                        ┌─────────────────────────────┐
                        │      ripplemap.app           │
                        │   Next.js 16 on Vercel       │
                        │                              │
                        │  ┌──────────┐ ┌──────────┐  │
     Browser ◄──────────┤  │ App      │ │ API      │  │
                        │  │ Router   │ │ Routes   │  │
                        │  └──────────┘ └──────────┘  │
                        └───┬──────┬──────────┬────────┘
                            │      │          │
          ┌─────────────────┼──────┼──────────┼──────────────────────┐
          │                 │      │          │                       │
          ▼                 ▼      ▼          ▼                       ▼
   ┌─────────────┐   ┌──────────┐  ┌──────┐  ┌─────────────────┐  ┌────────┐
   │ ArcGIS      │   │ Neon     │  │Stripe│  │    ClickUp      │  │ AWS S3 │
   │ Online      │   │ Postgres │  │      │  │   (+ webhook)   │  │        │
   └─────────────┘   └──────────┘  └──────┘  └─────────────────┘  └────────┘
```

---

## Platform Connections

### 1. Neon (PostgreSQL) — Primary Database
**Purpose**: Stores all application state — users, sessions, ArcGIS tokens, support tickets, onboarding progress.

**Connection**: `@prisma/adapter-pg` + `pg.Pool` using the Neon pooler URL. Prisma 7's WASM engine requires a driver adapter; the pg Pool connects through Neon's PgBouncer layer.

**Key tables**:
| Table | Purpose |
|---|---|
| `User` | Account, role, org name, `arcgisGroupId` |
| `ArcGISAccountLink` | Encrypted access/refresh tokens per user |
| `OnboardingState` | Step progress and completion flag |
| `SupportTicket` | Local mirror of ClickUp tasks |
| `SalesforceLink` | Legacy — to be removed and replaced with Stripe customer ID on `User` |

**Env vars**: `DATABASE_URL`

---

### 2. ArcGIS Online — Maps, FieldMaps, Group Management
The most complex integration. Uses three different token types for different operations.

#### Token Types
| Token | How obtained | Used for |
|---|---|---|
| **App token** (`client_credentials`) | BC app client ID + secret via OAuth2 token endpoint | Querying feature layer submissions (`fieldmaps.ts`) |
| **Admin token** | BC org admin username + password via `generateToken` | Creating groups, adding/removing users from groups |
| **User token** | Client's own ArcGIS account via OAuth2 authorization code flow | Stored per-user; future use for user-scoped operations |

#### Flows

**Client onboarding — ArcGIS OAuth (authorization code)**
```
Client browser
  → GET /api/onboarding/link-arcgis
      builds ArcGIS authorize URL with redirect_uri
  → ArcGIS sign-in page (arcgis.com)
  → Client authorizes app
  → ArcGIS redirects to /api/arcgis/oauth/callback?code=...
      exchanges code for access + refresh tokens
      fetches user info (username, orgId) from ArcGIS
      encrypts tokens with TOKEN_ENCRYPTION_KEY, stores in ArcGISAccountLink
      adds client to their ArcGIS group (admin token)
      advances onboarding state
  → /onboarding/group-join
```

**Per-customer groups**
Each registered client gets their own private ArcGIS Online group created at registration time using the admin token. The group ID is stored on `User.arcgisGroupId`. All map and FieldMaps queries scope to that group — clients only see their own content.

**Maps portal page**
```
GET /api/arcgis/maps
  → reads user.arcgisGroupId from DB
  → listGroupItems(groupId, "Web Map") using admin token
  → returns ArcGIS item metadata to browser
```

**FieldMaps portal page**
```
GET /api/arcgis/fieldmaps
  → reads user.arcgisGroupId from DB
  → getFieldMapsLayers(groupId) using app token
  → for submissions: getRecentSubmissions(serviceUrl) using app token
```

**Env vars**: `ARCGIS_CLIENT_ID`, `ARCGIS_CLIENT_SECRET`, `ARCGIS_OAUTH_REDIRECT_URI`, `ARCGIS_ORG_URL`, `ARCGIS_ADMIN_USERNAME`, `ARCGIS_ADMIN_PASSWORD`

---

### 3. NextAuth v5 — Authentication
**Purpose**: Session management for the RippleMap portal (not ArcGIS auth — those are separate).

**Strategy**: JWT. Credentials provider only (email + bcrypt password). No OAuth social login.

**Split config** (required for Vercel Edge Runtime compatibility):
- `auth.config.ts` — edge-safe, JWT callbacks only, no DB imports. Used by middleware.
- `auth.ts` — full config with Prisma adapter and Credentials provider. Used by API routes and server components.

**Session flow**:
```
Login form → POST /api/auth/callback/credentials
  → authorize() validates email/password against DB
  → JWT issued with: id, role, onboardingCompleted
  → JWT stored in HttpOnly cookie
  → middleware verifies JWT on every request (edge-safe)
  → server components call auth() for full session data
```

**Onboarding gate**: Middleware only checks if the user is logged in. Whether onboarding is complete is checked in the portal layout server component via DB query — not from the JWT — to avoid stale token redirect loops.

**Env vars**: `AUTH_SECRET`, `AUTH_URL`

---

### 4. Stripe — Billing / Invoices
**Purpose**: Display invoice history and manage subscriptions for clients on the `/billing` page.

**Connection**: Server-side only via the Stripe API. Each RippleMap user maps to a Stripe Customer via a `stripeCustomerId` stored on the `User` record (to be added in a future migration).

**Planned flow**:
```
GET /api/billing/invoices
  → fetch Stripe invoices for user's stripeCustomerId
  → returns invoice list to billing page

POST /api/billing/portal
  → create Stripe Customer Portal session
  → redirect client to Stripe-hosted portal for self-service billing
```

**Webhooks**: Stripe will POST to `/api/billing/webhook` for subscription lifecycle events (payment succeeded, subscription cancelled, etc.) to keep local state in sync.

**Status**: Not yet built. Existing Salesforce billing code (`src/lib/salesforce/`, `src/app/api/salesforce/`, `SalesforceLink` DB table) is to be removed when Stripe is implemented.

**Env vars (to add)**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`

---

### 5. ClickUp — Support Tickets (Bidirectional)
**Purpose**: Each org gets its own ClickUp list, created automatically at registration inside a shared folder. Client-submitted support requests create tasks in the org's list. Status changes and comments in ClickUp sync back to the portal via webhook, and clients can reply from the portal, which posts back to ClickUp.

**Per-org list creation (registration time)**:
```
POST /api/auth/register
  → createClientGroup() (ArcGIS, existing)
  → getOrCreateOrgList(orgName, orgId)
      GET  /folder/{CLICKUP_SUPPORT_FOLDER_ID}/list — look for "{orgName} · {orgId prefix}"
      POST /folder/{CLICKUP_SUPPORT_FOLDER_ID}/list — create it if missing
      stores the list ID on Organization.clickupListId
  (best-effort: logged and non-fatal on failure, same as the ArcGIS group step)
```
The org id is embedded in the list name so the lookup can never match a different org with the same display name. If an org has no `clickupListId` (creation failed, or the org predates this feature), ticket creation falls back to the shared `CLICKUP_SUPPORT_LIST_ID` list. BC staff can also set `clickupListId` manually from the admin org page, mirroring the existing `arcgisGroupId` override.

**Outbound (portal → ClickUp)**:
```
Client submits support form
  → POST /api/support/tickets
      creates SupportTicket in Neon DB
      createClickUpTicket() → POST to org's ClickUp list (or the shared fallback list)
      stores returned ClickUp task ID on the ticket record

Client replies on a ticket
  → POST /api/support/tickets/[id]/comments
      createClickUpComment() → POST to the ClickUp task, prefixed with the client's name/email
      stores the reply locally (SupportTicketComment, source=CLIENT)
```

**Inbound (ClickUp → portal via webhook)**:
```
BC team updates task status or posts a comment in ClickUp
  → ClickUp fires POST /api/support/webhook, signed with the webhook secret (HMAC-SHA256 over
    the raw body, sent as the X-Signature header — verified before anything else runs)
  → taskStatusUpdated: maps ClickUp status → portal TicketStatus enum, updates SupportTicket.status
  → taskCommentPosted: syncClickUpComments() re-fetches all comments on the task and upserts them
    keyed on clickupCommentId, so replays and our own outbound replies echoing back never duplicate
  → Client sees the updated status/comment thread on /support/[id]
```

**Env vars**: `CLICKUP_API_TOKEN`, `CLICKUP_SUPPORT_LIST_ID` (shared fallback list), `CLICKUP_SUPPORT_FOLDER_ID` (folder that holds per-org lists), `CLICKUP_WEBHOOK_SECRET`

---

### 6. AWS S3 — File Storage
**Purpose**: Secure file uploads (e.g. attachments on support tickets).

**Connection**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Generates presigned URLs server-side so clients upload directly to S3 without routing files through Vercel.

**Status**: SDK wired in `src/lib/aws/s3.ts`, not yet connected to any feature.

**Env vars**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`

---

## Request Lifecycle

```
Browser request
  │
  ▼
Vercel Edge Network
  │
  ├─ Middleware (Edge Runtime)
  │    └─ Verifies JWT cookie via NextAuth (auth.config.ts, no DB)
  │         ├─ Not logged in + portal route → /login
  │         └─ Logged in + auth route → /dashboard
  │
  ▼
Next.js App Router
  │
  ├─ Server Component
  │    ├─ auth() — full session (auth.ts, Node.js runtime)
  │    ├─ DB queries via Prisma + pg
  │    └─ ArcGIS / Stripe / ClickUp calls as needed
  │
  └─ API Route (Node.js runtime)
       ├─ auth() — verifies session
       └─ External API calls (ArcGIS, Stripe, ClickUp, S3)
```

## Token Security
- ArcGIS user access/refresh tokens are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`) before being stored in Neon. They are never logged or returned to the browser.
- All other API tokens (Salesforce, ClickUp, ArcGIS admin) are server-side env vars only.
