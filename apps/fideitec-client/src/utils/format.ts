export function formatCurrency(amount: number, currency = 'USD'): string {
  if (!amount && amount !== 0) return '$0';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const sym = currency === 'ARS' ? 'AR$' : '$';
    return `${sym} ${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

export function formatNumber(num: number): string {
  if (!num && num !== 0) return '0';
  try {
    return new Intl.NumberFormat('es-AR').format(num);
  } catch {
    return String(num);
  }
}

export function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return s?.slice(0, 10) ?? '-';
  }
}

export function formatDateLong(s: string): string {
  try {
    return new Date(s).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s?.slice(0, 16) ?? '-';
  }
}
