# Phase 1 — Finalized Architecture & Implementation Plan
## Distributed Campus Resource Sharing System

This document locks in the architecture per your confirmed decisions. No implementation code appears here — this is the blueprint every later phase will build against without redesign.

---

## 1. System Architecture

```
                              Student/Browser
                                    │
                                    ▼
                          React Frontend (Vite)
                                    │  REST + WebSocket
                                    ▼
                            ┌───────────────┐
                            │  API Gateway   │  <- auth, routing, aggregation ONLY
                            │  (Auth owner)  │     NOT the DS coordinator
                            └───────┬────────┘
                                    │
                    REST / gRPC (fan-out to all three)
             ┌──────────────────────┼──────────────────────┐
             ▼                      ▼                      ▼
      ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
      │  CS Service │◄──────►│  IT Service │◄──────►│ENTC Service │   P2P (gRPC)
      │  prio = 1   │        │  prio = 2   │        │  prio = 3   │
      └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
             │                      │                      │
             ▼                      ▼                      ▼
        CS MongoDB             IT MongoDB             ENTC MongoDB
             │                      │                      │
             └──────────┬───────────┴──────────┬───────────┘
                         ▼                      ▼
                  ┌────────────────────────────────┐
                  │            RabbitMQ             │
                  │ exchanges: resource.events,     │
                  │            node.heartbeat        │
                  └────────────────────────────────┘

                     Auth Database (Gateway-owned, separate Mongo instance)
```

**Key rule enforced throughout:** the Gateway routes and authenticates; it never decides who the leader is, never runs elections, never arbitrates mutual exclusion. That logic lives inside CS/IT/ENTC, one of which is always the acting coordinator.

---

## 2. Component Diagram (responsibilities at a glance)

```
┌────────────────────────────────────────────────────────────────┐
│ Frontend                                                         │
│  - Auth pages, dashboards, search, reservation, monitor, demo    │
│  - Talks ONLY to Gateway (REST) and Gateway (WS relay)           │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ API Gateway (middleware layer)                                   │
│  - /api/auth/*            → owns Auth DB, issues JWT              │
│  - /api/resources/search  → fans out to CS/IT/ENTC, merges        │
│  - /api/reservations/*    → forwards to owning department +       │
│                              current coordinator                  │
│  - /api/nodes, /api/nodes/health → polls dept /internal/health    │
│  - /api/distributed/*     → proxies read-only queries to whichever│
│                              node is currently leader              │
│  - WS relay: subscribes to RabbitMQ, pushes to browser sockets     │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ CS / IT / ENTC Service (identical codebase, different config)    │
│  - REST: CRUD on own resources, reservations, borrow/return       │
│  - gRPC: SearchResource (RPC), peer availability checks (P2P)     │
│  - distributed/ module:                                           │
│      lamportClock.js   – local counter, increments on send/recv   │
│      vectorClock.js    – local {CS,IT,ENTC} vector                │
│      bullyElection.js  – election state machine                   │
│      ricartAgrawala.js – mutual exclusion for conflicting reserve │
│      heartbeat.js      – beacon emit + peer liveness tracking      │
│  - Authorization check: JWT role + department claim must match    │
│    the resource's department for write operations                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Service Responsibilities

**API Gateway**
- Registration/login, password hashing, JWT issue/verify (owns the Auth DB)
- Validates JWT on every incoming request, attaches `{userId, role, department}` to forwarded requests
- Fans out search concurrently to CS/IT/ENTC with a per-node timeout (e.g. 2s); merges partial results and flags any node that didn't respond
- Forwards reservation/borrow/return requests to the relevant department service
- Read-only proxy for `/api/distributed/leader`, `/lamport`, `/vector` — these hit whichever node currently claims leadership; if unreachable, Gateway asks the next-priority node
- WebSocket relay: one RabbitMQ consumer, broadcasts to connected browser clients
- Never stores resource data, never participates in election/mutex logic

**CS / IT / ENTC Service (same code, `NODE_ID`/`DEPARTMENT`/`PORT` differ)**
- Owns its Mongo database and its resources/reservations/borrow-records collections
- Exposes internal REST endpoints for the Gateway and gRPC endpoints for peers
- Maintains its own Lamport counter and its own slot in a shared-format vector clock, incrementing on every locally significant event (reserve, borrow, return, election message)
- Runs the Bully election module: knows its own priority, knows peer addresses, can initiate/respond to elections, can announce itself as coordinator
- Runs Ricart-Agrawala when a reservation could conflict — see §6
- Sends periodic beacon (RabbitMQ fanout `node.heartbeat`) and tracks peers' last-seen timestamps to detect failure independently of the Gateway
- Enforces department-scoped authorization: a `DEPARTMENT_ADMIN` JWT for CS cannot write to IT's resources even if the request is somehow routed there

**Auth Database (Gateway-owned)**
- Single `users` collection: `{userId, name, email, passwordHash, role, department (for admins), createdAt}`
- This is intentionally centralized — authentication is not a "resource" concept, so it doesn't violate distributed resource ownership

---

## 4. Communication Flow

| From → To | Protocol | Purpose | DS Concept |
|---|---|---|---|
| Browser → Gateway | REST | All client actions | Client-Server |
| Browser ↔ Gateway | WebSocket | Live availability/leader/clock updates | Stream-oriented |
| Gateway → CS/IT/ENTC | REST | CRUD, reservation forwarding | Client-Server / Middleware |
| Gateway → CS/IT/ENTC | gRPC | `SearchResource(name)` concurrent calls | RPC |
| CS/IT/ENTC → CS/IT/ENTC | gRPC | Availability check, election messages, RA request/reply | P2P |
| CS/IT/ENTC → RabbitMQ | AMQP publish | `RESOURCE_*`, `NODE_STATUS_CHANGED`, heartbeat | Message-oriented |
| RabbitMQ → Gateway | AMQP subscribe | Feeds WS relay | Message-oriented |
| RabbitMQ → CS/IT/ENTC | AMQP subscribe | Peers observe each other's heartbeat/events | Message-oriented |

**Example — search flow:**
1. Browser → `GET /api/resources/search?name=Arduino Uno` → Gateway
2. Gateway calls `SearchResource("Arduino Uno")` via gRPC on CS, IT, ENTC concurrently (`Promise.allSettled`, 2s timeout each)
3. Gateway merges: `{CS: 0, IT: 2, ENTC: 3, total: 5, nodesUnreachable: []}`
4. Response returned to browser; if a node timed out, it's listed in `nodesUnreachable` and excluded from the total rather than crashing the request

**Example — reservation flow with conflict potential:**
1. Browser → `POST /api/reservations {resourceId, department}` → Gateway (JWT validated)
2. Gateway forwards to the owning department service
3. That service checks `availableQuantity`. If a peer node is also known to be contending for a logically-related last unit (rare, but modeled for the demo — see §6), it initiates Ricart-Agrawala with peers before decrementing
4. On success, service decrements quantity, bumps its Lamport clock and vector clock slot, publishes `RESOURCE_RESERVED` to RabbitMQ
5. Gateway's WS relay pushes the update to all connected browsers

---

## 5. Database Design

**Auth DB (Gateway) — `users`**
```
userId, name, email, passwordHash, role (STUDENT | DEPARTMENT_ADMIN),
department (only for DEPARTMENT_ADMIN), createdAt, updatedAt
```

**Each department DB (CS / IT / ENTC — identical schema) — `resources`**
```
resourceId, name, category, description, department, laboratory,
totalQuantity, availableQuantity, reservedQuantity, borrowedQuantity,
condition, imageUrl, manualUrl, tutorialVideoUrl,
createdAt, updatedAt, version (optimistic lock),
vectorClock: { CS: n, IT: n, ENTC: n }
```

**`reservations`**
```
reservationId, resourceId, studentId, department,
status (PENDING | APPROVED | REJECTED | CANCELLED | FULFILLED),
lamportTimestamp, createdAt, updatedAt
```

**`borrow_records`**
```
recordId, resourceId, studentId, borrowedAt, dueAt, returnedAt, condition
```

**`node_state`** (small internal collection, one document per service)
```
nodeId, lamportClock, vectorClock, isCoordinator (bool),
knownPeers: [{nodeId, lastHeartbeat, status}]
```

Optimistic locking (`version` field) is the backstop under Ricart-Agrawala: even if mutex logic has a bug, a write with a stale version is rejected.

---

## 6. Leader Election Design (Bully Algorithm)

**Priorities:** `CS = 1`, `IT = 2`, `ENTC = 3` (higher wins).

**Trigger conditions:** a node initiates an election when it notices (via heartbeat timeout) that the current coordinator is unreachable.

**Message types (gRPC):**
- `ELECTION` — sent to all higher-priority peers
- `OK` — reply meaning "I'm alive and higher priority, stand down"
- `COORDINATOR` — announcement broadcast by the winner to all peers

**Algorithm steps:**
1. Node `N` detects coordinator timeout → sends `ELECTION` to all peers with priority > N
2. If any higher peer replies `OK`, N waits for that peer to announce itself as coordinator; if no announcement arrives within a timeout, N restarts the election
3. If no higher peer replies, N declares itself coordinator and broadcasts `COORDINATOR` to all peers
4. All nodes update `node_state.isCoordinator` and their local "current leader" pointer on receiving `COORDINATOR`

**Example log trace (matches your spec):**
```
[ELECTION] Election started by CS
[ELECTION] IT responded
[ELECTION] ENTC unavailable
[ELECTION] IT becomes leader
```

**Endpoints:**
```
GET  /internal/leader              -> current known leader (per node's view)
POST /internal/election             -> manually trigger (used by Demo Panel Test 3)
POST /internal/leader/announce      -> internal, called by the winner
```

Gateway's `/api/distributed/leader` simply asks any reachable node for its `/internal/leader` view and returns it — it does not compute anything itself.

---

## 7. Mutual Exclusion Design (Ricart-Agrawala)

**Scenario modeled (from your spec):** last unit of a resource type is contended via two different entry points. Since resources are department-owned with independent quantities, true cross-node contention on the *same physical unit* only arises in the specific demo scenario you described (Test 2) — we will model it explicitly rather than force it into ordinary CRUD, per your Section 21 constraint against artificial padding: the **Demo Panel** will let two simulated students request the same single-unit resource through two different department entry points at once, and the owning department node will run real Ricart-Agrawala against its peers to serialize the two requests before either commits.

**Algorithm steps:**
1. Node wanting to enter the critical section (decrement the last unit) increments its Lamport clock, timestamps the request `(timestamp, nodeId)`, and sends `REQUEST` to all peers
2. On receiving `REQUEST`, a peer replies `REPLY` immediately unless it is *also* requesting the same resource with a request that has an earlier `(timestamp, nodeId)` tie-break — in that case it defers its `REPLY` until it exits its own critical section
3. Requesting node enters critical section only after receiving `REPLY` from all peers
4. After completing the reservation, it sends any deferred `REPLY`s

**Demo Panel Test 2 will surface:**
```
Student A request  (CS, ts=12)
Student B request  (IT, ts=13)
[MUTEX] CS REQUEST ts=12 sent to IT, ENTC
[MUTEX] IT REQUEST ts=13 sent to CS, ENTC
[MUTEX] CS wins (lower timestamp) → reservation committed
[MUTEX] IT request deferred → loses, notified "already reserved"
```

This is a real, working algorithm — not a cosmetic log — since it directly gates the Mongo write via the `version` field.

---

## 8. Folder Structure (as confirmed)

```
distributed-campus-resource/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── gateway/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/     (jwtAuth.js, roleCheck.js, errorHandler.js)
│   │   ├── services/       (searchAggregator.js, nodeRegistry.js, wsRelay.js)
│   │   ├── models/         (User.js)
│   │   └── server.js
│   ├── Dockerfile
│   └── package.json
├── services/
│   ├── cs-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/       (Resource.js, Reservation.js, BorrowRecord.js, NodeState.js)
│   │   │   ├── services/     (resourceService.js, reservationService.js)
│   │   │   ├── grpc/         (server.js, client.js, resource.proto handlers)
│   │   │   ├── distributed/  (lamportClock.js, vectorClock.js, bullyElection.js, ricartAgrawala.js, heartbeat.js)
│   │   │   └── server.js
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── it-service/    (identical structure)
│   └── entc-service/  (identical structure)
├── shared/
│   ├── constants/     (events.js, roles.js, departments.js)
│   ├── utils/         (logger.js, validation.js)
│   ├── schemas/       (resourceSchema.js)
│   └── distributed/   (lamportClock.js, vectorClock.js, election.js, messages.js — generic reusable logic only)
└── proto/
    └── resource.proto  (shared gRPC contract: SearchResource, Election, Coordinator, RARequest, RAReply)
```

Note: `shared/distributed/` holds generic, department-agnostic algorithm building blocks (clock math, message shape definitions); each service's own `src/distributed/` wires that generic logic into its specific peer list, port config, and Mongo writes. This avoids duplicating algorithm logic while keeping department-specific wiring local, per your Section 5 rule.

---

## 9. API Design

**Gateway (public)**
```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/resources/search?name=
GET    /api/resources/:id
POST   /api/reservations
DELETE /api/reservations/:id
POST   /api/resources/:id/borrow
POST   /api/resources/:id/return

GET    /api/nodes
GET    /api/nodes/health
GET    /api/distributed/leader
GET    /api/distributed/lamport
GET    /api/distributed/vector
POST   /api/distributed/election      (manual trigger, demo only)

WS     /ws/updates
```

**Each department service (internal — called by Gateway or peers, not the browser)**
```
GET    /internal/resources
POST   /internal/resources
PUT    /internal/resources/:id
DELETE /internal/resources/:id
GET    /internal/health

GET    /internal/leader
POST   /internal/election
POST   /internal/leader/announce

gRPC   SearchResource(name) -> { available, department }
gRPC   Election(candidateId, priority)
gRPC   Coordinator(nodeId)
gRPC   RARequest(timestamp, nodeId, resourceId)
gRPC   RAReply(nodeId, resourceId)
```

---

## 10. FA-1 / FA-2 Concept Mapping

| Concept | FA | Where |
|---|---|---|
| Distributed architecture | 1 | CS/IT/ENTC independent services+DBs |
| Client-Server | 1 | Frontend → Gateway |
| Middleware | 1 | Gateway auth/routing layer |
| REST | 1 | Frontend↔Gateway, Gateway↔Services |
| RPC | 1 | gRPC `SearchResource` |
| Message-oriented | 1 | RabbitMQ resource + heartbeat events |
| Stream-oriented | 1 | WebSocket live updates |
| P2P | 1 | Direct dept-to-dept availability/election/mutex calls |
| Distributed computation | 1 | Concurrent fan-out search + aggregation |
| Virtualization | 1 | Docker containers |
| Lamport clock | 2 | Every reservation/borrow/return/election event |
| Vector clock | 2 | Per-resource vector, `/api/distributed/vector` |
| Mutual exclusion | 2 | Ricart-Agrawala, Demo Panel Test 2 |
| Leader election | 2 | Bully among CS/IT/ENTC, Demo Panel Test 3 |
| Beacon/heartbeat | 2 | RabbitMQ fanout + peer liveness table |
| Global state | 2 | Aggregated dashboard endpoint |
| Fault tolerance | 2 | Partial search results, health flags, Demo Panel Test 4 |

---

## 11. Docker Architecture

**Containers:**
```
frontend        (Vite build served, or dev server)
gateway
cs-service
it-service
entc-service
rabbitmq
auth-mongodb
cs-mongodb
it-mongodb
entc-mongodb
```

**Networking:** all containers on one user-defined bridge network (`campus-net`); services address each other by container name (`http://cs-service:5001`, `amqp://rabbitmq:5672`), never `localhost`.

**Volumes:** one named volume per Mongo container for persistence (`auth-mongo-data`, `cs-mongo-data`, etc.)

**Env vars per service (example, CS):**
```
NODE_ID=CS
DEPARTMENT=CS
PORT=5001
MONGO_URI=mongodb://cs-mongodb:27017/cs_db
RABBITMQ_URL=amqp://rabbitmq:5672
PEER_IT_URL=http://it-service:5002
PEER_ENTC_URL=http://entc-service:5003
PEER_IT_GRPC=it-service:50052
PEER_ENTC_GRPC=entc-service:50053
JWT_PUBLIC_KEY=... (or shared secret via env)
NODE_PRIORITY=1
```

**Health checks:** each service exposes `/internal/health` (departments) or `/health` (gateway); `docker-compose.yml` healthchecks poll these, with `restart: unless-stopped` policies.

**Fault demo:** `docker stop it-service` → CS/ENTC's heartbeat tracking marks IT down within one beacon interval → Gateway search excludes IT and flags it → if IT was leader, Bully election runs and promotes ENTC → `docker start it-service` → IT re-registers, resumes heartbeat, does not automatically reclaim leadership (Bully re-election only happens on next detected failure, which is standard and worth mentioning in the viva).

**Scaling demo:** `docker compose up --scale it-service=3` is compatible since services are stateless aside from their own Mongo — a lightweight round-robin note will be documented (real load balancing across replicas needs each replica to register with a distinct `NODE_ID` suffix so election/heartbeat logic doesn't collide; this will be handled explicitly in Phase 5/6 rather than assumed to work for free).

---

## 12. Step-by-Step Implementation Plan

**Phase 2 — Backend Foundation**
1. Scaffold `gateway/`, `services/cs-service/`, `it-service/`, `entc-service/`, `shared/`
2. Gateway: Auth DB, register/login, JWT middleware
3. Each department service: Mongo model, CRUD REST endpoints, `/internal/health`
4. Manual testing per service via curl/Postman before wiring anything together

**Phase 3 — Distributed Communication**
1. Define `proto/resource.proto`; implement gRPC `SearchResource` on each service; wire Gateway fan-out
2. Add RabbitMQ: publish `RESOURCE_*` events; Gateway WS relay subscribes
3. Implement heartbeat module (RabbitMQ fanout + peer liveness table)
4. Implement basic P2P availability check between services
5. Test with `docker compose up` for backend containers only (no frontend yet)

**Phase 4 — Frontend**
1. Scaffold Vite React app, all 10 pages as routed views (start with static/mock data)
2. Wire auth, search, reservation flows to Gateway REST
3. Wire WebSocket for live updates
4. Build Distributed Node Monitor + Distributed System Visualization pages against real `/api/distributed/*` and `/api/nodes/*` endpoints

**Phase 5 — Docker**
1. Write Dockerfiles per service, `docker-compose.yml`, `.env.example`
2. Add healthchecks, restart policies, named volumes, bridge network
3. Verify full stack: `docker compose up --build`, `docker compose ps`, `docker compose down`

**Phase 6 — FA-2 Algorithms**
1. Add Lamport clock to all significant events
2. Add vector clock to resource updates + `/api/distributed/vector`
3. Implement Bully election module + `/internal/election` endpoints + Gateway proxy
4. Implement Ricart-Agrawala for the contended-reservation scenario
5. Build the Demo Panel (Tests 1–5) end to end
6. Verify fault demo (`docker stop it-service`) and scaling demo

**Phase 7 — Testing**
Search, reservation, concurrent requests, service failure, leader failure/election, RabbitMQ events, DB failure, recovery — as a documented manual + scripted test suite.

**Phase 8 — Documentation**
README, architecture doc, API docs, Docker setup guide, DS concept mapping, algorithm explanations, testing instructions, demo script, viva Q&A.

---

This plan matches all 11 confirmed decisions and introduces no new open questions. Ready to proceed to **Phase 2: Backend Foundation** on your go-ahead.
