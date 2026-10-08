import { NextRequest, NextResponse } from "next/server";
import { queryBatch } from "@/lib/db";
import { cached } from "@/lib/cache";
import { parseProductRange } from "@/lib/productRange";
import {
  firstOrdersSQL,
  productCategoriesSQL,
  productStatusSQL,
  promoLinesSQL,
  siteBuyersSQL,
} from "@/lib/queries/promoInsights";

/** 같은 조건 재조회는 10분 동안 메모리에서 — product-daily 와 같습니다 */
const CACHE_TTL_MS = 10 * 60 * 1000;

type Num = number | string | null;

interface LineRow {
  ocode: string;
  user_id: string | null;
  d: string;
  h: Num;
  product_cd: string;
  qty: Num;
  sales: Num;
  coupon: Num;
  points: Num;
  order_path: string | null;
  member_grp_cd: Num;
  pet_type: string | null;
}
interface FirstRow {
  user_id: string;
  first_order: string | null;
  joined: string | null;
}
interface SiteRow {
  buyers: Num;
  new_buyers: Num;
}
interface CategoryRow {
  product_cd: string;
  category_nm: string;
  pet_type: string | null;
}
interface StatusRow {
  product_cd: string;
  product_state: string | null;
  display_yn: string | null;
  soldout_options: Num;
  soldout_first: string | null;
}

const n = (v: Num) => Number(v) || 0;

/** key 별로 더하기 — 결과는 sales 큰 순 */
function tally<K extends string>(
  rows: LineRow[],
  keyOf: (r: LineRow) => K
) {
  const m = new Map<K, { sales: number; qty: number; orders: Set<string>; buyers: Set<string> }>();
  for (const r of rows) {
    const k = keyOf(r);
    const a = m.get(k) ?? { sales: 0, qty: 0, orders: new Set<string>(), buyers: new Set<string>() };
    a.sales += n(r.sales);
    a.qty += n(r.qty);
    a.orders.add(r.ocode);
    if (r.user_id) a.buyers.add(r.user_id);
    m.set(k, a);
  }
  return [...m.entries()]
    .map(([key, a]) => ({ key, sales: Math.round(a.sales), qty: a.qty, orders: a.orders.size, buyers: a.buyers.size }))
    .sort((x, y) => y.sales - x.sales);
}

/**
 * 기획전 고객·운영 지표 — 프로모션 센터 「기획전 성과」 탭.
 *   POST /api/promo-insights  { start, end, productCds }  (product-daily 와 같은 입력)
 * start~end 는 **기획전 기간**(시작일~오늘 또는 종료일)을 줍니다 — 직전 비교 구간은 넣지 않습니다.
 *
 * 응답은 집계만 담습니다(회원 아이디 없음).
 *   summary   주문·구매자·신규(사이트 첫 주문)·기간 중 가입·재구매·쿠폰/적립금
 *   site      같은 기간 사이트 전체 회원 구매자와 신규 — 신규 비중 비교 기준
 *   daily     일자별 구매자·신규 구매자
 *   hours     시간대(0~23시)별 주문·매출
 *   paths     주문 경로(APP·MOBILE·WEB)별
 *   grades    회원 등급(member_grp_cd)별
 *   pets      반려동물 구분(상품 pet_type: 000 공용 · 001 강아지 · 002 고양이)별
 *   categories 대표 카테고리(1단계 × 반려동물)별 — 참여 상품 수 포함
 *   issues    지금 판매중이 아니거나 미노출이거나, 기간 중 옵션 품절이 난 참여 상품
 */
export async function POST(req: NextRequest) {
  let body: { start?: unknown; end?: unknown; productCds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body is required" }, { status: 400 });
  }
  const parsed = parseProductRange(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const range = parsed.range;
  const key = `promo-insights:${range.start}:${range.end}:${range.productCds.join(",")}`;

  try {
    const data = await cached(key, CACHE_TTL_MS, async () => {
      const [lines, firsts, site, cats, status] = await queryBatch<
        [LineRow[], FirstRow[], SiteRow[], CategoryRow[], StatusRow[]]
      >([
        promoLinesSQL(range),
        firstOrdersSQL(range),
        siteBuyersSQL(range),
        productCategoriesSQL(range.productCds),
        productStatusSQL(range),
      ]);

      const first = new Map(firsts.map((f) => [f.user_id, f]));
      const isNewOn = (user: string, day: string) => first.get(user)?.first_order === day;
      const isNew = (user: string) => (first.get(user)?.first_order ?? "") >= range.start;
      const joinedInPeriod = (user: string) => (first.get(user)?.joined ?? "") >= range.start;

      // 구매자(회원)별 주문 수 — 기간 중 두 번 이상 산 사람
      const ordersByUser = new Map<string, Set<string>>();
      const orders = new Set<string>();
      const couponOrders = new Set<string>();
      let sales = 0;
      let qty = 0;
      let coupon = 0;
      let points = 0;
      for (const r of lines) {
        orders.add(r.ocode);
        sales += n(r.sales);
        qty += n(r.qty);
        coupon += n(r.coupon);
        points += n(r.points);
        if (n(r.coupon) > 0) couponOrders.add(r.ocode);
        if (r.user_id) {
          const s = ordersByUser.get(r.user_id) ?? new Set<string>();
          s.add(r.ocode);
          ordersByUser.set(r.user_id, s);
        }
      }
      const buyers = [...ordersByUser.keys()];

      const byDay = new Map<string, { buyers: Set<string>; newBuyers: Set<string> }>();
      for (const r of lines) {
        if (!r.user_id) continue;
        const a = byDay.get(r.d) ?? { buyers: new Set<string>(), newBuyers: new Set<string>() };
        a.buyers.add(r.user_id);
        if (isNewOn(r.user_id, r.d)) a.newBuyers.add(r.user_id);
        byDay.set(r.d, a);
      }

      const catOf = new Map(cats.map((c) => [c.product_cd, c]));
      const productsPerCategory = new Map<string, number>();
      for (const cd of range.productCds) {
        const c = catOf.get(cd);
        const k = c ? `${c.category_nm}|${c.pet_type ?? ""}` : "(미분류)|";
        productsPerCategory.set(k, (productsPerCategory.get(k) ?? 0) + 1);
      }
      const categorySales = new Map(
        tally<string>(lines, (r) => {
          const c = catOf.get(r.product_cd);
          return c ? `${c.category_nm}|${c.pet_type ?? ""}` : "(미분류)|";
        }).map((t) => [t.key, t])
      );

      return {
        period: { start: range.start, end: range.end },
        summary: {
          orders: orders.size,
          buyers: buyers.length,
          newBuyers: buyers.filter(isNew).length,
          joinedBuyers: buyers.filter(joinedInPeriod).length,
          repeatBuyers: buyers.filter((u) => (ordersByUser.get(u)?.size ?? 0) >= 2).length,
          sales: Math.round(sales),
          qty,
          lines: lines.length,
          coupon: Math.round(coupon),
          points: Math.round(points),
          couponOrders: couponOrders.size,
        },
        site: { buyers: n(site[0]?.buyers ?? 0), newBuyers: n(site[0]?.new_buyers ?? 0) },
        daily: [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, a]) => ({ date, buyers: a.buyers.size, newBuyers: a.newBuyers.size })),
        hours: tally(lines, (r) => String(n(r.h)))
          .map(({ key, orders: o, sales: s }) => ({ hour: Number(key), orders: o, sales: s }))
          .sort((a, b) => a.hour - b.hour),
        paths: tally(lines, (r) => r.order_path || "기타").map(({ key, orders: o, sales: s, buyers: b }) => ({
          path: key,
          orders: o,
          sales: s,
          buyers: b,
        })),
        grades: tally(lines.filter((r) => r.user_id), (r) => String(r.member_grp_cd ?? "")).map(
          ({ key, buyers: b, sales: s, orders: o }) => ({ grade: key, buyers: b, orders: o, sales: s })
        ),
        pets: tally(lines, (r) => r.pet_type || "000").map(({ key, sales: s, qty: q, orders: o }) => ({
          pet: key,
          sales: s,
          qty: q,
          orders: o,
        })),
        categories: [...productsPerCategory.entries()]
          .map(([k, products]) => {
            const [category, pet] = k.split("|");
            const t = categorySales.get(k);
            return { category, pet, products, sales: t?.sales ?? 0, qty: t?.qty ?? 0, orders: t?.orders ?? 0 };
          })
          .sort((a, b) => b.sales - a.sales || b.products - a.products),
        issues: status.map((s) => ({
          product_cd: s.product_cd,
          state: String(s.product_state ?? ""),
          display: s.display_yn === "Y",
          soldoutOptions: n(s.soldout_options),
          soldoutFirst: s.soldout_first,
        })),
      };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Promo insights error:", e);
    return NextResponse.json({ error: "기획전 고객·운영 지표를 불러오지 못했습니다" }, { status: 500 });
  }
}
