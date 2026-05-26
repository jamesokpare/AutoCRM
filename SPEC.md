# Automotive Service CRM — Build Spec (v1, no-realtime phase)

> Implementation spec derived from `CRM_PRD.md.pdf` (PRD v1.0). This document scopes the
> **first build phase**: everything that ships on the current stack **without** browser
> realtime push or external messaging delivery. PRD requirement IDs (e.g. `CLT-01`) are
> referenced for traceability.

---

## 1. Scope of this phase

### In scope
- **Auth & RBAC** — self-registration, first-login profile, role-based edit permissions, admin user management.
- **Client / Vehicle / Order / Part** — full data model and CRUD.
- **Shared client dashboard** — list + detail, filters, summary strip. Data loads on navigation and on window-focus refetch; **no live socket push**.
- **Customer feedback** — internal logging + aggregation (no public link yet).
- **Employee workspace** — profiles, KPIs, bottlenecks, weekly tasks.
- **Task assignment & team board** — assign to anyone, list + Kanban, completion stats.
- **Peer performance reviews** — scores per cycle, profile aggregates.
- **Company KPI board** — manual targets, manual + derivable actuals.
- **AI apology drafting** — Claude-generated drafts, human-approved, **draft saved (not sent)**.
- **Audit log** — who changed what, when (written by a shared mutation wrapper).
- **Reminder & notification *records* + pull-based centre** — create reminders, compute "due
  today / overdue / upcoming" on page load. No background scheduler, no auto-send.

### Deferred to the realtime + messaging phase
| Deferred item | PRD refs | Why deferred |
|---|---|---|
| Live push to dashboard / task board | DASH-*, ACC-02 | Needs a socket provider (Supabase Realtime / Pusher / Ably) |
| Push (instant) in-app notifications | ACC-05, REM-08 | Needs socket transport; pull-based centre ships now instead |
| Scheduled send engine (daily 6PM WAT, monthly) | REM-01, REM-02, REM-05 | Needs Inngest cron + durable retries |
| Outbound SMS / WhatsApp / Email delivery | REM-03, AI-04 send step | Needs Resend / Twilio integration |
| Public customer feedback link | FB-02 | Optional in PRD; pairs with messaging phase |

> **Design rule for this phase:** every mutation routes through a single wrapper that writes
> the row, appends an `ActivityLog` entry, and calls a **no-op `emitDomainEvent()` seam**.
> When the realtime phase lands, that seam becomes the publish call — no rewrite of business
> logic.

---

## 2. Architecture

- **Monorepo:** Turborepo + pnpm (existing). `apps/web`, `packages/{ui,auth,db,env,config}`.
- **App:** Next.js 16 (App Router), React 19 + React Compiler, Tailwind v4, shadcn/ui via `@crm-tool/ui`.
- **Data access:** **Server Actions** for mutations; **Route Handlers** for auth callbacks and
  the (later) webhooks/cron. No tRPC/ORPC.
- **Client data fetching:** TanStack Query (to be added to `apps/web`) — `refetchOnWindowFocus`
  + `refetchOnReconnect`, no aggressive interval. `@tanstack/react-form` (already installed) for forms.
- **DB:** Prisma 7 on Neon Postgres (existing `PrismaNeon` adapter — unchanged this phase).
- **Auth:** Better-Auth (email+password), extended with profile fields + `admin` plugin.
- **AI:** Anthropic Claude SDK, server-side only.
- **Deploy:** Vercel.

### New dependencies this phase
| Package | Where | Purpose |
|---|---|---|
| `@tanstack/react-query` (+ devtools) | `apps/web` | Client cache, focus-refetch |
| `@anthropic-ai/sdk` | `apps/web` (server) | Apology drafting |
| shadcn primitives: `dialog`, `table`, `sheet`, `popover`, `select`, `badge`, `tabs`, `avatar`, `textarea`, `tooltip` | `packages/ui` | Dashboard, forms, board |

---

## 3. Data model (Prisma)

Lives in `packages/db/prisma/schema/`. Better-Auth tables (`user`, `session`, `account`,
`verification`) stay in `auth.prisma`; domain models below go in `schema.prisma`. The `user`
model is **extended** (not replaced) with profile fields.

### Enums
```prisma
enum Role            { ADMIN MANAGER SERVICE_ADVISOR TECHNICIAN PARTS_STAFF }
enum OrderStatus     { PENDING IN_PROGRESS COMPLETED FAILED ON_HOLD }
enum PartAvailability{ AVAILABLE NOT_AVAILABLE ON_ORDER }
enum TaskStatus      { PENDING IN_PROGRESS COMPLETED FAILED }
enum TaskPriority    { LOW MEDIUM HIGH URGENT }
enum Channel         { SMS WHATSAPP EMAIL }
enum CommunicationType { STATUS_UPDATE APOLOGY MONTHLY_CHECKIN MANUAL }
enum CommunicationState { DRAFT SENT }      // SENT only reachable in messaging phase
enum ReminderType    { DAILY_UPDATE MONTHLY_CHECKIN CUSTOM }
enum ReminderState   { PENDING DONE DISMISSED }
enum NotificationType{ TASK_ASSIGNED TASK_OVERDUE LOW_RATING REMINDER_DUE GENERIC }
```

### User (extends Better-Auth `user`)
Added fields: `roles Role[]` (default `[]`), `kpis String?`, `bottlenecks String?`,
`photo String?`, `isApproved Boolean @default(false)`, `profileCompleted Boolean @default(false)`.
Relations: `assignedTasks`, `createdTasks`, `reviewsGiven`, `reviewsReceived`,
`assignedOrders`, `notifications`, `activityLogs`.

### Domain models (field summary)
- **Client** — `name`, `phone?`, `email?`, `whatsapp?`, `address?`, `preferredChannel Channel?`. → vehicles, orders, feedback, communications.
- **Vehicle** — `clientId`, `make`, `model`, `year Int`, `plate?`, `vin?`, `color?`, `mileage Int?`.
- **Order** — `clientId`, `vehicleId`, `description`, `receivedDate`, `expectedDate?`, `status OrderStatus @default(PENDING)`, `statusReason?` (required when FAILED/ON_HOLD — enforced in action, `CLT-07`), `assignedTechId?`. → parts, feedback, communications, reminders.
- **Part** — `orderId`, `name`, `availability PartAvailability @default(NOT_AVAILABLE)`.
- **Feedback** — `clientId`, `orderId?`, `rating Int` (1–5), `comments?`, `createdById`.
- **Communication** — `clientId`, `orderId?`, `channel Channel`, `type CommunicationType`, `state CommunicationState @default(DRAFT)`, `content`, `senderId`, `createdAt`, `sentAt?`.
- **Task** — `title`, `description?`, `date` (work day), `dueDate?`, `status TaskStatus @default(PENDING)`, `priority TaskPriority @default(MEDIUM)`, `assigneeId`, `createdById`.
- **PerformanceReview** — `reviewerId`, `revieweeId`, `cycle String` (e.g. `2026-W21`), `deliverablesScore Int`, `communicationScore Int`, `comments?`. `@@unique([reviewerId, revieweeId, cycle])`.
- **CompanyKPI** — `name`, `targetValue Float`, `currentValue Float?`, `unit?`, `periodStart`, `periodEnd`, `autoComputed Boolean @default(false)`.
- **Reminder** — `type ReminderType`, `orderId?`, `clientId?`, `dueAt`, `recurrence?`, `state ReminderState @default(PENDING)`, `assigneeId?`.
- **Notification** — `userId`, `type NotificationType`, `title`, `body?`, `link?`, `read Boolean @default(false)`, `createdAt`.
- **ActivityLog** — `entityType`, `entityId`, `action`, `userId`, `metadata Json?`, `createdAt`. Indexed on `(entityType, entityId)`.

---

## 4. Functional requirements by module

### A. Auth & User Management
| ID | Behaviour |
|---|---|
| AUTH-01 | Self-register (name, email, password) via Better-Auth sign-up. |
| AUTH-02 | First login → forced `/onboarding`: pick role(s), enter KPIs + bottlenecks; sets `profileCompleted=true`. |
| AUTH-03 | Email+password login (built-in). *Password-reset email is deferred (needs Resend).* |
| AUTH-04 | Admin user management (view/edit/deactivate/delete) via Better-Auth `admin` plugin + `/admin/users`. |
| AUTH-05 | **Decision (open Q2): new accounts require admin approval before edit rights.** `isApproved=false` → read-only until approved. |

### B. Client & Order Management
CLT-01…09 — client/vehicle/order/part CRUD, status with mandatory reason on FAILED/ON_HOLD,
search & filter (name, contact, vehicle, status, tech, date), per-record activity log.

### C. Shared Client Dashboard
DASH-01…06 — all authenticated users can view; client list with the PRD columns;
colour-coded status badges; detail view (vehicles, orders, parts, status history, feedback,
comms log); quick filters ("Failed", "Due today", "Parts not available"); summary strip
(active jobs, pending, in-progress, completed-this-week, failed, awaiting-parts).
**No live push** — fresh on navigation + focus refetch.

### E. Customer Feedback
FB-01, FB-03, FB-04 — log rating + comments against client/order; aggregate (avg, recent,
trend) on detail + summary; low rating creates a `Notification` row (pull, not push). FB-02
(public link) deferred.

### F. AI-Assisted Apology Drafting
| ID | Behaviour |
|---|---|
| AI-01 | "Draft apology" available on orders that are FAILED / ON_HOLD / past `expectedDate`. |
| AI-02 | Claude drafts using `statusReason`, client name, vehicle, revised timeline. |
| AI-03 | User picks tone / channel / language; edits freely. |
| AI-04 | **Never auto-sent.** Saved as `Communication { type: APOLOGY, state: DRAFT }`. Actual send deferred. |
| AI-05 | Draft logged on the client record. |

### G/H. Employee Workspace + Accountability Board
EMP-01…05, ACC-01…06 — editable profile (role/KPIs/bottlenecks/photo); weekly tasks from
daily entries, carry-over of incomplete tasks; assign to anyone; team board (list + Kanban,
filter/group by person/status/day/priority); per-person completion %; overdue/failed
highlighted. ACC-05 notifications are **created as records** (pull centre); instant push deferred.

### I. Peer Performance Reviews
PERF-01…05 — everyone grades everyone (deliverables + communication, 1–5, optional comments);
configurable extra criteria (stored as JSON for now); cycles; profile aggregates + trend.
**Decision (open Q3): reviews are attributed, individual scores visible to Admin/Manager + the
reviewee; team sees aggregates only.**

### J. Company KPI Board
KPI-01…04 — Admin/Manager set targets; board visible to all; actual-vs-target with progress
bar where derivable (completed jobs/week, avg rating), manual otherwise; targets have an
effective period.

### Reminders & Notification centre (records-only this phase)
REM-06 (create one-off/recurring per-order reminders), REM-07 (log comms on the record),
REM-08 (a centre listing due-today / overdue / upcoming, per-user + team-wide) — all computed
**on load**. REM-01/02/05 auto-scheduling and REM-03 sending are deferred.

---

## 5. Permissions (RBAC)

Enforced **in server actions** via a `requirePermission(session, capability)` helper. Headline
rule (PRD §9): all authenticated, approved users can **VIEW** dashboard, task board, perf
summaries, KPI board. Edit/admin from Appendix A:

| Capability | Admin | Manager | Service Advisor | Technician | Parts |
|---|:--:|:--:|:--:|:--:|:--:|
| Manage users | ✅ | | | | |
| Create/edit clients & orders | ✅ | ✅ | ✅ | | |
| Update job status | ✅ | ✅ | ✅ | ✅ (assigned) | |
| Update parts availability | ✅ | ✅ | ✅ | | ✅ |
| Use AI apology drafting | ✅ | ✅ | ✅ | | |
| Create/assign tasks (anyone) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grade peer performance | ✅ | ✅ | ✅ | ✅ | ✅ |
| Set company KPI targets | ✅ | ✅ | | | |

---

## 6. Server-action surface (indicative)

```
auth/onboarding:   completeProfile
admin:             approveUser, setRoles, deactivateUser, deleteUser
clients:           createClient, updateClient, addVehicle, updateVehicle
orders:            createOrder, updateOrder, setOrderStatus(+reason), addPart, setPartAvailability
feedback:          logFeedback
ai:                draftApology  (calls Claude, returns + saves DRAFT)
tasks:             createTask, assignTask, setTaskStatus
reviews:           submitReview
kpi:               createKpi, updateKpi
reminders:         createReminder, completeReminder, dismissReminder
notifications:     markRead, markAllRead
```
All write actions go through `withMutation(action)` → runs the action, writes `ActivityLog`,
calls `emitDomainEvent()` (no-op this phase).

---

## 7. Non-functional
- **Performance:** dashboard core data < 2s; paginate/virtualise long lists.
- **Security:** Better-Auth hashed passwords, HTTPS (Vercel), RBAC in actions, audit log; client
  contact data treated as sensitive (no logging of PII to console/telemetry).
- **Time zone:** store UTC; render WAT; "due today" computed in WAT.
- **Auditability:** every edit + saved communication carries user + timestamp via `ActivityLog`.

---

## 8. Delivery milestones (this phase)
1. **Foundations** — extend `user` schema + all domain models; `db:push`; Better-Auth profile
   fields + `admin` plugin; add TanStack Query provider; RBAC helper; `withMutation` wrapper.
2. **Clients & Orders** — CRUD + search/filter (Modules B).
3. **Dashboard** — list, detail, badges, filters, summary strip (Module C).
4. **Employee + Tasks + Board** — Modules G/H.
5. **Feedback, KPI board, Peer reviews** — Modules E/J/I.
6. **AI apology drafting** — Module F (draft-only).
7. **Reminder + notification centre** — pull-based records.

---

## 9. Open questions (from PRD §11)
- **Q1 (auto-send vs approve), Q5 (providers):** N/A this phase — sending deferred.
- **Q2 (account approval):** resolved → **approval required** (AUTH-05).
- **Q3 (review anonymity):** resolved → **attributed**, individual scores to Admin/Manager + reviewee.
- **Q4 (clients log in):** confirmed **no** for v1.
- **Q6 (KPI auto-sources):** completed-jobs/week + avg-rating auto; rest manual.
- **Q7 (languages):** apology drafting accepts a language param; UI English-only this phase.
