import { cached } from "./cache";
import { query } from "./db";
import { categoryAssignSQL, categoryOrderLinesSQL, type CategorySalesRange } from "./queries/categorySales";

/**
 * 카테고리 매출 접기 (#79) — 기간 쿼리가 준 (주문 × 상품) 줄과 상품 배정을 합쳐 상품별 합계·주문 수를 냅니다.
 * 응답 모양은 예전 SQL(상품 줄 GROUP BY + 주문 수 UNION ALL)과 같습니다.
 */

/** 배정은 상품 카테고리를 바꿀 때만 달라집니다 — 6시간 */
const ASSIGN_TTL_MS = 6 * 60 * 60 * 1000;

export interface Assignment {
  major: string | null;
  mid: string | null;
  repre_major: string | null;
}

interface AssignRow {
  product_cd: string;
  major: string | null;
  mid: string | null;
  repre_major: string | null;
}

const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown) => Number(v) || 0;

/** 상품 → 배정. 연결이 없는 상품은 맵에 없습니다(= 미지정) */
export function loadAssignments(): Promise<Map<string, Assignment>> {
  return cached("category-assign:v1", ASSIGN_TTL_MS, async () => {
    const rows = await query<AssignRow>(categoryAssignSQL());
    return new Map(
      rows.map((r) => [String(r.product_cd), { major: str(r.major), mid: str(r.mid), repre_major: str(r.repre_major) }])
    );
  });
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
  repre_major: string | null;
  order_count: number;
  qty: number;
  sales: number;
  partner_sales: number;
}

export interface FoldedOrders {
  level: "all" | "major" | "mid";
  major: string | null;
  mid: string | null;
  order_count: number;
}

const NONE: Assignment = { major: null, mid: null, repre_major: null };

/**
 * (주문 × 상품) 줄 → 상품 × 위탁사 × 브랜드 합계와 주문 수(전체·대분류·대분류 × 중분류).
 * 금액 반올림은 상품 줄 단위 — 예전 SQL 의 ROUND(SUM()) 과 같은 자리에서 합니다.
 */
export function foldOrderLines(lines: OrderLineRow[], assign: Map<string, Assignment>): { products: FoldedProduct[]; orders: FoldedOrders[] } {
  const products = new Map<string, FoldedProduct & { ocodes: Set<string> }>();
  const all = new Set<string>();
  const byMajor = new Map<string, Set<string>>();
  const byMid = new Map<string, { major: string | null; mid: string | null; ocodes: Set<string> }>();

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
        repre_major: a.repre_major,
        order_count: 0,
        qty: 0,
        sales: 0,
        partner_sales: 0,
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

    all.add(ocode);
    const mk = a.major ?? "";
    if (!byMajor.has(mk)) byMajor.set(mk, new Set());
    byMajor.get(mk)!.add(ocode);
    const dk = `${mk}\u0000${a.mid ?? ""}`;
    if (!byMid.has(dk)) byMid.set(dk, { major: a.major, mid: a.mid, ocodes: new Set() });
    byMid.get(dk)!.ocodes.add(ocode);
  }

  return {
    products: [...products.values()].map(({ ocodes, ...p }) => ({
      ...p,
      order_count: ocodes.size,
      sales: Math.round(p.sales),
      partner_sales: Math.round(p.partner_sales),
    })),
    orders: [
      { level: "all" as const, major: null, mid: null, order_count: all.size },
      ...[...byMajor].map(([mk, s]) => ({ level: "major" as const, major: mk || null, mid: null, order_count: s.size })),
      ...[...byMid.values()].map((v) => ({ level: "mid" as const, major: v.major, mid: v.mid, order_count: v.ocodes.size })),
    ],
  };
}

/** 기간 하나 — 배정(캐시)과 주문 라인(쿼리 한 번)을 같이 읽어 접습니다 */
export async function loadCategoryPeriod(range: CategorySalesRange) {
  const [assign, lines] = await Promise.all([loadAssignments(), query<OrderLineRow>(categoryOrderLinesSQL(range))]);
  return foldOrderLines(lines, assign);
}
