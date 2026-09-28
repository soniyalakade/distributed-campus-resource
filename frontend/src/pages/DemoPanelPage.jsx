import { useState } from 'react';
import { searchResources, searchResourcesGrpc, getHeartbeat, getNodesHealth } from '../api/endpoints';
import StatusBadge from '../components/StatusBadge';

function NotImplementedTest({ title, description }) {
  return (
    <div className="demo-test">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="notice-banner">
        Not yet implemented - this is a Phase 6 feature. This panel intentionally does not simulate or fake
        the result, per the project's rule against cosmetic distributed-algorithm demonstrations.
      </div>
    </div>
  );
}

export default function DemoPanelPage() {
  const [searchName, setSearchName] = useState('Arduino');
  const [restResult, setRestResult] = useState(null);
  const [grpcResult, setGrpcResult] = useState(null);
  const [searchError, setSearchError] = useState(null);

  const [heartbeat, setHeartbeat] = useState(null);
  const [health, setHealth] = useState(null);
  const [stateError, setStateError] = useState(null);

  async function runTest1() {
    setSearchError(null);
    try {
      const [rest, grpc] = await Promise.all([searchResourcesGrpc(searchName), searchResources(searchName)]);
      setGrpcResult(rest);
      setRestResult(grpc);
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Search test failed');
    }
  }

  async function runTest4And5() {
    setStateError(null);
    try {
      const [hb, hc] = await Promise.all([getHeartbeat(), getNodesHealth()]);
      setHeartbeat(hb);
      setHealth(hc);
    } catch (err) {
      setStateError(err.response?.data?.error || 'Could not fetch distributed state');
    }
  }

  return (
    <div className="page">
      <h1>Demo Panel</h1>

      <div className="demo-test">
        <h3>Test 1 — Distributed Search (REST + gRPC)</h3>
        <p>Runs the same search through both the REST fan-out and the gRPC fan-out and shows both results.</p>
        <div className="inline-form">
          <input value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          <button onClick={runTest1}>Run Test</button>
        </div>
        {searchError && <div className="error-banner">{searchError}</div>}
        {restResult && grpcResult && (
          <div className="dept-columns">
            <div className="dept-column">
              <h4>REST result</h4>
              <pre>{JSON.stringify(restResult, null, 2)}</pre>
            </div>
            <div className="dept-column">
              <h4>gRPC result</h4>
              <pre>{JSON.stringify(grpcResult, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <NotImplementedTest
        title="Test 2 — Ricart-Agrawala Mutual Exclusion"
        description="Demonstrates two simultaneous reservation requests racing for the last unit, serialized by real mutual exclusion."
      />

      <NotImplementedTest
        title="Test 3 — Bully Leader Election"
        description="Demonstrates coordinator failure and re-election among CS/IT/ENTC by priority."
      />

      <div className="demo-test">
        <h3>Test 4 — Fault Tolerance (live heartbeat + health)</h3>
        <p>Fetches the real, current heartbeat and health state for CS/IT/ENTC. Stop a department service and re-run to see it reported as DEAD/DOWN.</p>
        <button onClick={runTest4And5}>Check Now</button>
        {stateError && <div className="error-banner">{stateError}</div>}
        {heartbeat && (
          <table className="data-table">
            <thead>
              <tr><th>Department</th><th>Health</th><th>Heartbeat</th></tr>
            </thead>
            <tbody>
              {['CS', 'IT', 'ENTC'].map((dept) => (
                <tr key={dept}>
                  <td>{dept}</td>
                  <td><StatusBadge status={health?.find((h) => h.department === dept)?.status} /></td>
                  <td><StatusBadge status={heartbeat.peers?.[dept]?.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="demo-test">
        <h3>Test 5 — Global Distributed State</h3>
        <p>The raw aggregated state from the Gateway - the same data source as Test 4, shown here as the "global view" a coordinator would eventually build on.</p>
        {heartbeat && health ? (
          <pre>{JSON.stringify({ heartbeat, health }, null, 2)}</pre>
        ) : (
          <p className="muted">Run Test 4 above to populate this view.</p>
        )}
      </div>
    </div>
  );
}
