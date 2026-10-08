import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { cached } from "@/lib/cache";
import { dailyTotalsSQL, productDailySalesSQL } from "@/lib/queries/productDaily";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PRODUCT_CD = /^[A-Za-z0-9_-]{1,40}$/;
/** 기획전 한 개의 참여 상품 수 상한 — 10월 메인기획전이 6,467개였습니다 */
const MAX_PRODUCTS = 10000;
/** 한 번에 볼 수 있는 일수 — 기획전 기간 + 직전 비교 구간이면 충분합니다 */
const MAX_DAYS = 120;
/** 같은 조건 재조회는 10분 동안 메모리에서 — 탭을 오갈 때마다 운영 DB 를 두드리지 않게 */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface ProductRow {
  d: string;
  product_cd: string;
  order_count: number | string;
  qty: number | string;
  sales: number | string;
}

interface TotalRow {
  d: string;
  site_sales: number | string;
  site_orders: number | string;
  promo_sales: number | string;
  promo_orders: number | string;
}

const days = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * 상품 묶음의 일자별 매출 — 프로모션 센터 「기획전 성과」 탭.
 *   POST /api/product-daily  { start: "YYYY-MM-DD", end: "YYYY-MM-DD", productCds: string[] }
 * 상품 코드가 수천 개라 쿼리스트링에 담을 수 없어 POST 로 받습니다(조회 전용).
 * 응답의 products 는 매출이 있는 (상품, 일자)만 담고, totals 는 주문이 있는 날마다 한 줄입니다.
 */
export async function POST(req: NextRequest) {
  let body: { start?: unknown; end?: unknown; productCds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body is required" }, { status: 400 });
  }
  const start = String(body.start ?? "");
  const end = String(body.end ?? "");
  if (!YMD.test(start) || !YMD.test(end) || end < start) {
    return NextResponse.json(
      { error: "start, end (YYYY-MM-DD, start ≤ end) are required" },
      { status: 400 }
    );
  }
  if (days(start, end) > MAX_DAYS) {
    return NextResponse.json({ error: `period must be ${MAX_DAYS} days or less` }, { status: 400 });
  }
  if (!Array.isArray(body.productCds)) {
    return NextResponse.json({ error: "productCds must be an array" }, { status: 400 });
  }
  const productCds = [...new Set(body.productCds.map((c) => String(c).trim()))].filter(Boolean);
  if (!productCds.length || productCds.length > MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `productCds must have 1~${MAX_PRODUCTS} items` },
      { status: 400 }
    );
  }
  const bad = productCds.find((c) => !PRODUCT_CD.test(c));
  if (bad) {
    return NextResponse.json({ error: `invalid product code "${bad}"` }, { status: 400 });
  }

  const range = { start, end, productCds: productCds.sort() };
  const key = `product-daily:${start}:${end}:${range.productCds.join(",")}`;

  try {
    const data = await cached(key, CACHE_TTL_MS, async () => {
      const [products, totals] = await queryBatch<[ProductRow[], TotalRow[]]>([
        productDailySalesSQL(range),
        dailyTotalsSQL(range),
      ]);
      return {
        period: { start, end },
        products: products.map((r) => ({
          date: String(r.d),
          product_cd: String(r.product_cd),
          order_count: Number(r.order_count) || 0,
          qty: Number(r.qty) || 0,
          sales: Number(r.sales) || 0,
        })),
        totals: totals.map((r) => ({
          date: String(r.d),
          site_sales: Number(r.site_sales) || 0,
          site_orders: Number(r.site_orders) || 0,
          promo_sales: Number(r.promo_sales) || 0,
          promo_orders: Number(r.promo_orders) || 0,
        })),
      };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Product daily sales error:", e);
    return NextResponse.json({ error: "상품 일자별 매출을 불러오지 못했습니다" }, { status: 500 });
  }
}
