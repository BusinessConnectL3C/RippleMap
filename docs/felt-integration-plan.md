# Felt Integration Plan — RippleMap

_Status: draft for review · rev 2, 2026-11-11 · Classification: **Internal** (no customer data; vendor plan details come from Felt's public docs)_

## 0. Sources and confidence

This revision was checked against Felt's full documentation:
- `developers.felt.com/llms-full.txt`: REST API, embedded OpenAPI, JS SDK, FSL.
- `help.felt.com/llms-full.txt`: product, permissions, Field App, security.

Statements below reflect those docs as of today. Two limits on that:
- `felt.com/api/v2/openapi.json` itself was not reachable from this environment. The same OpenAPI fragments are embedded in the developer docs, and those were used instead.
- Everything about Felt here is **policy-level**: public docs and help center. It becomes **contractual** only where it appears in BC's Felt order form or DPA (§10).

Rev 1 corrections:
- Embed tokens last **12 h**, not 15 min.
- `user_email` identifies the viewer. The portal sends a **stable pseudonym** (`u_<hmac>@viewers.ripplemap.app`), not the viewer's real email (Felt support confirmation, §9.3).
- Webhooks **are** signed.
- A map image/thumbnail **export API exists**.
- Felt has a native **Image** field type for photos.
- **Field data capture needs a seat.**

---

## 1. Goals

| Keep | Change |
|---|---|
| Organization → Users model, roles (OWNER/ADMIN/MEMBER/BC_STAFF), invites | Felt becomes the primary map, dashboard and survey platform |
| Home, Maps/Dashboards, Forms/Surveys, Media, Support, Account | Onboarding drops TechSoup and the Esri nonprofit/trial/license steps |
| ArcGIS/Esri for orgs still on Survey123 / Field Maps / hosted feature services | ArcGIS becomes **optional per org** |
| Portal-side basic form editing (add fields, edit dropdown options) | Forms list covers Felt-backed and Esri-backed forms |

---

## 2. Felt capabilities that matter here

### 2.1 Plan gating: BC is on **Business**

**What Business means for RippleMap:**
- **Included:** REST API, webhooks, dashboards (layer components), advanced forms (required / show-if), CSV export, Field App offline.
- **Platform add-on: active** (confirmed 2026-11-11). It provides the JS SDK and private embeds, so client orgs can see private maps in the portal.
- **Limits that shape this plan:**
  - 100k map views/month across all orgs. Every portal embed load counts.
  - 25 GB processing and 100 GB storage per month.
  - Hourly scheduled refresh at fastest.
  - **Only 1 database connection**, which Phase-2 forms would use (§6).
- **Not available on Business:** regional hosting, so data is US-hosted, and custom branding, so embeds show Felt attribution.


| Need | Required plan |
|---|---|
| REST API, webhooks, MCP | **Business or Enterprise** |
| JS SDK + authenticated (private) embeds | **Platform add-on** (any paid plan; first 3 months free) |
| Dashboards (layer components), advanced forms (required fields, show-if) | Business or Enterprise |
| Database connections (e.g. Postgres) | Business: 1, Enterprise: unlimited |
| Data export CSV | Business and up (GeoJSON/GPKG/Shapefile on Team) |

**Monthly limits (Business / Enterprise):**

| | Business | Enterprise |
|---|---|---|
| Map views | 100k | 250k |
| Processing | 25 GB | 100 GB |
| Storage | 100 GB | 400 GB |
| Fastest scheduled refresh | Hourly | 15 min |

**Every embed load counts as a map view.** At the limit, embeds show an over-limit page; Felt doesn't bill overage automatically. The portal should track embed-token mints per org as a usage proxy.

### 2.2 REST API (`https://felt.com/api/v2`)
- **Auth:** a personal access token (`felt_pat_…`). It is workspace-scoped, **acts as the person who created it**, and never expires (rotate manually).
- **Limits:**
  - 300 requests/min **per IP**. All Vercel functions share egress IPs, so back off on `429`.
  - **No pagination:** list endpoints return everything.
- **Errors:** permission failures return **401, not 403**. 403 means a plan or usage limit was hit.

| Area | Endpoints (verified in OpenAPI) |
|---|---|
| Projects | `GET/POST /projects`, `GET /projects/{id}` (**includes references to its maps**, so per-org listing works), `POST /projects/{id}/update`, `DELETE` |
| Maps | `POST /maps`, `GET /maps/{id}` (title, URL, **thumbnail**, timestamps), `/update`, `/duplicate`, `/move`, `DELETE` |
| Images | `POST /maps/{id}/image_exports`: render PNG/JPG/PDF/SVG at a chosen size and view (waits up to 55 s). Print pages/layouts APIs also exist. |
| Layers | list/get/update, `update_style` (FSL), `/upload` (URL or presigned file), `/refresh`, `add_source_layer`, `duplicate_layers` |
| Dashboards | **Layer components**: `GET/POST /maps/{id}/layers/{layer_id}/components`, get/update/delete. Types: statistic, bar chart, histogram, line chart, filter, time series. |
| Export | `get_export_link` (GeoPackage/GeoTIFF), `custom_export` + status poll (`download_url`) |
| Elements | annotations as GeoJSON: list/upsert/delete, element groups |
| Comments | export (CSV/JSON/GeoJSON), resolve, delete |
| Sources | Postgres, S3, BigQuery, etc.: CRUD + credentials + sync |
| Embed tokens | `POST /maps/{id}/embed_token?user_email=…` |
| Users | `GET /user` (current user only) |

**Not available via REST:**
- Workspace members, invites or seats: Felt UI only.
- Webhook management: Felt UI only.
- **Editing features or layer attributes/forms.** Possible only in the Felt app, the Field App, or Felt's MCP server (`edit_features`, `edit_layer_attributes`).

### 2.3 Authenticated embeds and JS SDK
- **Flow:** the server mints a token, then the browser calls `Felt.embed(container, mapId, { token })` (`@feltmaps/js-sdk`). The iframe fallback is `https://felt.com/embed/map/{id}?token=…`.
- **Token properties:**
  - Valid **12 h** and scoped to **one map**.
  - **Not individually revocable.** Cutoff means stop minting, and the token dies within 12 h. Deleting the map ends access.
  - Viewers are **read-only**. Data export is off unless the map setting "Viewer permissions: Export data" is turned on.
- **`user_email`** attributes views; the viewer needs no Felt account. The portal sends a stable pseudonym per user (`viewerPseudonym` in `src/lib/felt/embed.ts`, HMAC of the user id), so **no portal user's real email is sent to Felt** (§9.3, §10).
- **Felt's own guidance:** "the token is the security boundary… give each customer their own map." SDK filters (`setLayerFilters`) change what's displayed, **not what's accessible**. Never use them for tenant isolation.
- **What the SDK gives us:**
  - viewport control and events;
  - selection and click events (`onSelectionChange`, `onPointerClick`) that return features;
  - `getFeatures` and aggregate methods for custom charts;
  - layer visibility and styles;
  - session-only GeoJSON layers;
  - drawing tools;
  - custom UI (action triggers, side panels).
- **Embeds render the map's legend, popups and dashboard components**, and stay live as the map is edited in Felt.

### 2.4 Permissions, seats and isolation (from the help center)
- **Seats:** Admin, Edit and **Contribute** access need a seat; View doesn't.
  - Inviting someone with Contribute/Edit access to a single project or map **takes a seat** even if they aren't a workspace member.
  - **Everyone who captures data in the Field App needs a seat** (Contribute or Edit).
- **Private projects are opaque even to workspace admins:** "Workspace admins can't open private projects or maps they haven't been invited to."
  - So per-org private projects are a real boundary between client seat holders.
- **External collaborators:** invite a client's seat holder **to their project only** (workspace access None). They can't see the member list or other projects.
- **Data sources** inherit to all workspace members up to the source's workspace default (starts at **View**).
  - Any source holding a client's credentials (e.g. an ArcGIS key, a Postgres login) must be set to **workspace default None**.
- **Viewers:** people invited with View access count against the workspace viewer limit. Portal users on embed tokens **don't**.

### 2.5 Forms and Field App (native Felt)
- Forms are defined per layer in "Edit attributes", in the Felt web app:
  - field types: Text, Number, Boolean, Date, **Image**, Person;
  - **single-select dropdowns** (Text/Number);
  - required fields and show-if conditions (Business+);
  - read-only and hidden fields;
  - edit-tracking metadata (created/modified by/at).
- **Field App:** capture points, lines and polygons; fill forms; take photos (≤20 MB each, **not counted** toward storage); offline sync (Business+).
- **No API to change a form.** Adding a dropdown option means using the Felt web app (or MCP).

### 2.6 Images
- **Image attribute:** one or more photos/files per feature, attached on the web or captured in the Field App. It can serve as a **popup header image**.
- **Popups** can also show an image from a text attribute holding a **public** URL, or use **iframe popups** (URL template with `{{column}}`) or custom **HTML popups**.
- **Map images:** `GET /maps/{id}` returns a thumbnail; `POST /maps/{id}/image_exports` renders a fresh PNG/JPG at a chosen view.
- **Annotations** can hold one image each. Comments can carry photos (needs a seat).

### 2.7 Webhooks
- **Setup:** per map, created in the Felt UI (Workspace settings → Developers). Each webhook has **its own signing key**.
- **Signature:** a `felt-signature` header holding the Base64 HMAC-SHA256 of the raw body.
- **Payload:** `{"attributes":{"type":"map:update","map_id","updated_at"}}`. `map:update` is the only type.
- **Delivery:** coalesced, at-least-once, up to 10 attempts. Fires **only on changes made in the Felt app**, not on API/MCP changes or scheduled refreshes.

### 2.8 Esri interop
- Felt connects ArcGIS FeatureServer/MapServer URLs as live sources (a long-lived API key for private services). They don't count as a "data connection".
- **Read-only:** Felt never writes edits back to any source, and editing a live layer in Felt turns its live refresh off.

---

## 3. Tenancy and security model

```
BC Felt workspace
├── Private project "RippleMap · Acme Food Bank · org_cuid123"
│     invited: BC integration account (Edit), Acme seat holder (Edit/Contribute, external collaborator)
│   ├── Map: Service Area            (kind MAP)
│   ├── Map: Volunteer Dashboard     (kind DASHBOARD — layer components)
│   └── Map: Intake Survey           (kind SURVEY — Felt form + Field App)
└── Private project "RippleMap · River Trust · org_cuid456"
```

1. **One private Felt project per Organization.** It is created at registration through the API: best-effort and non-fatal, like the ArcGIS group and ClickUp list. Its name embeds the org id, and the id is stored on `Organization.feltProjectId`.
2. **One or more maps per org, never shared between orgs.** This follows Felt's guidance. New maps are made by `POST /maps/{templateId}/duplicate` and then `/move` into the org's project.
3. **The portal enforces tenancy.** Every server route resolves a Felt map id through `FeltMap` (`orgId === session.orgId`) before it calls Felt or mints a token. A Felt id from the browser is never trusted on its own.
4. **Only embed tokens reach the browser.** `FELT_API_TOKEN` stays server-side. A token is minted per page load, after the ownership check.
5. **Offboarding a user:** remove them from the org, and their tokens stop being minted. Existing tokens can live up to 12 h; document this in the offboarding runbook.
6. **Integration identity:**
   - A PAT acts as its creator, and that person must be invited to every client project.
   - **Recommended:** a dedicated BC integration account (e.g. a shared `ripplemap-integration@` mailbox) holding a seat. Its token survives staff changes.
   - **Cost:** one seat. If seats are too tight, use the Director's PAT, with a documented rotation and handover procedure.
7. **Data sources** created for an org: workspace default **None**, shared only with that org's project.

### Seat budget (10 seats)

| Holder | Seats |
|---|---|
| Bobby, Rachel | 2 |
| Integration account (recommended) | 1 |
| **Available for clients** | **7** (8 without the integration account) |

Every client field collector needs a seat (§2.4). One seat per org therefore means **one Field App user per org**. That is the main commercial constraint: see §6 and the pricing question in §9.

### 3.1 Org / User / Seat model

Two permission systems sit side by side, and they don't sync:

| Layer | Who | Controls | Managed by |
|---|---|---|---|
| **Felt** | The org's **Field Editor**: one named person with a Felt seat | Editing maps, layers, forms and dashboards; Field App capture | BC staff, in the Felt UI (no API) |
| **RippleMap** | Every org user, including the Field Editor | Which org maps each user can **view** in the portal (via embed tokens) | Org OWNER/ADMIN in the portal |

#### The Felt seat is one named person, not a shared login
Felt's Terms of Service, "unless otherwise expressly set forth on an Order Form":
- each seat is "designated for use only by a single, specifically identified natural person";
- it "may not be shared… whether concurrently or otherwise";
- it can be reassigned **only** when that person's engagement ends;
- any other use is a **material breach**.

A shared org login is therefore not allowed under the standard terms. It would also break:
- edit attribution ("Created by" / "Modified by");
- offboarding (a password rotation every time someone leaves);
- SSO and MFA.

**Model:**
- Each org designates **one Field Editor**, an individual using their own email and Felt account.
- That person is invited to the org's private Felt project only, as an external collaborator with workspace access None.
- They are flagged as the Field Editor in RippleMap.
- **Swapping the Field Editor** happens only when that person leaves the org, processed by BC staff. Otherwise it needs Felt's written OK.
- **More collectors** need more seats (one seat each) or the Phase-2 RippleMap forms (§6).

#### Shared field-collection login: not adopted unless Felt authorizes it in writing
A Felt employee told BC informally that the one-person-per-seat rule isn't enforced. That is not a contractual commitment, and the ToS (iv) carve-out requires authorization "expressly… in writing by Felt."

- **The risk is workspace-wide.** A material breach exposes BC's whole Felt agreement, and so every client org, not just the one sharing.
- **If Felt puts it in the order form:**
  - Shared accounts get **Contribute** access only, never Edit.
  - Each survey layer gets a required **Collector** single-select field. It is self-reported, so it is not an authenticated audit trail.
  - The password is rotated, and every device logged in again, whenever a collector leaves.
  - Tech Ops signs off on the shared-credential exception.

**Decision (2026-11-11):** new maps default to **Restricted**.

#### Confirm with Felt before relying on this model (§9)
The terms define an Authorized User as someone "employed or otherwise engaged by **Customer**", and BC is the customer. Client-org staff holding BC seats may need **written authorization in BC's order form**. That covers:
- external client users holding seats;
- reassigning a seat when a client org churns;
- (ideally) a role-based seat ("Acme Field Editor") instead of a named one.

This is a contractual question, not a product setting. Get it in writing before onboarding the first client.

#### Field Editor's Felt access level: Edit on their project, with guardrails
Edit access (needed to change forms, layers and dashboards) also lets the Field Editor:
- invite people, and inviting Contribute/Edit users **consumes BC's seats**;
- change a map's **public link access**, which **bypasses RippleMap permissions entirely**.

Contribute avoids both, but it can't edit forms or dashboards.

**Recommendation:** give **Edit**, with these guardrails:
1. **Client agreement:** the client agreement says the Field Editor may not invite people or change sharing in Felt. Requests go to BC.
2. **Webhook reconciler:** a webhook on each org map. On `map:update`, `GET /maps/{id}` checks access settings, and anything non-private alerts BC staff (and is auto-reverted via `POST /maps/{id}/update`).
3. **Seat audit:** a monthly manual audit of Felt workspace members against `User.feltSeat` (there is no members API).

Orgs that only need field capture can get **Contribute** instead.

#### RippleMap view permissions (portal-side only)
Felt never sees these. The portal simply refuses to mint an embed token.

| RippleMap role | Sees |
|---|---|
| `BC_STAFF` (system admin) | All maps, all orgs. Shown in the admin area, by org, with embed tokens minted under the staff member's own email. Staff accounts live in an internal staff org. They are created only with `npm run staff:create` (database access required), never by registration email or domain, because registration doesn't verify email. |
| `OWNER`, `ADMIN` | All of their org's maps; grant and revoke member access |
| `MEMBER` | Maps whose visibility is **All members**, plus maps explicitly granted to them |

- **New maps default to Restricted** (admins only, least privilege). An admin either switches a map to **All members** or grants specific users.
- **One check enforces it everywhere:** `canViewMap(user, map)` gates the Maps list, the map page, the embed-token route, data/export routes, Home widgets and Forms (SURVEY maps).
- **Revoking access** stops new tokens immediately. An already-open embed can last up to 12 h (§2.3).
- **Data export** is a separate per-grant flag (`canExport`), off by default, because export moves data out of the map.
- **Later, if orgs grow:** named groups ("Field team", "Board") instead of per-user grants. Per-user grants are enough for typical org sizes.

---

## 4. Data model changes (Prisma)

```prisma
model Organization {
  // existing …
  feltProjectId  String?
  arcgisEnabled  Boolean   @default(false)  // migration: true where arcgisGroupId IS NOT NULL
  feltMaps       FeltMap[]
}

model User {
  // existing …
  feltSeat        Boolean   @default(false)  // Field Editor: holds a named Felt seat (assigned manually in Felt by BC staff)
  feltAccess      FeltAccess?                // Edit or Contribute on the org's Felt project, as set in Felt
  feltEmail       String?                    // Felt account email if different from login email
  feltSeatSince   DateTime?                  // audit trail for seat reassignment (§3.1)
  mapGrants       FeltMapGrant[]
}

model FeltMap {
  id                 String        @id @default(cuid())
  orgId              String
  feltMapId          String        @unique
  title              String
  kind               FeltMapKind   @default(MAP)
  visibility         MapVisibility @default(RESTRICTED)
  thumbnailKey       String?       // S3 key of cached image export
  webhookSecretEnc   String?       // per-map webhook signing key, encrypted with lib/encryption
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  organization Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  grants       FeltMapGrant[]
  @@index([orgId])
}

model FeltMapGrant {
  id          String   @id @default(cuid())
  feltMapId   String   // FK to FeltMap.id
  userId      String
  canExport   Boolean  @default(false)
  grantedById String?
  createdAt   DateTime @default(now())
  map  FeltMap @relation(fields: [feltMapId], references: [id], onDelete: Cascade)
  user User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([feltMapId, userId])
}

enum FeltMapKind   { MAP DASHBOARD SURVEY }
enum MapVisibility { RESTRICTED ALL_MEMBERS }   // OWNER/ADMIN always see every org map
enum FeltAccess    { EDIT CONTRIBUTE }
```

A grant must only reference a user and a map in the **same org**. Enforce this in the grant API, because Prisma can't express the constraint.

**How `FeltMap` is populated:**
- Admin "Create from template".
- Admin "Add existing map by URL". The server verifies the map is in the org's project via `GET /projects/{id}`.
- A "Sync from project" action that reads `GET /projects/{feltProjectId}`'s map references.
- `kind` is set by staff.

**Env vars:**
- `FELT_API_TOKEN`: Restricted.
- `FELT_TEMPLATE_MAP_ID`: optional.
- No global webhook secret: Felt issues one key per webhook.
- Update the `CLAUDE.md` env table and the test-data TRUNCATE list.

---

## 5. Feature plan

### 5.1 Registration and onboarding
**Registration:** keep the org, OWNER and ClickUp list steps. Add `createOrgProject()` (Felt, best-effort). Create the ArcGIS group only when the org enables Esri.

**New steps** (`src/lib/onboarding/steps.ts`), the same for NONPROFIT and CORPORATE:

| # | Step | Completed by |
|---|---|---|
| 1 | **Profile & organization** | User |
| 2 | **Invite your team** (optional, existing invite flow) | User |
| 3 | **Map workspace ready**: BC confirms the Felt project and creates the first map from the template | Auto when `feltProjectId` is set and the org has ≥1 `FeltMap`, or a BC staff toggle |
| 4 | **Field editor seat** (optional): BC invites the org's designated editor to the Felt project (manual; no API). The editor accepts Felt's email invite. | BC staff toggle |
| 5 | **Using Esri/ArcGIS too?** Optional existing OAuth connect; sets `arcgisEnabled` | User, skippable |
| 6 | **Explore** → `api/onboarding/complete` | User |

- **Removed `StepId`s:** `techsoup`, `arcgis_apply`, `arcgis_activate`, `arcgis_trial`, `arcgis_purchase`.
- Completed orgs are unaffected. In-progress orgs get their steps remapped by a one-off script.

**As built (2026-11-11):** three user steps, all self-serve: **Invite your team → Do you also use ArcGIS? → Explore**.
- The profile step was dropped: registration already collects the name, org and org type.
- "Map workspace ready" and "Field Editor" are shown as **status on the onboarding page and Home, not as blocking steps**. Blocking would lock a new org out of Support and Account until BC staff act.
- The ArcGIS group is created when an owner/admin connects ArcGIS or BC staff enable it, not at registration.
- No remap script was needed: legacy step ids are ignored, so in-progress orgs simply see the new three steps.

### 5.2 Home
- Recent maps and dashboards, survey count, and a "last updated" time (from `GET /maps/{id}` or webhook).
- Thumbnails from S3 (§7).
- ArcGIS widgets only when `arcgisEnabled`.
- `AccountStatusWidget`: "Map workspace ready/pending" and the seat holder's name.

### 5.3 Maps and Dashboards
- **List** (`/maps`): `FeltMap` rows (MAP + DASHBOARD) with S3 thumbnails, plus ArcGIS items when `arcgisEnabled` (provider badge).
- **View:** `/maps/f/[feltMapId]`.
  1. The server component checks ownership.
  2. It renders `<FeltMapEmbed>`, a client component using `@feltmaps/js-sdk`.
  3. The component fetches `{token, expiresAt}` from `POST /api/felt/maps/[id]/embed-token`, which checks ownership, mints the token with the viewer's pseudonym, and logs the mint for usage tracking.
  - Existing `/maps/[itemId]` ArcGIS routes stay.
- **Dashboards are native:** a Felt map with layer components (statistic, bar, histogram, filter, time series), which render inside the embed.
  - Built once on the template map, so duplicates carry them.
  - They can be adjusted per org through the Layer Components API from the admin UI later.
  - Custom portal charts are possible with the SDK `getFeatures` / aggregate methods if ever needed.
- **Data view:** a "View data" table via `custom_export` (GeoJSON/CSV) through an org-scoped route. It mirrors `FeatureLayerTable` and the Excel export (`exceljs` already present).

### 5.4 Admin (BC staff)
On the org page:
- Felt project id (view/set).
- Map registry: create from template, add by URL, sync from project, set kind, remove.
- Per-map webhook signing key (paste once, stored encrypted).
- Field Editor flag per user (`feltSeat`, `feltAccess`), with a reassignment log.
- `arcgisEnabled` toggle.
- "Refresh thumbnail" action.
- Alerts from the sharing reconciler (§3.1).

### 5.4a Org admin (OWNER/ADMIN, Account → Map access)
- A per-map visibility toggle: **Restricted** / **All members**.
- Grant or revoke access to specific members, with an optional **Can export** flag.
- A per-member view of which maps they can see.
- The Field Editor is shown read-only. Changing it is a request to BC (support ticket).

### 5.5 Webhooks
`POST /api/felt/webhook`:
1. Read the raw body.
2. Look up `FeltMap` by `attributes.map_id`.
3. Verify `felt-signature` with that map's key (timing-safe).
4. `revalidateTag` that org's map data, bump `updatedAt`, and optionally queue a thumbnail refresh.

Make the handler idempotent, since Felt delivers at least once. Only UI edits fire webhooks, so code that changes maps via the API must revalidate on its own.

---

## 6. Forms and Surveys

**The constraint:** Felt forms are capable (dropdowns, required, show-if, photos, offline), but **there is no API to edit them**, and **every Field App collector needs a seat**.

| Form source | List / view in portal | Edit fields and dropdown options | Who can submit |
|---|---|---|---|
| **Esri** (Survey123 / Field Maps) | Existing | **In portal**, via the existing `FieldEditor` (after the §8 fix) | Esri licensing, as today |
| **Felt survey layer** (kind `SURVEY`) | Embedded map + dashboard components + data table | **In Felt**: an "Edit form in Felt" deep link for the seat holder. There is no portal API path. | Seat holders only (Field App / web) |
| **RippleMap form → Felt** (optional Phase 2) | Portal form builder + submission list | **In portal**: we own the schema | **Any portal user, no seat** |

**Recommendation:**
- **Phase 1:** rows 1 and 2.
- **Phase 2, decided after the seat-pricing answer (§9):** build row 3 if orgs need more submitters than they have seats, or need portal-side option editing for Felt-displayed data.
  - **Storage:** form definitions and submissions live in Postgres (Neon, PostGIS).
  - **Display:** Felt shows each org's submission table as a **Postgres source layer**. Use Business's **single** database connection: one Neon database for all orgs with a read-only role and Felt's IPs allowlisted. The source's workspace default is None, and it is **one view or table per org**, never a shared table filtered in Felt.
  - **Refresh:** on Business, submissions appear after the scheduled refresh, which is **hourly** at fastest. An on-demand `POST /layers/{id}/refresh` after each submit is faster but costs processing each time. Each refresh counts the full table against processing.
  - **Trade-offs:** no Field App offline capture for this path; Felt can't edit those rows.
  - **Governance:** submissions may hold community PII, so this needs classification, retention and DPA review first.
- **Rejected:** driving Felt's MCP server (`edit_layer_attributes`) from the portal backend to edit Felt forms programmatically.
  - MCP is an **agentic AI interface**, not an application API, and BC policy requires AI Taskforce and Tech Ops review before any agentic feature is used for BC work.
  - Revisit only if Felt adds REST endpoints for layer schema.

---

## 7. Serving images

Felt can serve images natively. Choose by sensitivity:

| Use case | Approach |
|---|---|
| **Field and site photos (Felt-native)** | Add an **Image** attribute to the survey layer. Photos are captured in the Field App or attached on the web, stored by Felt (not counted toward storage), and shown as the **popup header image** inside the authenticated embed. Access follows the map, so only token holders and invited users see them. **No portal code needed.** |
| **Photo gallery in the portal** (grid outside the map) | Read features via SDK `getFeatures` or a layer export, and render the Image attribute values. **Verify first:** the docs don't specify how Image values appear in exports or the SDK (URL form, auth, lifetime). Export a test layer to GeoJSON and inspect it before building this. |
| **Map thumbnails** | `GET /maps/{id}` `thumbnail`, or `POST /maps/{id}/image_exports` for a branded view. Cache the PNG in **S3** (`FeltMap.thumbnailKey`) and serve via presigned URL. Regenerate on webhook or admin action, never on page load (55 s render). |
| **Report and print images** | Print pages API: export a designed page as PDF/PNG for org reports. |
| **Images that live in BC's S3** (Media library, pre-existing photo sets) | Keep the existing Media page. To show them in a Felt popup: Public-classified images can use a public URL attribute. Anything else should use the **SDK side panel**: on `onSelectionChange`, call an org-scoped API route for a short-lived presigned URL and show it beside the map. Don't use non-expiring capability URLs for Internal-or-higher images, and don't use iframe popups pointing at authenticated portal pages (third-party cookies inside felt.com's iframe aren't reliable). |
| **Georeferenced imagery** (drone, aerial, site plans) | Upload as a raster layer (`/upload`; GeoTIFF/COG preferred, since COGs stream without counting toward processing). |

---

## 8. Existing defect to fix first (independent of Felt)

**Cross-tenant authorization gap in the ArcGIS routes.**
- **Map viewer:** `src/app/(portal)/maps/[itemId]/page.tsx` fetches and renders any ArcGIS `itemId` with BC's app token, with no check that the item is in the user's org group.
- **Forms routes:** `src/app/api/arcgis/forms/[surveyId]/route.ts` has the same gap. Its POST also **trusts a `serviceUrl` from the request body** and calls `addToDefinition` / `updateDefinition` on it with BC's token.
- **Impact:** any logged-in user can view another org's maps and **modify another org's feature-service schemas** if they know or guess the id or URL.
- **Fix:**
  - Verify that the item is in `org.arcgisGroupId`.
  - Derive `serviceUrl` server-side from the verified item.
  - Audit `/api/arcgis/maps/[itemId]/layers/**` and `/api/arcgis/fieldmaps` for the same pattern.
- The Felt routes reuse one `assertOrgOwnsFeltMap()` helper from the first commit.

---

## 9. Open questions for Felt sales and support

1. **Platform add-on:** active. What will it cost after the 3 free months? Budget for it.
2. **Seats:** What does each additional seat cost, and are there Contribute-only seat tiers? Field collectors need seats, so this sets per-org pricing.
   - **Order-form terms (contractual):** written authorization for client-org staff (not BC employees) to hold BC seats as Authorized Users.
   - Reassigning a seat when a client org churns, or when its Field Editor changes.
   - Ideally, role-based seats per org. The standard ToS forbids seat sharing and limits reassignment (§3.1).
3. **`user_email` alternatives — answered by Felt support (email, Nov 2026):**
   - A stable pseudonymous address works. Felt accepts any well-formed email on a real domain, creates no account for it, and needs nothing confirmed. **Implemented.**
   - Portal viewers using embed tokens **don't count toward Felt seats or viewer limits**. Each map load still counts as one map view against the workspace pool.
   - Felt keeps the `user_email` value in internal logs and product analytics when a token is minted.
   - Seat holders (anyone editing, contributing or commenting) need their own Felt account; embeds are view-only.
   - The API key's user must have access to every map embedded.
   - **Status: policy-level.** This is a support email, not a contract term. Get the seat/viewer position (and seats for client-org staff, §9.2) written into the order form or DPA before relying on it commercially.
4. **Image attribute values:** What do they look like in GeoJSON export and SDK `getFeatures`? Are they signed, expiring or public URLs?
5. **Roadmap:** Are REST endpoints planned for layer schema/form editing and feature edits?
6. **Map views:** Is the monthly view allowance pooled across the workspace? What do usage packs cost?
7. **Map-view headroom:** At 100k views/month, what do usage packs cost? (Custom branding and regional hosting are Enterprise-only.)

---

## 10. Governance and vendor review (BC policy)

- **Vendor review required before the first real client.** Felt will hold client geospatial data, field photos and potentially community PII, so it needs Tech Ops review.
  - Request the **DPA** and the **SOC 2 Type 2 report** (support@felt.com).
- **AI: policy vs contract.**
  - Felt's help center states Felt AI runs on Amazon Bedrock and that processed data "is never used to train models". That is **inference-time** processing by policy, which is a **unilateral, changeable statement**.
  - Require the no-training commitment (and sub-processor list) **in the DPA**.
  - Felt AI and the **MCP server are agentic features**: AI Taskforce and Tech Ops review before BC staff or the portal use them. Consider asking Felt whether Felt AI can be disabled for the workspace.
- **PII:**
  - Embed-token mints send a pseudonym, not the viewer's email (§9.3). Felt logs it; it can be linked back to a user only with RippleMap's `AUTH_SECRET`. Rotating `AUTH_SECRET` changes every pseudonym (Felt's per-viewer counts restart).
  - Field photos may capture people; treat survey layers as Confidential by default.
- **Credentials:**
  - `FELT_API_TOKEN` is **Restricted**, server-side only, and has no expiry. Set a rotation schedule.
  - Per-map webhook keys are stored encrypted.
  - ArcGIS keys and Postgres logins given to Felt sources should be read-only and per org, with the source's workspace default set to None.
- **Residency and offboarding:**
  - Data is US-hosted. Business has no regional hosting option.
  - On org offboarding, `DELETE /projects/{id}` deletes its maps. Separately, delete the org's sources and confirm with Felt how backups are retained.

---

## 11. Phased delivery

| Phase | Scope | Depends on |
|---|---|---|
| **0. Confirm** | Seat pricing and order-form seat terms (§9.2), DPA/SOC 2, Tech Ops vendor review (Business + Platform confirmed) | — |
| **1. Security fix** | §8 ArcGIS ownership checks | — (do now) |
| **2. Foundation** | `src/lib/felt/` (`client.ts`: auth, error envelope, 429 backoff; `projects.ts`; `maps.ts`; `embed.ts`; `images.ts`); Prisma migration (§4); registration creates the project; template map; admin org page (§5.4) | 0 |
| **3. Maps & Dashboards** | Embed-token route, `<FeltMapEmbed>`, `/maps/f/[id]`, merged gallery, data table and export | 2 |
| **4. Onboarding** | New steps (§5.1), remap script, ArcGIS optional | 2 |
| **5. Images** | Thumbnail cache (image exports → S3); Image-attribute popups on the template survey layer; verify export format (§9.4) before the portal gallery | 3 |
| **6. Forms** | Unified list (Felt SURVEY + Esri), "Edit form in Felt" deep links, survey data table; Esri editor unchanged | 1, 3 |
| **7. Home** | Widgets on `FeltMap` + optional ArcGIS | 3, 5 |
| **8. Webhooks** | Signed per-map webhooks → revalidate and thumbnail refresh | 3 |
| **9. Phase-2 forms** | RippleMap-owned forms via Postgres source (§6), if seat economics require it | §9.2, §10 |
| **10. Cleanup** | Salesforce removal (already planned), `MediaSource.ARCGIS`, Esri-only onboarding copy, `CLAUDE.md` | all |

_Implementation note: per `AGENTS.md`, check `node_modules/next/dist/docs/` for Next.js 16 conventions (route handlers, raw request bodies for webhook HMAC, `revalidateTag`, the `middleware.ts` → `proxy.ts` rename) before writing code._
