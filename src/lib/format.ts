export function formatNumber(n: number | string): string {
  return Number(n).toLocaleString("ko-KR");
}

export function formatCurrency(n: number | string): string {
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return formatNumber(num);
}
