import { useEffect, useRef, useState } from 'react';

const getGatewayWsUrl = () => {
  if (import.meta.env.VITE_GATEWAY_WS_URL) {
    return import.meta.env.VITE_GATEWAY_WS_URL;
  }

  const protocol =
    window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  return `${protocol}//${window.location.host}/ws/updates`;
};

const GATEWAY_WS_URL = getGatewayWsUrl();

/**
 * Connects directly to the Gateway's existing WebSocket relay. The
 * frontend never opens its own connection to RabbitMQ - that would
 * violate the locked architecture (Gateway owns the WS relay).
 * Keeps the last N events for display on the Live Updates feed and
 * the Distributed System Visualization page.
 */
export function useLiveEvents(maxEvents = 25) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(GATEWAY_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        setEvents((prev) => [parsed, ...prev].slice(0, maxEvents));
      } catch {
        // Ignore malformed frames - never crash the UI over one bad message.
      }
    };

    return () => ws.close();
  }, [maxEvents]);

  return { events, connected };
}
