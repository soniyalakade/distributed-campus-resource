# Phase 3 — Step 2: RabbitMQ + WebSocket — Completion Report

## 1. Final Changed-File List

**Added:**
```
shared/messaging/rabbitmq.js          (connection helper, one topic exchange: campus.resource.events)
shared/messaging/eventPublisher.js    (publish wrapper, never throws to caller)

services/cs-service/src/messaging/publisher.js     (department-stamped publish() wrapper)
services/it-service/src/messaging/publisher.js
services/entc-service/src/messaging/publisher.js

gateway/src/ws/wsRelay.js             (attaches WS server to existing HTTP server at /ws/updates)
gateway/src/messaging/subscriber.js   (wildcard-binds to the exchange, relays to WS clients)
```

**Modified (additive only — verified by diff, no existing logic changed):**
```
services/*/src/services/resourceService.js      -> publish RESOURCE_ADDED (create), RESOURCE_UPDATED (update)
services/*/src/services/reservationService.js    -> publish RESOURCE_RESERVED, RESOURCE_CANCELLED
services/*/src/services/borrowService.js         -> publish RESOURCE_BORROWED, RESOURCE_RETURNED
services/*/src/server.js                          -> connect to RabbitMQ at startup (non-fatal on failure)
services/*/package.json                           -> added amqplib
services/*/.env.example                           -> added RABBITMQ_URL

gateway/src/server.js       -> capture http.Server from app.listen(), attach WS relay, start subscriber
gateway/package.json        -> added amqplib, ws
gateway/.env.example        -> added RABBITMQ_URL
.env.example (root)         -> added RABBITMQ_URL documentation for all services
```

**Untouched (spot-checked after implementation):**
```
All REST routes/controllers/middleware  - unchanged
All gRPC server/handler/auth files      - unchanged
proto/resource.proto                     - unchanged
All Mongoose models                      - unchanged
JWT logic (Gateway + department)         - unchanged
Existing GET /api/resources/search       - unchanged
Existing GET /api/resources/search-grpc  - unchanged
```

---

## 2. Architecture

```
   Reservation/Borrow/Return/Create on CS/IT/ENTC
                    │
                    │ (existing REST/DB logic - UNCHANGED)
                    ▼
        services/*/src/services/*.js
                    │
                    │ NEW: additive publish() call after each DB write
                    ▼
        services/*/src/messaging/publisher.js
                    │ stamps { department } onto payload
                    ▼
        shared/messaging/eventPublisher.js
                    │ never throws - swallows RabbitMQ failures
                    ▼
        shared/messaging/rabbitmq.js
                    │ topic exchange: campus.resource.events
                    │ routing key = event type (RESOURCE_RESERVED, etc.)
                    ▼
              ┌───────────────┐
              │   RabbitMQ     │
              └───────┬───────┘
                      │ wildcard binding '#' (Gateway wants everything)
                      ▼
      gateway/src/messaging/subscriber.js
                      │
                      ▼
      gateway/src/ws/wsRelay.js  ──broadcast──►  All connected WS clients
                                                   (ws://localhost:4000/ws/updates)
```

Each department service now does **three** things on startup, in this order: connect to Mongo (fatal if it fails, unchanged from Phase 2), start the gRPC server (unchanged from Phase 3 Step 1), connect to RabbitMQ (**non-fatal** — a separate try/catch; if RabbitMQ isn't running, the service logs a warning and continues operating exactly as it did before this step).

The Gateway does the same pattern: Mongo connect (fatal), `app.listen()` (unchanged), attach WebSocket server to that same `http.Server` (new), start the RabbitMQ subscriber (non-fatal).

---

## 3. Event Flow (concrete example)

```
1. Student reserves an Arduino via existing endpoint:
   POST /api/reservations { department: "CS", resourceId: "..." }
   -> Gateway forwards to CS (unchanged REST proxy logic)
   -> CS's reservationService.reserveResource() runs its EXISTING atomic
      findOneAndUpdate + Reservation.save() (unchanged)

2. NEW: immediately after, reservationService.js calls:
   publish(EVENTS.RESOURCE_RESERVED, { reservationId, resourceId, studentId,
                                        availableQuantity, reservedQuantity })

3. publisher.js stamps department: "CS" onto the payload, hands off to
   shared/messaging/eventPublisher.js

4. eventPublisher.js publishes to the 'campus.resource.events' topic
   exchange with routing key 'RESOURCE_RESERVED'. If RabbitMQ is down,
   this step logs a warning and returns - the reservation itself has
   ALREADY succeeded and already been returned to the HTTP caller by
   this point, so a messaging failure can never undo or block a
   completed operation.

5. Gateway's subscriber.js (bound to '#', i.e. all routing keys) receives
   the message, parses it, and calls wsRelay.broadcast(parsedMessage).

6. Every currently-connected WebSocket client at ws://localhost:4000/ws/updates
   receives:
   { "eventType": "RESOURCE_RESERVED",
     "payload": { "reservationId": "...", "resourceId": "...", "studentId": "...",
                  "availableQuantity": 1, "reservedQuantity": 1, "department": "CS" },
     "timestamp": "2026-08-24T..." }
```

---

## 4. Install New Dependencies

```powershell
cd distributed-campus-resource\gateway
npm install

cd ..\services\cs-service
npm install

cd ..\it-service
npm install

cd ..\entc-service
npm install
```

## 5. RabbitMQ Setup

```powershell
docker run -d --name local-rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Verify it's up (management UI):
# http://localhost:15672  (default login: guest / guest)
```

## 6. Update Your `.env` Files

Add to all four `.env` files (gateway + cs/it/entc services):
```
RABBITMQ_URL=amqp://localhost:5672
```

## 7. Start Services (same 4 PowerShell windows as before)

```powershell
# Window 1
cd distributed-campus-resource\gateway
npm start

# Window 2
cd distributed-campus-resource\services\cs-service
npm start

# Window 3
cd distributed-campus-resource\services\it-service
npm start

# Window 4
cd distributed-campus-resource\services\entc-service
npm start
```

**Expected new log lines** (in addition to everything from Phase 2/Step 1):
```
[Gateway] WebSocket relay attached at /ws/updates
[Gateway] Gateway subscribed to RabbitMQ exchange for WS relay
[CS] Connected to RabbitMQ at amqp://localhost:5672
[IT] Connected to RabbitMQ at amqp://localhost:5672
[ENTC] Connected to RabbitMQ at amqp://localhost:5672
```

---

## 8. Testing

You'll need a WebSocket test client. PowerShell has no built-in one; the simplest option is a tiny Node.js script (uses the `ws` package already installed in `gateway/node_modules`):

```powershell
# Save as test-ws-client.js anywhere, then run: node test-ws-client.js
```
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:4000/ws/updates');
ws.on('open', () => console.log('Connected to Gateway WebSocket relay'));
ws.on('message', (data) => console.log('EVENT RECEIVED:', data.toString()));
ws.on('close', () => console.log('Disconnected'));
ws.on('error', (err) => console.log('WS error:', err.message));
```

```powershell
cd distributed-campus-resource\gateway
node ..\..\test-ws-client.js
```
Leave this running in its own window for all tests below.

Get a fresh token (as before):
```powershell
$body = @{ email = "csadmin@campus.edu"; password = "pass1234" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.token
```

### Test 1 — Normal successful operation

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/resources/search?name=Arduino" `
  -Method Get -Headers @{ Authorization = "Bearer $token" }
```
**Expected:** identical to your existing working REST search result — proves nothing in Step 2 broke Phase 2/Step 1.
**Proves:** backward compatibility of REST search.

### Test 2 — Communication between Gateway and department nodes (event publish → WS relay)

```powershell
$studentBody = @{ email = "asha@campus.edu"; password = "pass1234" } | ConvertTo-Json
$studentToken = (Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -Body $studentBody -ContentType "application/json").token

$reserveBody = @{ department = "CS"; resourceId = "<a real CS Arduino resourceId>" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/reservations" -Method Post `
  -Headers @{ Authorization = "Bearer $studentToken" } -Body $reserveBody -ContentType "application/json"
```
**Expected:** the reservation succeeds (as before), AND your WS test client window immediately prints:
```
EVENT RECEIVED: {"eventType":"RESOURCE_RESERVED","payload":{...,"department":"CS"},"timestamp":"..."}
```
**Proves:** message-oriented communication (CS → RabbitMQ) chained into stream-oriented communication (Gateway → WebSocket) — a full distributed event pipeline, not just a direct call.

### Test 3 — Authentication (gRPC/REST unaffected by messaging changes)

```powershell
# No token - should still be rejected exactly as before
Invoke-RestMethod -Uri "http://localhost:4000/api/nodes" -Method Get
```
**Expected:** `401`, same as Phase 2. **Proves:** JWT auth path is untouched by this step (messaging has no auth layer of its own by design — it's an internal server-to-server event bus, not a client-facing API).

### Test 4 — Multiple department nodes (IT and ENTC also publish)

```powershell
# Log in an IT admin, create/reserve an IT resource, watch the SAME WS client
$itAdminBody = @{ email = "itadmin@campus.edu"; password = "pass1234" } | ConvertTo-Json
$itToken = (Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -Body $itAdminBody -ContentType "application/json").token

$reserveItBody = @{ department = "IT"; resourceId = "<a real IT resourceId>" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/reservations" -Method Post `
  -Headers @{ Authorization = "Bearer $studentToken" } -Body $reserveItBody -ContentType "application/json"
```
**Expected:** WS client prints a second event with `"department":"IT"`.
**Proves:** all three department nodes independently publish to the same shared exchange — genuine distributed messaging, not a single-node simulation.

### Test 5 — Failure of one department node

```powershell
# Stop CS (Ctrl+C in its window)

# Try to reserve a CS resource (should fail at the REST layer, as it already did in Phase 2 - no change)
Invoke-RestMethod -Uri "http://localhost:4000/api/reservations" -Method Post `
  -Headers @{ Authorization = "Bearer $studentToken" } -Body $reserveBody -ContentType "application/json"
```
**Expected:** Gateway returns a 502/503-style upstream error (existing `resourceProxyService.js` behavior, unchanged). No event is published (CS never got the request). The Gateway itself and its WS relay **stay up** — check the WS client is still connected.
**Proves:** fault tolerance — one dead node doesn't crash the Gateway, the WS relay, or affect IT/ENTC's ability to keep publishing events independently.

### Test 6 — Recovery after restarting the failed node

```powershell
cd distributed-campus-resource\services\cs-service
npm start
```
**Expected log line:**
```
[CS] Connected to RabbitMQ at amqp://localhost:5672
```
Then repeat Test 2 (reserve a CS resource) — it should succeed and the WS client should receive the event again.
**Proves:** recovery — a restarted node re-establishes both its Mongo and RabbitMQ connections and resumes normal distributed operation without any manual intervention on the Gateway side.

### Test 7 — RabbitMQ itself going down (specific to this step)

```powershell
docker stop local-rabbitmq

# Try a reservation - the REST operation itself must still succeed:
Invoke-RestMethod -Uri "http://localhost:4000/api/reservations" -Method Post `
  -Headers @{ Authorization = "Bearer $studentToken" } -Body $reserveBody -ContentType "application/json"
```
**Expected:** the reservation still returns `201` successfully (availableQuantity still decrements in MongoDB) — but the WS client receives **no event**, and CS's terminal logs:
```
Failed to publish event RESOURCE_RESERVED (RabbitMQ unavailable?)
```
**Proves:** the core distributed-systems requirement for this step — a message-broker outage degrades only the live-update feature, never the underlying REST/DB operation. Restart RabbitMQ afterward:
```powershell
docker start local-rabbitmq
```

---

## 9. Known Limitations

| Limitation | Notes |
|---|---|
| Gateway's RabbitMQ queue is exclusive/auto-delete (not durable) | Correct for a live relay (Gateway only cares about events while connected); if you wanted an audit trail of missed events while the Gateway was down, a durable named queue would be needed — not required by this step |
| No reconnect/retry loop if RabbitMQ drops mid-run | The `connection.on('close')` handler nulls out the cached channel so the *next* publish/consume attempt will try to reconnect, but there's no active background retry timer. Acceptable for a mini-project demo; worth mentioning as a known simplification in the viva. |
| WebSocket clients aren't authenticated | `/ws/updates` accepts any connection with no JWT check. This matches the fact that these are read-only broadcast events with no sensitive per-user data (department + resource state only) — flag if you want JWT-gated WS connections added. |
| No frontend to actually visualize these events yet | Correctly out of scope — Phase 4 |
| RabbitMQ heartbeat/beacon for department liveness NOT implemented yet | This is Phase 3 Step 3 per your own Phase 1 plan ("Implement heartbeat module (RabbitMQ fanout + peer liveness table)") — a different concept from event publishing, correctly not attempted here |
| P2P availability check between services NOT implemented yet | Phase 3 Step 4 |

---

## 10. Verification Method (transparency note, same as previous steps)

No network or MongoDB/RabbitMQ access in this sandbox, so nothing here was run against a live broker or live WS connection. What I did verify, concretely:
- **Every file in the project** (`gateway`, `cs-service`, `it-service`, `entc-service`) passes `node --check` after these changes — confirmed by re-running the full syntax check, not assumed.
- **`sharedPath.resolve('messaging/...')` actually executes successfully** for all four services — I ran it and confirmed the failure point is exactly and only the missing `amqplib`/`ws` packages (proven by reading the Node `requireStack` in the error output), not a path or logic bug on my end.
- **Diffed the modified service files** against their pre-Step-2 versions to confirm every change is a pure addition (a `publish(...)` call after an existing `.save()`), with zero lines of existing reservation/borrow/resource logic altered.
- **Spot-checked** that REST routes, gRPC handlers, and controllers contain zero messaging code — the publish calls live only in the service layer, matching the layering you asked me to preserve.

Please run Sections 5–8 yourself and report back what breaks. Given RabbitMQ's `amqplib` and `ws` are both mature, widely-used packages and the integration pattern here mirrors the gRPC integration you already tested successfully in Step 1, I'd expect this to work cleanly — but "expect" is not "verified," and I want to keep being explicit about that distinction with you.
