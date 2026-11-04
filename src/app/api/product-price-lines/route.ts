import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cached } from "@/lib/cache";
import { categoryOrderLinesSQL } from "@/lib/queries/categorySales";
import { isPromoCoupon, loadCouponWindows, type OrderLineRow } from "@/lib/categoryFold";

/** 지난 기간은 바뀌지 않습니다 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** 오늘이 든 기간 — 주문이 계속 들어옵니다 */
const LIVE_CACHE_TTL_MS = 10 * 60 * 1000;

export const maxDuration = 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PRODUCT_CD = /^[A-Za-z0-9_-]{1,40}$/;
/** 카테고리 매출과 같은 상한 */
const MAX_DAYS = 400;

const num = (v: unknown) => Number(v) || 0;
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const days = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * 상품 하나의 주문별 판매 당시 가격 — 프로모션 센터 「카테고리 매출」 상위 상품 펼치기.
 *   GET /api/product-price-lines?start=YYYY-MM-DD&end=YYYY-MM-DD&product_cd=...
 *
 * 주문 라인에는 어느 기획전으로 팔렸는지가 믿을 만하게 남지 않아(group_cd 는 전시 중 상품 줄의 15% 만 채워짐),
 * 프로모션 센터가 주문 시각(at)과 승인 상품의 기획전 기간으로 나눕니다. 그래서 주문 번호·구매자 없이 시각과 금액만 줍니다.
 * partner_sales 는 반올림 전 값입니다 — 나눈 뒤 합이 상품 거래액과 맞도록 받는 쪽에서 반올림합니다.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const productCd = params.get("product_cd") ?? "";
  if (!YMD.test(start) || !YMD.test(end) || end < start) {
    return NextResponse.json({ error: "start, end (YYYY-MM-DD, start ≤ end) are required" }, { status: 400 });
  }
  if (days(start, end) > MAX_DAYS) {
    return NextResponse.json({ error: `period must be ${MAX_DAYS} days or less` }, { status: 400 });
  }
  if (!PRODUCT_CD.test(productCd)) {
    return NextResponse.json({ error: "product_cd is required" }, { status: 400 });
  }
  const ttl = end >= kstToday() ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS;

  try {
    const data = await cached(`product-price-lines:v1:${start}:${end}:${productCd}`, ttl, async () => {
      const [windows, rows] = await Promise.all([
        loadCouponWindows(),
        query<OrderLineRow>(categoryOrderLinesSQL({ start, end }, productCd)),
      ]);
      return {
        period: { start, end },
        product_cd: productCd,
        lines: rows
          .map((r) => {
            const promo = isPromoCoupon(r.coupon_master_seq, r.ordered_at, windows);
            return {
              at: r.ordered_at,
              partner_id: num(r.partner_id),
              brand_cd: r.brand_cd ?? "",
              qty: num(r.qty),
              partner_sales: num(r.partner_sales),
              list_amount: num(r.list_amount),
              sale_amount: num(r.sale_amount),
              promo_coupon: promo ? num(r.coupon) : 0,
              promo_coupon_qty: promo ? num(r.coupon_qty) : 0,
            };
          })
          .sort((a, b) => String(a.at).localeCompare(String(b.at))),
      };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Product price lines error:", e);
    return NextResponse.json({ error: "판매 당시 가격을 불러오지 못했습니다" }, { status: 500 });
  }
}
