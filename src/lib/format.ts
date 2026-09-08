export function formatNumber(n: number | string): string {
  const num = Number(n);
  return Number.isNaN(num) ? "0" : num.toLocaleString("ko-KR");
}

// 축·요약용 짧은 금액 표기 (억/만)
export function formatWonShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatRate(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
