/**
 * Minimal structured logger. Every log line is tagged with a service
 * name and an ISO timestamp so multi-service logs (viewed together via
 * `docker compose logs`) can be read as a single distributed trace.
 *
 * Example output:
 *   [2026-08-23T10:15:32.001Z] [Gateway] Login request received
 *   [2026-08-23T10:15:32.050Z] [CS] Resource search received
 */
function createLogger(serviceName) {
  const tag = `[${serviceName}]`;

  function timestamp() {
    return `[${new Date().toISOString()}]`;
  }

  return {
    info: (message, meta) => {
      if (meta !== undefined) {
        console.log(timestamp(), tag, message, meta);
      } else {
        console.log(timestamp(), tag, message);
      }
    },
    warn: (message, meta) => {
      if (meta !== undefined) {
        console.warn(timestamp(), tag, message, meta);
      } else {
        console.warn(timestamp(), tag, message);
      }
    },
    error: (message, meta) => {
      if (meta !== undefined) {
        console.error(timestamp(), tag, message, meta);
      } else {
        console.error(timestamp(), tag, message);
      }
    },
  };
}

module.exports = { createLogger };
