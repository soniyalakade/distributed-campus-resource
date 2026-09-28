const COLORS = {
  ALIVE: '#1a7f37',
  UP: '#1a7f37',
  DEAD: '#c62828',
  DOWN: '#c62828',
  UNREACHABLE: '#c62828',
  UNKNOWN: '#9e9e9e',
};

export default function StatusBadge({ status }) {
  const color = COLORS[status] || '#9e9e9e';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: color,
      }}
    >
      {status || 'UNKNOWN'}
    </span>
  );
}
