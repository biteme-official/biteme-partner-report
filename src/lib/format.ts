export function formatNumber(n: number | string): string {
  const num = Number(n);
  return Number.isNaN(num) ? "0" : num.toLocaleString("ko-KR");
}
