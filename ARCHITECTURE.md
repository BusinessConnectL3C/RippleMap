# RippleMap Client Portal — Architecture

## System Overview

The portal is a Next.js 16 application hosted on Vercel that acts as a unified client-facing interface. It connects five external platforms: ArcGIS Online, Neon (PostgreSQL), Salesforce, ClickUp, and AWS S3. All communication with external platforms happens server-side (API routes or server components) — no credentials or tokens are ever exposed to the browser.

```
                        ┌─────────────────────────────┐
                        │      ripplemap.app           │
                        │   Next.js 16 on Vercel       │
                        │                              │
                        │  ┌──────────┐ ┌──────────┐  │
     Browser ◄──────────┤  │ App      │ │ API      │  │
                        │  │ Router   │ │ Routes   │  │
                        │  └──────────┘ └──────────┘  │
                        └──────┬──────────────┬────────┘
                               │              │
          ┌────────────────────┼──────────────┼────────────────────┐
          │                    │              │                     │
          ▼                    ▼              ▼                     ▼
   ┌─────────────┐   ┌──────────────┐  ┌──────────┐   ┌─────────────────┐
   │ ArcGIS      │   │ Neon         │  │Salesforce│   │    ClickUp      │
   │ Online      │   │ PostgreSQL   │  │  CRM     │   │   (+ webhook)   │
   └─────────────┘   └──────────────┘  └──────────┘   └─────────────────┘
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
| `SalesforceLink` | Maps RippleMap user → Salesforce Contact/Account |

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

### 4. Salesforce — Billing / Invoices
**Purpose**: Display invoice history to clients on the `/billing` page.

**Connection**: Server-side only. Uses OAuth2 `client_credentials` flow to get an app-level token, then queries a custom `Invoice__c` object via the Salesforce REST API (SOQL).

**Data model assumption**: Each RippleMap user has a corresponding Salesforce Contact, linked via `SalesforceLink.contactId`. Invoices are queried by `Contact__c`.

**Flow**:
```
GET /api/salesforce/invoices
  → getSalesforceToken() (client_credentials, cached 2 hours)
  → SOQL: SELECT ... FROM Invoice__c WHERE Contact__c = '{contactId}'
  → returns invoice records to billing page
```

**Status**: Routes built, env vars not yet configured in Vercel.

**Env vars**: `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_INSTANCE_URL`

---

### 5. ClickUp — Support Tickets (Bidirectional)
**Purpose**: Client-submitted support requests create tasks in the BC ClickUp workspace. Status updates in ClickUp sync back to the portal via webhook.

**Outbound (portal → ClickUp)**:
```
Client submits support form
  → POST /api/support/tickets
      creates SupportTicket in Neon DB
      createClickUpTicket() → POST to ClickUp API
      stores returned ClickUp task ID on the ticket record
```

**Inbound (ClickUp → portal via webhook)**:
```
BC team updates task status in ClickUp
  → ClickUp fires POST /api/support/webhook
      validates x-webhook-secret header
      maps ClickUp status → portal TicketStatus enum
      updates SupportTicket.status in Neon DB
  → Client sees updated status on /support page
```

**Env vars**: `CLICKUP_API_TOKEN`, `CLICKUP_SUPPORT_LIST_ID`, `CLICKUP_WEBHOOK_SECRET`

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
  │    └─ ArcGIS / Salesforce / ClickUp calls as needed
  │
  └─ API Route (Node.js runtime)
       ├─ auth() — verifies session
       └─ External API calls (ArcGIS, Salesforce, ClickUp)
```

## Token Security
- ArcGIS user access/refresh tokens are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`) before being stored in Neon. They are never logged or returned to the browser.
- All other API tokens (Salesforce, ClickUp, ArcGIS admin) are server-side env vars only.
