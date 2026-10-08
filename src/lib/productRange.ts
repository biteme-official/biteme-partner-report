import type { ProductDailyRange } from "./queries/productDaily";

/**
 * 「기획전 성과」 API 공용 입력 검사 — { start, end, productCds } (POST body).
 * 상품 코드가 수천 개라 쿼리스트링에 담을 수 없어 POST 로 받습니다(조회 전용).
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PRODUCT_CD = /^[A-Za-z0-9_-]{1,40}$/;
/** 기획전 한 개의 참여 상품 수 상한 — 10월 메인기획전이 6,467개였습니다 */
const MAX_PRODUCTS = 10000;
/** 한 번에 볼 수 있는 일수 — 기획전 기간 + 직전 비교 구간이면 충분합니다 */
const MAX_DAYS = 120;

const days = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

export function parseProductRange(
  body: { start?: unknown; end?: unknown; productCds?: unknown } | null
): { ok: true; range: ProductDailyRange } | { ok: false; error: string } {
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  if (!YMD.test(start) || !YMD.test(end) || end < start) {
    return { ok: false, error: "start, end (YYYY-MM-DD, start ≤ end) are required" };
  }
  if (days(start, end) > MAX_DAYS) {
    return { ok: false, error: `period must be ${MAX_DAYS} days or less` };
  }
  if (!Array.isArray(body?.productCds)) {
    return { ok: false, error: "productCds must be an array" };
  }
  const productCds = [...new Set(body.productCds.map((c) => String(c).trim()))].filter(Boolean);
  if (!productCds.length || productCds.length > MAX_PRODUCTS) {
    return { ok: false, error: `productCds must have 1~${MAX_PRODUCTS} items` };
  }
  const bad = productCds.find((c) => !PRODUCT_CD.test(c));
  if (bad) return { ok: false, error: `invalid product code "${bad}"` };
  return { ok: true, range: { start, end, productCds: productCds.sort() } };
}
