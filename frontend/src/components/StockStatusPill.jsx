export function deriveStockStatus(resource) {
  if (resource.availableQuantity <= 0 && resource.totalQuantity > 0) {
    return 'Out of Stock';
  }
  if (resource.availableQuantity > 0 && resource.availableQuantity <= Math.max(1, Math.ceil(resource.totalQuantity * 0.2))) {
    return 'Low Stock';
  }
  if (resource.availableQuantity > 0) {
    return 'Available';
  }
  return 'Unavailable';
}

const STATUS_CLASS = {
  Available: 'pill pill-green',
  'Low Stock': 'pill pill-amber',
  'Out of Stock': 'pill pill-red',
  Unavailable: 'pill pill-gray',
};

export default function StockStatusPill({ resource }) {
  const status = deriveStockStatus(resource);
  return <span className={STATUS_CLASS[status] || 'pill pill-gray'}>{status}</span>;
}
