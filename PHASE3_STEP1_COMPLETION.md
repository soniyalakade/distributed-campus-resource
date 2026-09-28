# Phase 3 — Step 1: gRPC Resource Search — Completion Report

## 1. Final Changed-File List

**Added:**
```
proto/resource.proto

gateway/src/grpc/protoPath.js
gateway/src/grpc/client.js
gateway/src/services/grpcNodeRegistry.js
gateway/src/services/grpcSearchAggregator.js

services/cs-service/src/grpc/protoPath.js
services/cs-service/src/grpc/grpcAuth.js
services/cs-service/src/grpc/searchHandler.js
services/cs-service/src/grpc/server.js

services/it-service/src/grpc/protoPath.js
services/it-service/src/grpc/grpcAuth.js
services/it-service/src/grpc/searchHandler.js
services/it-service/src/grpc/server.js

services/entc-service/src/grpc/protoPath.js
services/entc-service/src/grpc/grpcAuth.js
services/entc-service/src/grpc/searchHandler.js
services/entc-service/src/grpc/server.js
```

**Modified (minimally, additively):**
```
gateway/src/controllers/resourceController.js   -> added searchGrpc(), existing search() untouched
gateway/src/routes/resourceRoutes.js             -> added GET /search-grpc route, existing routes untouched
gateway/package.json                             -> added @grpc/grpc-js, @grpc/proto-loader
gateway/.env.example                             -> added CS/IT/ENTC_GRPC_ADDRESS

services/cs-service/src/server.js                -> added startGrpcServer() call alongside app.listen()
services/cs-service/package.json                 -> added @grpc/grpc-js, @grpc/proto-loader
services/cs-service/.env.example                 -> added GRPC_PORT=6001

services/it-service/src/server.js                -> same pattern, GRPC_PORT=6002
services/it-service/package.json                 -> same
services/it-service/.env.example                 -> same

services/entc-service/src/server.js              -> same pattern, GRPC_PORT=6003
services/entc-service/package.json               -> same
services/entc-service/.env.example                -> same

.env.example (root reference)                    -> added GRPC port/address documentation
```

**Untouched (verified by inspection before editing, confirmed still intact):**
```
POST /api/auth/login                    - unchanged
GET  /api/resources/search              - unchanged (still REST fan-out via searchAggregator.js)
GET  /api/resources/:id                 - unchanged
All reservation endpoints               - unchanged
All health endpoints                    - unchanged
```

---

## 2. Architecture

```
                     ┌─────────────────────────────┐
                     │          Gateway             │
                     │                               │
   REST (existing)   │  GET /api/resources/search    │──► searchAggregator.js ──► REST fan-out (axios)
   ────────────────► │                               │
                     │  GET /api/resources/search-grpc│──► grpcSearchAggregator.js ──► gRPC fan-out
   gRPC (NEW)        │                               │         │
   ────────────────► │                               │         ▼
                     └───────────────┬───────────────┘   gateway/src/grpc/client.js
                                     │                    (loads proto once, caches
                                     │                     one client stub per node)
                        ┌────────────┼────────────┐
                        ▼            ▼            ▼
                 CS:6001 gRPC  IT:6002 gRPC  ENTC:6003 gRPC
                        │            │            │
                 CS:5001 REST  IT:5002 REST  ENTC:5003 REST
                  (unchanged)   (unchanged)   (unchanged)
                        │            │            │
                    cs_db         it_db        entc_db
```

Each department service now runs **two listeners in one process**: the existing Express/REST app on its original port, and a new gRPC server on `REST_PORT + 1000` (6001/6002/6003). Both are started from the same `server.js`, after the MongoDB connection succeeds, so a Mongo connection failure still prevents both from starting (consistent with existing behavior).

The gRPC `SearchResource` handler in each service calls the exact same `resourceService.searchResourcesByName()` function the REST endpoint already calls — same Mongoose query, same database. This is why Test E (below) should show identical numbers to your existing working REST search.

---

## 3. gRPC Request/Response Flow

```
1. Client (curl/Postman) -> GET /api/resources/search-grpc?name=Arduino
                             Authorization: Bearer <JWT>

2. Gateway (resourceController.searchGrpc)
   -> grpcSearchAggregator.searchAcrossNodesGrpc(name, authHeader)

3. For each of CS/IT/ENTC concurrently (Promise.allSettled):
   -> gateway/src/grpc/client.js gets/creates a cached ResourceService client
      for that node's address (e.g. localhost:6001)
   -> Builds grpc.Metadata with 'authorization': '<same Bearer header>'
   -> Sets a 2000ms deadline
   -> Calls client.SearchResource({ query, requestingNodeId: 'Gateway' }, metadata, { deadline }, callback)

4. On the department service side (e.g. CS):
   -> grpc/searchHandler.js.searchResource(call, callback) receives the call
   -> verifyGrpcAuth(call) reads call.metadata.get('authorization'),
      verifies the JWT with the SAME process.env.JWT_SECRET as REST
      -> if invalid/missing: responds { status: UNAUTHORIZED, errorMessage }
   -> resourceService.searchResourcesByName(query) queries THIS node's
      own MongoDB (cs_db for CS, it_db for IT, entc_db for ENTC)
   -> Maps Mongoose documents to ResourceInfo messages, sums totalAvailable
   -> responds { status: SUCCESS, department, matches[], totalAvailable }

5. Back at the Gateway, each settled outcome is classified:
   -> fulfilled + status SUCCESS       -> counted into totalAvailable, added to results
   -> fulfilled + status UNAUTHORIZED  -> added to results with error: 'unauthorized', node marked unreachable
   -> fulfilled + status INTERNAL_ERROR-> added to results with error: 'internal_error', node marked unreachable
   -> rejected (network failure)       -> distinguishes DEADLINE_EXCEEDED (timeout) from
                                           other transport errors (unreachable/connection refused)

6. Gateway returns the same overall shape as the existing REST search
   response: { resource, results[], totalAvailable, nodesUnreachable[] }
```

---

## 4. Install New Dependencies

You already have `node_modules` installed from Phase 2. Just install the two new packages in all four services:

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

Update your **four `.env` files** (not just `.env.example`) to add the new variables — copy these lines in:

```
# gateway/.env - add:
CS_GRPC_ADDRESS=localhost:6001
IT_GRPC_ADDRESS=localhost:6002
ENTC_GRPC_ADDRESS=localhost:6003

# services/cs-service/.env - add:
GRPC_PORT=6001

# services/it-service/.env - add:
GRPC_PORT=6002

# services/entc-service/.env - add:
GRPC_PORT=6003
```

---

## 5. PowerShell Commands — Start Services

Open **4 separate PowerShell windows**:

```powershell
# Window 1 - Gateway
cd distributed-campus-resource\gateway
npm start
```

```powershell
# Window 2 - CS
cd distributed-campus-resource\services\cs-service
npm start
```

```powershell
# Window 3 - IT
cd distributed-campus-resource\services\it-service
npm start
```

```powershell
# Window 4 - ENTC
cd distributed-campus-resource\services\entc-service
npm start
```

**Expected new log lines** (in addition to the existing REST "listening on port" lines you already see):
```
[CS] gRPC server listening on port 6001
[IT] gRPC server listening on port 6002
[ENTC] gRPC server listening on port 6003
```

---

## 6. Test Commands

You'll need a valid JWT from your existing working login. In PowerShell:

```powershell
$body = @{ email = "csadmin@campus.edu"; password = "pass1234" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.token
Write-Host $token
```

### Test D — Gateway distributed search using gRPC (primary test)

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/resources/search-grpc?name=Arduino" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```

### Test E — Verify results match your existing working REST search

```powershell
# REST (existing, should be unchanged)
Invoke-RestMethod -Uri "http://localhost:4000/api/resources/search?name=Arduino" `
  -Method Get -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5

# gRPC (new) - compare totals
Invoke-RestMethod -Uri "http://localhost:4000/api/resources/search-grpc?name=Arduino" `
  -Method Get -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```

**Expected (based on your reported working state):**
- CS → available 2 (Arduino Uno)
- IT → 0 (or its actual current matches)
- ENTC → 0 (or its actual current matches)
- Both REST and gRPC responses should show the same `totalAvailable` and per-department numbers — the `matches` field shape differs slightly (gRPC field names are camelCase per the .proto, matching your existing Mongoose field names exactly, so this should be a non-issue) but the quantities must agree.

### Test F — Fault tolerance (stop IT, verify Gateway doesn't crash)

```powershell
# In IT's PowerShell window, press Ctrl+C to stop it

# Then run the gRPC search again from any other window:
Invoke-RestMethod -Uri "http://localhost:4000/api/resources/search-grpc?name=Arduino" `
  -Method Get -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```

**Expected:**
```json
{
  "resource": "Arduino",
  "results": [
    { "department": "CS", "available": 2, "matches": [ ... ] },
    { "department": "IT", "available": null, "matches": [], "error": "unreachable" },
    { "department": "ENTC", "available": 0, "matches": [] }
  ],
  "totalAvailable": 2,
  "nodesUnreachable": ["IT"]
}
```
The Gateway process must still be running and responsive after this — check its PowerShell window has no crash/stack trace.

Restart IT afterward:
```powershell
cd distributed-campus-resource\services\it-service
npm start
```

### Tests A/B/C — Direct gRPC calls per department (optional, requires a gRPC client tool)

PowerShell has no built-in gRPC client, so the cleanest direct-gRPC test is via a tool like **grpcurl** (if you have it) or **Postman's gRPC request type** (Postman supports gRPC natively since v9). Using Postman:

1. New request → type **gRPC**
2. Server URL: `localhost:6001` (CS), `localhost:6002` (IT), `localhost:6003` (ENTC)
3. Import `proto/resource.proto` as the service definition
4. Method: `ResourceService/SearchResource`
5. Message: `{ "query": "Arduino", "requestingNodeId": "manual-test" }`
6. Metadata: add key `authorization`, value `Bearer <token>`
7. Invoke

If you don't have Postman's gRPC support or grpcurl installed, **Test D (Gateway fan-out) already exercises all three direct connections** — a per-node failure in Test D's `results` array tells you exactly which direct connection is broken, so Tests A/B/C are covered indirectly. Let me know if you want a small standalone Node.js test script instead — I can add one without touching any Phase 2/3 production code.

---

## 7. Known Limitations

| Limitation | Notes |
|---|---|
| No gRPC deadline retry — a timed-out node is reported once, not retried | Acceptable for Step 1 scope; retries could be added in a later step if useful for the viva |
| Gateway's `GET /api/resources/:id` and reservation/borrow/return endpoints still use REST only | Per your Step 1 scope (only SearchResource in gRPC) — extending gRPC to those is not part of this step |
| gRPC and REST search responses have slightly different match-object shapes (gRPC `ResourceInfo` proto fields vs. raw Mongoose documents from REST) | Both carry the same underlying data (availableQuantity, name, etc.); the difference is presentation, not data. Worth mentioning in the viva as a natural artifact of the proto contract being intentionally minimal. |
| No connection retry/backoff if a department's gRPC server isn't up yet when Gateway starts | The client is created lazily on first search call, not at Gateway startup, so this isn't actually a problem in practice — confirmed by reading `client.js`'s cache-on-first-use logic — but worth testing explicitly if you start Gateway before the department services. |
| Dockerfiles not yet updated to copy `proto/` into the image | Correctly out of scope — Docker work belongs to Phase 5 per your explicit "do NOT add Docker yet" instruction. The `protoPath.js` resolvers already anticipate the future Docker layout (`proto/` as a sibling of `src/`) so no rework should be needed later. |
| No RabbitMQ, heartbeat, Bully election, or Lamport/vector clocks | Correctly absent, per your explicit scope for this step |

---

## 8. Two Bugs Caught and Fixed During This Step (transparency note)

While building the `protoPath.js` resolvers, I made a folder-depth mistake identical in kind to the one from Phase 2's `sharedPath.js` (miscounted `../` levels between `services/<dept>-service/src/grpc/` and the monorepo-root `proto/`), and separately introduced the same `*/`-inside-a-comment bug that breaks a JS block comment. Both were caught **by actually executing `resolveProtoPath()` in Node for all four services** rather than eyeballing the code, and both are now fixed and verified to resolve to the correct file for CS, IT, ENTC, and Gateway.

I'm flagging this so you know these were caught before being handed to you, not something you'll hit — but also so you know my "verified" claims in this document mean "syntax-checked and path-resolution-tested," not "ran against live MongoDB + live gRPC calls," since I still have no network/MongoDB access in this sandbox. Please run Section 5 and 6 yourself and report back anything that doesn't match.
