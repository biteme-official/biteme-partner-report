import { cached } from "./cache";
import { query } from "./db";
import { categoryAssignSQL, categoryOrderLinesSQL, couponGroupWindowsSQL, type CategorySalesRange } from "./queries/categorySales";

/**
 * 카테고리 매출 접기 (#79) — 기간 쿼리가 준 (주문 × 상품) 줄과 상품 배정을 합쳐 상품별 합계·주문 수를 냅니다.
 * 응답 모양은 예전 SQL(상품 줄 GROUP BY + 주문 수 UNION ALL)과 같습니다.
 */

/** 배정은 상품 카테고리를 바꿀 때만 달라집니다 — 6시간 */
const ASSIGN_TTL_MS = 6 * 60 * 60 * 1000;

export interface Assignment {
  major: string | null;
  mid: string | null;
  small: string | null;
  repre_major: string | null;
}

interface AssignRow {
  product_cd: string;
  major: string | null;
  mid: string | null;
  small: string | null;
  repre_major: string | null;
}

const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown) => Number(v) || 0;

/** 상품 → 배정. 연결이 없는 상품은 맵에 없습니다(= 미지정) */
export function loadAssignments(): Promise<Map<string, Assignment>> {
  return cached("category-assign:v2", ASSIGN_TTL_MS, async () => {
    const rows = await query<AssignRow>(categoryAssignSQL());
    return new Map(
      rows.map((r) => [String(r.product_cd), { major: str(r.major), mid: str(r.mid), small: str(r.small), repre_major: str(r.repre_major) }])
    );
  });
}

/** 전시에 걸린 쿠폰의 기간은 하루 단위로 비교합니다 — 전시 등록이 바뀌어도 금방 따라가게 1시간만 담습니다 */
const COUPON_TTL_MS = 60 * 60 * 1000;

/** 쿠폰 마스터 → 그 쿠폰이 걸린 전시 기간들 */
export type CouponWindows = Map<string, { s: string; e: string }[]>;

export function loadCouponWindows(): Promise<CouponWindows> {
  return cached("category-coupon-windows:v1", COUPON_TTL_MS, async () => {
    const rows = await query<{ coupon_master_seq: number | string; s: string | null; e: string | null }>(couponGroupWindowsSQL());
    const out: CouponWindows = new Map();
    for (const r of rows) {
      if (!r.s || !r.e) continue;
      const k = String(r.coupon_master_seq);
      out.set(k, [...(out.get(k) ?? []), { s: r.s, e: r.e }]);
    }
    return out;
  });
}

/** 그 주문의 쿠폰이 주문 날짜에 진행 중인 전시에 걸린 쿠폰인지 — 일반 쿠폰(장바구니·등급·첫구매 등)은 false */
export function isPromoCoupon(masterSeq: number | string | null, orderedAt: string | null, windows: CouponWindows): boolean {
  if (masterSeq === null || !orderedAt) return false;
  const day = orderedAt.slice(0, 10);
  return (windows.get(String(masterSeq)) ?? []).some((w) => day >= w.s && day <= w.e);
}

export interface OrderLineRow {
  ocode: string;
  product_cd: string;
  product_nm: string | null;
  partner_id: number | string;
  partner_name: string | null;
  brand_cd: string | null;
  brand_nm: string | null;
  qty: number | string;
  sales: number | string;
  partner_sales: number | string;
  list_amount: number | string;
  sale_amount: number | string;
  coupon: number | string;
  coupon_qty: number | string;
  coupon_master_seq: number | string | null;
  ordered_at: string | null;
}

export interface FoldedProduct {
  product_cd: string;
  product_nm: string;
  partner_id: number;
  partner_name: string;
  brand_cd: string;
  brand_nm: string;
  major: string | null;
  mid: string | null;
  small: string | null;
  repre_major: string | null;
  order_count: number;
  qty: number;
  sales: number;
  partner_sales: number;
  /** 정가 × 수량 합 — 주문 당시 값 */
  list_amount: number;
  /** 판매가 × 수량 합 — 주문 당시 값, 쿠폰 차감 전, 옵션 추가금 제외 */
  sale_amount: number;
  /** 기획전에 걸린 쿠폰으로 깎인 금액 — 일반 쿠폰은 들어가지 않습니다 */
  promo_coupon: number;
  /** promo_coupon 이 쓰인 수량 */
  promo_coupon_qty: number;
}

export interface FoldedOrders {
  level: "all" | "major" | "mid" | "small";
  major: string | null;
  mid: string | null;
  small: string | null;
  order_count: number;
}

const NONE: Assignment = { major: null, mid: null, small: null, repre_major: null };

/**
 * (주문 × 상품) 줄 → 상품 × 위탁사 × 브랜드 합계와 주문 수(전체·대분류·대분류 × 중분류).
 * 금액 반올림은 상품 줄 단위 — 예전 SQL 의 ROUND(SUM()) 과 같은 자리에서 합니다.
 */
export function foldOrderLines(
  lines: OrderLineRow[],
  assign: Map<string, Assignment>,
  windows: CouponWindows
): { products: FoldedProduct[]; orders: FoldedOrders[] } {
  const products = new Map<string, FoldedProduct & { ocodes: Set<string> }>();
  const all = new Set<string>();
  const byMajor = new Map<string, Set<string>>();
  const byMid = new Map<string, { major: string | null; mid: string | null; ocodes: Set<string> }>();
  const bySmall = new Map<string, { major: string | null; mid: string | null; small: string; ocodes: Set<string> }>();

  for (const l of lines) {
    const cd = String(l.product_cd);
    const a = assign.get(cd) ?? NONE;
    const partnerId = num(l.partner_id);
    const brandCd = l.brand_cd ?? "";
    const key = `${cd}\u0000${partnerId}\u0000${brandCd}`;
    let p = products.get(key);
    if (!p) {
      p = {
        product_cd: cd,
        product_nm: l.product_nm ?? "",
        partner_id: partnerId,
        partner_name: l.partner_name ?? "",
        brand_cd: brandCd,
        brand_nm: l.brand_nm ?? "",
        major: a.major,
        mid: a.mid,
        small: a.small,
        repre_major: a.repre_major,
        order_count: 0,
        qty: 0,
        sales: 0,
        partner_sales: 0,
        list_amount: 0,
        sale_amount: 0,
        promo_coupon: 0,
        promo_coupon_qty: 0,
        ocodes: new Set(),
      };
      products.set(key, p);
    } else {
      // 예전 SQL 의 MAX(product_nm)·MAX(company_nm)·MAX(code_nm2) 와 같게 — 줄마다 다르면 사전순으로 큰 값
      if ((l.product_nm ?? "") > p.product_nm) p.product_nm = l.product_nm ?? "";
      if ((l.partner_name ?? "") > p.partner_name) p.partner_name = l.partner_name ?? "";
      if ((l.brand_nm ?? "") > p.brand_nm) p.brand_nm = l.brand_nm ?? "";
    }
    const ocode = String(l.ocode);
    p.ocodes.add(ocode);
    p.qty += num(l.qty);
    p.sales += num(l.sales);
    p.partner_sales += num(l.partner_sales);
    p.list_amount += num(l.list_amount);
    p.sale_amount += num(l.sale_amount);
    if (isPromoCoupon(l.coupon_master_seq, l.ordered_at, windows)) {
      p.promo_coupon += num(l.coupon);
      p.promo_coupon_qty += num(l.coupon_qty);
    }

    all.add(ocode);
    const mk = a.major ?? "";
    if (!byMajor.has(mk)) byMajor.set(mk, new Set());
    byMajor.get(mk)!.add(ocode);
    const dk = `${mk}\u0000${a.mid ?? ""}`;
    if (!byMid.has(dk)) byMid.set(dk, { major: a.major, mid: a.mid, ocodes: new Set() });
    byMid.get(dk)!.ocodes.add(ocode);
    if (a.small) {
      if (!bySmall.has(a.small)) bySmall.set(a.small, { major: a.major, mid: a.mid, small: a.small, ocodes: new Set() });
      bySmall.get(a.small)!.ocodes.add(ocode);
    }
  }

  return {
    products: [...products.values()].map(({ ocodes, ...p }) => ({
      ...p,
      order_count: ocodes.size,
      sales: Math.round(p.sales),
      partner_sales: Math.round(p.partner_sales),
      list_amount: Math.round(p.list_amount),
      sale_amount: Math.round(p.sale_amount),
      promo_coupon: Math.round(p.promo_coupon),
    })),
    orders: [
      { level: "all" as const, major: null, mid: null, small: null, order_count: all.size },
      ...[...byMajor].map(([mk, s]) => ({ level: "major" as const, major: mk || null, mid: null, small: null, order_count: s.size })),
      ...[...byMid.values()].map((v) => ({ level: "mid" as const, major: v.major, mid: v.mid, small: null, order_count: v.ocodes.size })),
      ...[...bySmall.values()].map((v) => ({ level: "small" as const, major: v.major, mid: v.mid, small: v.small, order_count: v.ocodes.size })),
    ],
  };
}

/** 기간 하나 — 배정(캐시)과 주문 라인(쿼리 한 번)을 같이 읽어 접습니다 */
export async function loadCategoryPeriod(range: CategorySalesRange) {
  const [assign, windows, lines] = await Promise.all([
    loadAssignments(),
    loadCouponWindows(),
    query<OrderLineRow>(categoryOrderLinesSQL(range)),
  ]);
  return foldOrderLines(lines, assign, windows);
}
