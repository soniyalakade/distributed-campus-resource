# Phase 2 — Backend Foundation: Setup, Testing & Completion

This is the companion doc to `distributed-campus-resource-phase2.zip`. Follow it top to bottom to stand up the backend and verify every Phase 2 requirement yourself. I could not run these commands myself (no network/MongoDB in my sandbox — see the note at the end), so this is written for you to execute and report back anything that breaks.

---

## 1. Complete Folder Tree

```
distributed-campus-resource/
├── .env.example              (reference — documents every variable)
├── .gitignore
├── gateway/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── sharedPath.js
│       ├── controllers/  (authController, resourceController, reservationController, borrowController, nodeController)
│       ├── routes/       (authRoutes, resourceRoutes, reservationRoutes, borrowRoutes, nodeRoutes)
│       ├── middleware/   (jwtAuth, roleCheck, errorHandler)
│       ├── services/     (authService, searchAggregator, healthAggregator, nodeRegistry, resourceProxyService)
│       └── models/       (User)
├── services/
│   ├── cs-service/    (DEPARTMENT=CS, PORT=5001)
│   ├── it-service/    (DEPARTMENT=IT, PORT=5002)
│   └── entc-service/  (DEPARTMENT=ENTC, PORT=5003)
│       └── each identical in structure:
│           ├── .env.example
│           ├── Dockerfile
│           ├── package.json
│           └── src/
│               ├── server.js
│               ├── sharedPath.js
│               ├── controllers/ (resourceController, reservationController, borrowController, healthController)
│               ├── routes/      (resourceRoutes, reservationRoutes, healthRoutes)
│               ├── middleware/  (jwtAuth, roleCheck, errorHandler)
│               ├── services/    (resourceService, reservationService, borrowService)
│               └── models/      (Resource, Reservation, BorrowRecord)
├── shared/
│   ├── constants/   (events.js, roles.js, departments.js)
│   ├── utils/       (logger.js, validation.js)
│   ├── schemas/     (resourceSchema.js — reference only, not a live Mongoose schema)
│   └── distributed/ (lamportClock.js, vectorClock.js, election.js, messages.js — PLACEHOLDERS, Phase 6)
├── proto/            (empty — Phase 3)
└── frontend/         (empty — Phase 4)
```

---

## 2. MongoDB Setup

You need 4 logical databases: `auth_db`, `cs_db`, `it_db`, `entc_db`. Easiest path — one local MongoDB instance, four database names (Mongo creates databases on first write, no manual creation needed):

```bash
# If you don't have MongoDB installed locally, the fastest option is Docker:
docker run -d --name local-mongo -p 27017:27017 mongo:7

# Verify it's up:
docker exec -it local-mongo mongosh --eval "db.runCommand({ ping: 1 })"
```

If you already have MongoDB installed natively, just make sure it's running on `mongodb://localhost:27017` — the four `.env.example` files already point at four different database names on that same instance, which is enough to demonstrate "separate logical databases" for Phase 2. (Phase 5's docker-compose will give each department its own MongoDB **container**, which is the stronger version of this isolation — not required yet.)

---

## 3. Install Dependencies

Run this once per service (4 installs total):

```bash
cd distributed-campus-resource/gateway && npm install
cd ../services/cs-service && npm install
cd ../it-service && npm install
cd ../entc-service && npm install
```

---

## 4. Configure Environment

Copy each `.env.example` to `.env` in its own folder:

```bash
cd distributed-campus-resource
cp gateway/.env.example gateway/.env
cp services/cs-service/.env.example services/cs-service/.env
cp services/it-service/.env.example services/it-service/.env
cp services/entc-service/.env.example services/entc-service/.env
```

**Critical:** open all four `.env` files and set the **same** `JWT_SECRET` value in every one (e.g. `JWT_SECRET=my_local_dev_secret_change_me`). The Gateway issues tokens; each department service independently re-verifies them with this shared secret. If they don't match, every department call will 401.

---

## 5. Start Each Service (4 separate terminals)

```bash
# Terminal 1
cd distributed-campus-resource/gateway && npm start

# Terminal 2
cd distributed-campus-resource/services/cs-service && npm start

# Terminal 3
cd distributed-campus-resource/services/it-service && npm start

# Terminal 4
cd distributed-campus-resource/services/entc-service && npm start
```

Expected log lines (one per terminal):
```
[Gateway] Connected to Auth MongoDB at mongodb://localhost:27017/auth_db
[Gateway] Gateway listening on port 4000

[CS] Connected to MongoDB at mongodb://localhost:27017/cs_db
[CS] CS service listening on port 5001

[IT] Connected to MongoDB at mongodb://localhost:27017/it_db
[IT] IT service listening on port 5002

[ENTC] Connected to MongoDB at mongodb://localhost:27017/entc_db
[ENTC] ENTC service listening on port 5003
```

If a service exits immediately with `Failed to start service` / `Failed to start gateway`, the logged message will say why — almost always a MongoDB connection issue (wrong URI, Mongo not running).

---

## 6. Testing — All 17 Phase 2 Checklist Items

### 1–5. Services start & connect to MongoDB
Covered by Step 5 above — confirm all four terminals show `listening on port` with no errors.

### 6. User registration works

```bash
# Register a student
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@campus.edu","password":"pass1234","role":"STUDENT"}'

# Register a CS department admin
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"CS Admin","email":"csadmin@campus.edu","password":"pass1234","role":"DEPARTMENT_ADMIN","department":"CS"}'

# Register an IT department admin
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"IT Admin","email":"itadmin@campus.edu","password":"pass1234","role":"DEPARTMENT_ADMIN","department":"IT"}'
```
Expected: `201` with the created user (no `passwordHash` in the response).

### 7. Login works

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"csadmin@campus.edu","password":"pass1234"}'
```
Expected: `200` with `{ token, user }`. **Save the token** — export it for reuse:
```bash
export CS_ADMIN_TOKEN="<paste token here>"
export IT_ADMIN_TOKEN="<paste token from IT admin login>"
export STUDENT_TOKEN="<paste token from student login>"
```

### 8. JWT authentication works

```bash
# Without a token — should be rejected
curl http://localhost:4000/api/nodes
# Expected: 401 Missing or malformed Authorization header

# With a token — should succeed
curl http://localhost:4000/api/nodes -H "Authorization: Bearer $STUDENT_TOKEN"
# Expected: 200 with the 3-node list
```

### 9. CS admin can create CS resources

```bash
curl -X POST http://localhost:4000/api/nodes -H "Authorization: Bearer $CS_ADMIN_TOKEN"
# (sanity check only — actual resource creation goes direct to the department service in Phase 2,
#  since the Gateway does not yet proxy resource *creation*, only search/reserve/borrow/return per
#  the Phase 2 API spec. Create resources directly against the CS service:)

curl -X POST http://localhost:5001/internal/resources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CS_ADMIN_TOKEN" \
  -d '{
    "name": "Arduino Uno",
    "category": "Development Board",
    "department": "CS",
    "laboratory": "Embedded Systems Lab",
    "totalQuantity": 2,
    "condition": "GOOD"
  }'
```
Expected: `201` with the created resource, `availableQuantity: 2`.

**Note on Gateway resource creation:** your Phase 2 spec's API list for the Gateway (`POST /api/resources`) wasn't included in the Step 7 Gateway endpoint list you gave me — only search/get/reserve/cancel/borrow/return were. I've implemented resource CRUD directly against each `/internal/resources` endpoint (which the department admin can call directly, same as Postman would), and left Gateway-proxied resource creation out of Phase 2 rather than silently invent an endpoint you didn't specify. Flag if you want the Gateway to also proxy `POST /api/resources` — easy to add.

### 10. CS admin cannot modify IT resources

```bash
# Try creating an IT resource using the CS admin's token, directly against the IT service
curl -X POST http://localhost:5002/internal/resources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CS_ADMIN_TOKEN" \
  -d '{"name":"Multimeter","category":"Tool","department":"IT","totalQuantity":5}'
```
Expected: `403 Admin for department 'CS' cannot modify 'IT' resources`.

### 11. Student can search resources

First seed IT and ENTC with an Arduino too, so the search has something to aggregate:
```bash
curl -X POST http://localhost:5002/internal/resources \
  -H "Content-Type: application/json" -H "Authorization: Bearer $IT_ADMIN_TOKEN" \
  -d '{"name":"Arduino Uno","category":"Development Board","department":"IT","totalQuantity":3}'
```
(Register/login an ENTC admin the same way if you want all three departments populated.)

```bash
curl "http://localhost:4000/api/resources/search?name=Arduino" \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expected:
```json
{
  "resource": "Arduino",
  "results": [
    { "department": "CS", "available": 2, "matches": [ ... ] },
    { "department": "IT", "available": 3, "matches": [ ... ] },
    { "department": "ENTC", "available": 0, "matches": [] }
  ],
  "totalAvailable": 5,
  "nodesUnreachable": []
}
```

### 12. Distributed search queries all three nodes
Confirmed by the `results` array above containing all three departments — check each service's terminal log for `Resource search received` firing in CS and IT (and ENTC, even with a zero match).

### 13. Search still works when one node is unavailable

```bash
# Stop the IT service (Ctrl+C in its terminal), then re-run the search:
curl "http://localhost:4000/api/resources/search?name=Arduino" \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expected:
```json
{
  "resource": "Arduino",
  "results": [
    { "department": "CS", "available": 2, "matches": [...] },
    { "department": "IT", "available": null, "matches": [], "error": "unreachable" },
    { "department": "ENTC", "available": 0, "matches": [] }
  ],
  "totalAvailable": 2,
  "nodesUnreachable": ["IT"]
}
```
Restart IT (`npm start` again) before continuing.

### 14. Reservation works

```bash
curl -X POST http://localhost:4000/api/reservations \
  -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"department":"CS","resourceId":"<paste a CS Arduino resourceId from step 9 response>"}'
```
Expected: `201` with the reservation, `status: "APPROVED"`. Then confirm the resource's `availableQuantity` dropped and `reservedQuantity` rose:
```bash
curl http://localhost:5001/internal/resources/<resourceId> -H "Authorization: Bearer $STUDENT_TOKEN"
```

### 15. Borrow works

```bash
curl -X POST http://localhost:4000/api/resources/<resourceId>/borrow \
  -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"department":"CS"}'
```
Expected: `201` with a borrow record; resource's `reservedQuantity` decreases, `borrowedQuantity` increases.

### 16. Return works

```bash
curl -X POST http://localhost:4000/api/resources/<resourceId>/return \
  -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"department":"CS","condition":"GOOD"}'
```
Expected: `200` with the borrow record's `returnedAt` populated; resource's `borrowedQuantity` decreases, `availableQuantity` increases.

### 17. Health endpoints work

```bash
# Individual department health
curl http://localhost:5001/internal/health
curl http://localhost:5002/internal/health
curl http://localhost:5003/internal/health

# Gateway's own liveness
curl http://localhost:4000/health

# Gateway aggregating all three
curl http://localhost:4000/api/nodes/health -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expected: each returns `{ status: "UP", nodeId, department, dbConnected: true }`; the aggregate returns an array of all three.

---

## 7. Known Limitations (to be addressed in later phases)

| Limitation | Addressed in |
|---|---|
| No gRPC — Gateway↔department and department↔department calls are REST only | Phase 3 |
| No RabbitMQ — no `RESOURCE_*` events published anywhere yet | Phase 3 |
| No WebSocket — no live push updates to the frontend | Phase 3 |
| No P2P — department services never call each other directly yet | Phase 3 |
| Reservation atomicity is single-node only (MongoDB atomic update), not cross-node distributed mutual exclusion | Phase 6 (Ricart-Agrawala) |
| No Lamport or vector clocks anywhere | Phase 6 |
| No leader election / no concept of a "coordinator" yet | Phase 6 |
| No heartbeat/beacon — health checks are on-demand polls only, not periodic push | Phase 6 |
| Gateway's `GET /api/resources/:id` probes all three nodes for a match (no resourceId→department index yet) — functionally correct but not efficient; acceptable for Phase 2 scope | Optional future optimization, not required by any phase |
| No resource creation/update/delete proxy through the Gateway — department admins call `/internal/resources` directly (matches the Gateway endpoint list you specified for Phase 2) | Flag if you want this added |
| No frontend yet | Phase 4 |
| No Docker Compose orchestration yet — Dockerfiles exist per service but aren't wired together | Phase 5 |
| Reservation approval is auto-approved (`status: APPROVED` on creation) — no admin approve/reject workflow yet | Not explicitly scoped to any phase in your spec; flag if needed |

---

## 8. Phase 2 Completion Checklist

- [x] Project scaffold matches the approved folder structure exactly
- [x] Gateway: registration, login, JWT issuance, bcrypt hashing
- [x] Gateway middleware: jwtAuth, roleCheck, errorHandler
- [x] CS/IT/ENTC: structurally identical service architecture
- [x] Each department enforces its own `department` field on creation (rejects foreign department values)
- [x] Department-scoped admin authorization (CS admin blocked from IT resources, verified via middleware logic)
- [x] Resource CRUD implemented per department (`/internal/resources`)
- [x] Reservation foundation: exists → available check → create → decrement/increment → version bump, with explicit TODO comment marking FA-2's Ricart-Agrawala as the real distributed-mutex layer
- [x] Borrow/return foundation with valid state-transition checks
- [x] Gateway REST-only communication with department services (no gRPC yet, as instructed)
- [x] Distributed search: concurrent fan-out, `nodesUnreachable` reporting, doesn't fail whole request on one dead node
- [x] Health endpoints per service + Gateway aggregation
- [x] Environment-variable-based configuration, `.env.example` at root and per-service, no hardcoded secrets
- [x] Structured, timestamped, service-tagged logging throughout
- [x] Every file's path stated when created; three department services kept structurally identical
- [x] No Lamport/vector/Ricart-Agrawala/Bully/RabbitMQ/WebSocket/gRPC/Kubernetes code present (confirmed absent, placeholders only in `shared/distributed/`)
- [ ] **Not yet verified: actually running.** See note below.

### About that last box

I built this in a sandboxed container with **no network access and no local MongoDB**, so I could not run `npm install`, boot any service, or execute a single curl command against a live server. Everything above reflects: (a) all ~70 files passing `node --check` syntax validation, (b) two real bugs I found and fixed by reading the code carefully (a broken relative-path assumption between local/Docker layouts, and a doc-comment that would have crashed the Gateway with a `*/` inside a file-path reference), and (c) logic that, on inspection, correctly implements what Phase 2 asked for.

That's a reasonable confidence level, but it is not the same as "verified working," and I don't want to claim otherwise. Please run Section 5 and Section 6 above on your machine and tell me what happens — especially anything that doesn't match the expected output shown. I'll fix it immediately and we'll only move to **Phase 3: Distributed Communication** once you confirm it's actually running clean.
