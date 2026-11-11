# Felt Integration Plan — RippleMap

_Status: draft for review · 2026-11-11 · Classification: **Internal** (no customer data; references vendor pricing from public pages only)_

## 0. Read this first: what is verified and what isn't

The research environment's network policy blocked `developers.felt.com` and `help.felt.com`. Findings below come from search-indexed excerpts of Felt's own doc pages, **not full-page reads**. Endpoint paths marked † come from third-party API catalogs. Before any code is written, someone should read `https://developers.felt.com/llms-full.txt` (the full doc dump) and close out the open questions in §9.

Everything here about Felt is **policy-level** (public docs and marketing). None of it is contractual until it appears in BC's Felt order form or DPA.

---

## 1. Goals

| Keep | Change |
|---|---|
| Organization → Users model, roles (OWNER/ADMIN/MEMBER/BC_STAFF), invites | Felt becomes the primary map/dashboard platform |
| Home, Maps/Dashboards, Forms/Surveys, Media, Support, Account | Onboarding drops TechSoup and the Esri nonprofit/trial/license steps |
| ArcGIS/Esri support for orgs that still use Survey123 / Field Maps / hosted feature services | ArcGIS becomes **optional per org**, not a registration requirement |
| Portal-side basic form editing (add fields, edit dropdown options) | Forms list covers Felt-backed and Esri-backed forms |

---

## 2. What Felt gives us (relevant capabilities)

**REST API**: `https://felt.com/api/v2`, Bearer token.
- Tokens are **workspace-scoped**: one token reaches every map in BC's workspace.
- No OAuth flow was found. API access requires an Enterprise plan.

| Area | Endpoints / features |
|---|---|
| Projects | `POST /projects` (name, visibility); list / get / update / delete |
| Maps | `POST /maps`, `GET /maps/{id}`, `POST /maps/{id}/update`†, `/duplicate`†, `/move`†, `DELETE` |
| Layers | list / get / delete, `/refresh`, `/update_style` (Felt Style Language), `POST /maps/{id}/upload` (URL import, or file via presigned S3 POST), layer exports (CSV/GeoJSON)† |
| Elements | `GET`/`POST /maps/{id}/elements` (GeoJSON; upsert via `felt:id`), delete |
| Sources | Live data connections (PostgreSQL/PostGIS, **Esri Feature Service**, etc.): create / list / sync / delete |
| Embed tokens | `POST /maps/{id}/embed_token?user_email=…`: short-lived (~15 min) token that lets a portal user view a **private** map with no Felt login |
| Webhooks | One per map, created in the Felt UI only; fires a POST when the map changes. Payload schema and signing not found. |

**JS SDK** (`@feltmaps/js-sdk`):
- Embed with `Felt.embed(container, mapId, { token, uiControls, initialViewport })`, which returns a controller.
- Controller methods: viewport get/set, layer visibility / style / ephemeral filters, `getFeatures`, selection and click events (`onSelectionChange`, `onPointerClick` → features under the cursor), drawing tools and elements, `createLayersFromGeoJson`.
- Requires the **Platform add-on**.

**Field App**: native mobile data collection with offline sync.
- Surveys are built from a layer, with dropdown options on text/number attributes.
- Editing is configured inside Felt.

**Esri interop**: Felt can connect an ArcGIS `/FeatureServer` or `/MapServer` URL as a **read-only live source** that refreshes on a schedule.
- Private services need a long-lived ArcGIS API key.
- Survey123 results are hosted feature services, so they should connect the same way. This is inferred, not documented.

### Hard limitations that shape this plan
1. **The Felt REST API and SDK do not support editing feature data or layer schemas** (per Felt's "Editing layers" help page, undated). The portal can't add a dropdown option to a Felt layer via API today. See §6.
2. **No member, invite or seat API was found.** Seat assignment in Felt is manual (Felt UI).
3. **No static-image or thumbnail export endpoint was found.** See §7.
4. **Plan gating:** REST API, private embeds, SDK and the Esri connector all point to **Enterprise + Platform add-on** (public pricing: ~$1,000/mo yearly). Confirm the 10-seat account includes both.

---

## 3. Tenancy and security model

**One Felt workspace (BC's) → one private Felt project per RippleMap Organization.**

```
BC Felt workspace (10 seats)
├── Project "RippleMap · Acme Food Bank · org_cuid123"   (private)
│   ├── Map: Service Area
│   ├── Map: Volunteer Dashboard
│   └── Map: Intake Survey (Field App survey layer)
└── Project "RippleMap · River Trust · org_cuid456"     (private)
```

- **Mirrors the existing pattern.** It works like the ArcGIS group and ClickUp list per org: created best-effort at registration, ID stored on `Organization.feltProjectId`. Like the ClickUp list name, the project name embeds the org id.
- **The portal is the security boundary.** The workspace token reaches every tenant, so every server route must resolve a Felt map ID through our DB (`FeltMap.orgId === session.orgId`) before it calls Felt or issues an embed token. Map IDs from the browser are never trusted on their own.
  - **This is not optional.** The current ArcGIS routes don't do it: see §8, "Existing defect to fix first".
- **The embed token is the only Felt credential that reaches a browser.**
  - The API token stays server-side, in Vercel env only.
  - Embed tokens are minted per request, after the ownership check, and re-minted before the ~15-minute expiry.
- **Seats** (10 total: Bobby, Rachel, 8 remaining):
  - Each org's **seat holder** is an editor invited only to that org's private project. They edit maps in Felt directly and use the Field App.
  - Every other org user views via portal embeds (no seat, no Felt account).
  - **This caps us at ~8 client orgs with one seat each.** Plan seat expansion pricing now.
  - **Verify:** a workspace "editor" can't see other tenants' *private* projects. If they can, a seat holder could see other clients' maps. That would be a security-boundary failure, and per-tenant projects alone would not be sufficient.

---

## 4. Data model changes (Prisma)

```prisma
model Organization {
  // existing fields …
  feltProjectId  String?
  arcgisEnabled  Boolean   @default(false)   // migration: true where arcgisGroupId IS NOT NULL
  feltMaps       FeltMap[]
}

model User {
  // existing fields …
  feltSeat   Boolean  @default(false)  // BC staff mark the seat holder(s)
  feltEmail  String?                   // Felt account email if different from login email
}

model FeltMap {
  id          String      @id @default(cuid())
  orgId       String
  feltMapId   String      @unique
  title       String
  kind        FeltMapKind @default(MAP)
  thumbnailKey String?                 // S3 key, see §7
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  @@index([orgId])
}

enum FeltMapKind { MAP DASHBOARD SURVEY }
```

`FeltMap` is the authoritative tenant registry. It is populated by:
- maps the portal creates via API (BC staff "New map" / "Duplicate template" in admin);
- BC staff pasting a Felt map URL in the admin org page;
- a "sync from project" job, if Felt's map-listing endpoint supports filtering by project (unverified).

The table is required regardless of syncing, because it carries `kind` and the ownership check.

**New env vars:**
- `FELT_API_TOKEN`: Restricted credential.
- `FELT_WEBHOOK_SECRET`: only if Felt signs webhooks. Unverified.

Update the `CLAUDE.md` env table and the "reset test data" TRUNCATE list.

---

## 5. Feature-by-feature plan

### 5.1 Registration and onboarding
- **Registration:** keep the creation of the org, the OWNER user and the ClickUp list. Replace the ArcGIS group creation with `createOrgProject()` (Felt, best-effort, non-fatal). Create an ArcGIS group only when the org opts into Esri.
- **New steps** (`src/lib/onboarding/steps.ts`), the same for NONPROFIT and CORPORATE:

| # | Step | Completed by |
|---|---|---|
| 1 | **Profile & organization details** | User |
| 2 | **Invite your team** (optional/skippable; existing invite flow) | User |
| 3 | **Map workspace ready**: BC confirms the Felt project exists and assigns a seat holder (Felt invite email goes out from Felt) | BC staff (admin toggle) or auto when `feltProjectId` is set |
| 4 | **Using Esri/ArcGIS too?** Optional "Connect ArcGIS" (existing OAuth flow); sets `arcgisEnabled` | User, skippable |
| 5 | **Explore**: links to the first map, forms and support | User → `api/onboarding/complete` |

- `StepId` loses `techsoup`, `arcgis_apply`, `arcgis_activate`, `arcgis_trial` and `arcgis_purchase`.
- Orgs already marked `completed` are unaffected.
- In-progress orgs get their `completedSteps` remapped by a one-off script.

### 5.2 Home
- Widgets read from `FeltMap` (recent maps, survey count) plus ArcGIS when `arcgisEnabled`.
- Replace `AccountStatusWidget`'s ArcGIS username with "Map workspace: ready / pending", and show the seat holder's name.

### 5.3 Maps & Dashboards
- **List** (`/maps`): `FeltMap` rows for the org, kind MAP/DASHBOARD. ArcGIS items are merged in when `arcgisEnabled`, with a provider badge.
- **View:**
  - New route `/maps/f/[feltMapId]`.
  - The server component checks ownership, then renders `<FeltMapEmbed>`, a client component on the JS SDK. Its token comes from `GET /api/felt/maps/[id]/embed-token`, which checks ownership, calls Felt and returns `{token, expiresAt}`. The component refreshes the token before expiry.
  - Existing ArcGIS routes `/maps/[itemId]` stay, so links keep working.
- **Dashboards:** the docs show no Felt dashboard/app API.
  - Treat a "dashboard" as a Felt map with legend and layer components configured in Felt (kind `DASHBOARD`).
  - Optionally build portal-side KPI tiles from `getFeatures` / layer export later.
  - Confirm with Felt what "Felt Apps/components" exposes to embeds.
- **Data view:** a "View data" table via layer export (CSV/GeoJSON) proxied through an org-scoped route. This mirrors `FeatureLayerTable`.

### 5.4 Forms & Surveys: see §6.

### 5.5 Admin (BC staff)
On the org page:
- Felt project ID (view/set manually, as with `clickupListId`).
- Map registry (add by URL, set kind, remove).
- "Create map from template" (`POST /maps/{templateId}/duplicate` → move into the org's project).
- Seat-holder flag per user.
- `arcgisEnabled` toggle.

### 5.6 Webhooks
- `POST /api/felt/webhook`: treat it as a "map X changed" signal only. Look up the `FeltMap`, then `revalidateTag` for that org's map data.
- **Don't trust the payload contents** until Felt confirms signing. Re-fetch from the API instead.
- Webhooks are created per map in the Felt UI, so this is a nice-to-have, not core.

---

## 6. Forms & Surveys: the decision point

The portal must support "basic edit capabilities (adding options, etc.)". The Felt API can't do that today (limitation #1). Three tiers:

| Form source | List & view | Edit fields / dropdown options from portal | Submissions |
|---|---|---|---|
| **Esri (Survey123 / Field Maps)** | Existing code | **Yes**, existing `FieldEditor` (after the §8 security fix) | Existing table/export |
| **Felt Field App survey layer** | `FeltMap` kind `SURVEY`, embed | **No.** Deep-link "Edit in Felt" for the seat holder. Revisit if Felt ships schema-edit APIs. | Layer export (CSV/GeoJSON) |
| **Esri data shown in Felt** | Esri feature service connected as a Felt live source | Edit on the Esri side (portal), Felt refreshes | Esri |

**Recommendation:**
- **Phase 1:** ship the first two rows. Esri-backed forms keep full portal editing, and Felt-native surveys are edited in Felt.
- **Phase 2 (decide after §9 answers):** if portal-side editing of Felt-native forms is a must-have, the viable path is a **RippleMap-owned form schema**. Form definitions and submissions live in PostGIS, the portal edits options freely, and Felt shows the table as a live PostgreSQL source.
  - Cost: we'd own a form renderer/mobile story, and lose Field App offline capture unless Felt can write to that source.
  - Submissions may contain client/community PII (**Confidential/Restricted**). That means a data-classification review, retention rules, and a read-only DB role for Felt with IP allowlisting.
  - Don't start this before the vendor review in §10.

---

## 7. Serving images

No Felt API for photo attachments, image-in-popup or thumbnails was found. Recommended approach by use case:

| Use case | Approach |
|---|---|
| **Feature photos** (site photos, survey photos) | Store in **S3** (existing `src/lib/aws/s3.ts`, org-scoped prefix as the Media page already does). Store the S3 *key* (not a URL) as a feature attribute (e.g. `photo_key`). In `<FeltMapEmbed>`, listen to `onSelectionChange` / `onPointerClick` → read the attribute → call an org-scoped API route → get a short-lived presigned URL → show the photo in a **portal side panel** next to the map. |
| **Why not put image URLs in Felt popups** | A presigned URL in a Felt attribute expires (1 hr), so popups break. A permanent public URL makes the image world-readable, which is unacceptable for anything above Public classification. The side-panel pattern keeps access control in the portal. |
| **Georeferenced imagery** (drone, aerial, scanned site plans) | Upload to Felt as a raster layer (`POST /maps/{id}/upload`; GeoTIFF, or PNG/JPG with a world file). |
| **Map thumbnails** for the gallery | No API found. BC staff export a PNG from Felt (or the portal renders a placeholder) and upload it to S3 → `FeltMap.thumbnailKey`. Check whether `GET /maps/{id}` returns a thumbnail URL. |
| **Media library** | Keep the S3 Media page as-is. Drop `MediaSource.ARCGIS` unless an org needs it. |
| **Field App camera capture** | Not found in the docs. Ask Felt (§9). If it exists, find out where photos are stored and whether they're exportable. |

---

## 8. Existing defect to fix first (independent of Felt)

**Cross-tenant authorization gap in the ArcGIS routes.**
- **Map viewer:** `src/app/(portal)/maps/[itemId]/page.tsx` fetches any `itemId` with BC's app token and renders it. It never checks that the item belongs to the user's org group.
- **Forms routes:** `src/app/api/arcgis/forms/[surveyId]/route.ts` has the same gap. The POST also **accepts a `serviceUrl` from the request body** and runs `addToDefinition` / `updateDefinition` on it with BC's token.
- **Impact:** a logged-in user from one org who knows or guesses another org's item ID or service URL can view that org's maps and **modify its feature-service schemas**.
- **Fix:**
  - Verify the item is in `org.arcgisGroupId`.
  - Derive `serviceUrl` server-side from the verified item. Never accept it from the client.
  - Audit `/api/arcgis/maps/[itemId]/layers/**` for the same pattern.
- The Felt routes must use the ownership-check pattern from the first commit (§3).

---

## 9. Open questions for Felt (resolve before Phase 1 code)

1. **Plan:** Does our 10-seat account include Enterprise API access **and** the Platform add-on (SDK, authenticated embeds, Esri connector)?
2. **Embed tokens:**
   - What is `user_email` for? Must it be a workspace member (i.e. the org's seat holder)? Can arbitrary portal users view via a token minted with the seat holder's email?
   - Is the token single-use or valid for 15 minutes?
   - Can an embed-token viewer export data? That is a data-exfiltration consideration.
3. **Project isolation:** Can a workspace editor see or open private projects they weren't invited to?
4. **API surface:**
   - Is there an endpoint to list maps by project?
   - Are there member, invite or seat endpoints?
   - Is a feature/attribute/schema edit API on the roadmap?
5. **Webhooks:** What is the payload schema? Is there signing (HMAC) and are there retries?
6. **Field App:** Does it support photo/attachment capture? Where are photos stored?
7. **Esri source:** How are ArcGIS key expiry and rotation handled? Can it connect Survey123 result services?
8. **Viewers:** Is the "portal end users never count as seats or viewers" statement in the order form? It is currently marketing, not contract.

---

## 10. Governance and vendor review (BC policy)

- **Vendor review required:** Felt will hold client geospatial data and possibly survey responses containing community PII. Route it through Tech Ops / AI Taskforce vendor review **before** onboarding a real client org.
- **Felt AI features:** Felt markets AI features. Confirm in the **DPA** whether customer data is used for **training-time** model improvement or only **inference-time** processing, and get an opt-out in contract. A public privacy page is not sufficient for anything above Internal.
- **Credentials:**
  - `FELT_API_TOKEN` and any ArcGIS API keys given to Felt sources are **Restricted** and stay server-side.
  - Any ArcGIS key given to Felt should be scoped read-only, per source.
- **PII:** User emails sent to Felt's embed-token endpoint are PII leaving our system. Minimize: prefer the seat holder's email if Felt permits it (§9.2).
- **Data residency and retention:** Ask Felt where data is hosted and how it is deleted when an org offboards (the project-delete endpoint covers maps; confirm source and backup deletion).

---

## 11. Phased delivery

| Phase | Scope | Depends on |
|---|---|---|
| **0. Verify** | Answer §9; vendor review §10; allow `developers.felt.com` in the Claude Code environment so the full docs can be checked | — |
| **1. Security fix** | §8 ArcGIS ownership checks | — (do now) |
| **2. Foundation** | `src/lib/felt/` (`client.ts` with token, errors and 429 backoff; `projects.ts`; `maps.ts`; `embed.ts`); env vars; Prisma migration (§4); registration creates the project; admin org page: project ID, map registry, seat flag, `arcgisEnabled` | 0 |
| **3. Maps & Dashboards** | Embed-token route, `<FeltMapEmbed>` (SDK), `/maps/f/[id]`, merged gallery, data table via export | 2 |
| **4. Onboarding** | New steps (§5.1), remap in-progress orgs, ArcGIS optional | 2 |
| **5. Home** | Widgets on `FeltMap` + optional ArcGIS | 3 |
| **6. Forms** | Unified list, Felt survey rows, "Edit in Felt" deep links; Esri editor unchanged | 1, 3 |
| **7. Images** | S3 photo side panel on feature select; thumbnails; raster upload from admin | 3 |
| **8. Webhooks** | Change signal → revalidate | 3, §9.5 |
| **9. Phase-2 forms decision** | RippleMap-owned schema via PostGIS (§6), only if required | §9.4 answer, §10 |
| **10. Cleanup** | Salesforce removal (already planned), `MediaSource.ARCGIS`, Esri-only onboarding copy, `CLAUDE.md` update | all |

_Implementation note: per `AGENTS.md`, check `node_modules/next/dist/docs/` for Next.js 16 conventions (route handlers, `revalidateTag`, the `middleware.ts` → `proxy.ts` rename) before writing code._
