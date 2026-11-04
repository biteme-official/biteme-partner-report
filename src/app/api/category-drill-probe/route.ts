import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { categoryAssignSQL } from "@/lib/queries/categorySales";
import { salesLinesSQL } from "@/lib/queries/salesLines";

/**
 * 🔴 임시 조사용 — 머지 금지. 확인이 끝나면 브랜치째 지웁니다.
 * 칼럼 이름과 건수·비율만 돌려주고, 상품·주문·금액 값은 내지 않습니다. 읽기 전용입니다.
 *   GET /api/category-drill-probe?section=columns|categories|sold|price
 */
export const maxDuration = 60;

const TABLES = ["wt_order_product", "wt_product_category", "wt_category", "wt_product_trg_log"];

const ymd = (daysAgo: number) => new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);

async function columns() {
  const out: Record<string, { field: string; type: string }[]> = {};
  for (const t of TABLES) {
    const rows = await query<{ Field: string; Type: string }>(`SHOW COLUMNS FROM ${t}`);
    out[t] = rows.map((r) => ({ field: r.Field, type: r.Type }));
  }
  return out;
}

async function categories() {
  const codeLengths = await query(`
    SELECT CHAR_LENGTH(category_cd) AS len, \`level\` AS lvl, COUNT(*) AS n
    FROM wt_category GROUP BY len, lvl ORDER BY len, lvl`);
  const linkLengths = await query(`
    SELECT CHAR_LENGTH(IFNULL(category3_cd, '')) AS len, COUNT(*) AS n, SUM(repre_category_yn = 'Y') AS repre
    FROM wt_product_category GROUP BY len ORDER BY len`);
  const prefix = await query(`
    SELECT COUNT(*) AS n, SUM(LEFT(category3_cd, CHAR_LENGTH(category2_cd)) = category2_cd) AS under_mid
    FROM wt_product_category
    WHERE IFNULL(category3_cd, '') <> '' AND IFNULL(category2_cd, '') <> ''`);
  return { codeLengths, linkLengths, prefix };
}

/** 최근 90일 판매 상품 — 대분류별 중분류·소분류 지정 상태. 금액은 비율로만 */
async function sold() {
  const lines = salesLinesSQL({ fromStr: `${ymd(90)} 00:00:00`, toStr: `${ymd(1)} 23:59:59` });
  return query(`
    SELECT
      x.major,
      COUNT(*) AS products,
      SUM(x.mid IS NOT NULL) AS with_mid,
      SUM(x.small IS NOT NULL) AS with_small,
      SUM(x.has_kids = 1) AS under_mid_with_kids,
      SUM(x.has_kids = 1 AND x.small IS NULL) AS missing_small,
      ROUND(SUM(IF(x.mid IS NOT NULL, x.ps, 0)) / NULLIF(SUM(x.ps), 0), 4) AS mid_sales_ratio,
      ROUND(SUM(IF(x.small IS NOT NULL, x.ps, 0)) / NULLIF(SUM(x.ps), 0), 4) AS small_sales_ratio,
      ROUND(SUM(IF(x.has_kids = 1 AND x.small IS NULL, x.ps, 0)) / NULLIF(SUM(x.ps), 0), 4) AS missing_small_sales_ratio
    FROM (
      SELECT
        a.product_cd,
        a.major,
        a.mid,
        s.ps,
        MIN(IF(pc.category1_cd = a.major AND pc.category2_cd = a.mid AND IFNULL(pc.category3_cd, '') <> '', pc.category3_cd, NULL)) AS small,
        MAX(IF(kids.mid IS NULL, 0, 1)) AS has_kids
      FROM (
        SELECT l.product_cd, SUM(l.partner_sales) AS ps FROM (${lines}) l GROUP BY l.product_cd
      ) s
      JOIN (${categoryAssignSQL()}) a ON a.product_cd = s.product_cd
      JOIN wt_product_category pc ON pc.product_cd = a.product_cd
      LEFT JOIN (
        SELECT DISTINCT LEFT(category_cd, 9) AS mid FROM wt_category WHERE CHAR_LENGTH(category_cd) > 9
      ) kids ON kids.mid = a.mid
      WHERE a.major IS NOT NULL
      GROUP BY a.product_cd, a.major, a.mid, s.ps
    ) x
    GROUP BY x.major
    ORDER BY x.major`);
}

/** 최근 14일 주문 줄 — total_price 가 단가인지 줄 합계인지, 옵션 추가금이 섞이는지, 가격 로그로 정가를 찾을 수 있는지 */
async function price() {
  const from = `${ymd(14)} 00:00:00`;
  const to = `${ymd(1)} 23:59:59`;
  const logValue = (col: string) => `(
    SELECT t.${col} FROM wt_product_trg_log t
    WHERE t.product_cd = op.product_cd AND t.mod_date <= op.reg_date AND t.del_yn = 'N'
      AND t.sale_price > 0 AND t.supply_price > 0 AND t.sale_price <= t.supply_price
    ORDER BY t.mod_date DESC, t.seq DESC LIMIT 1)`;
  return query(`
    SELECT
      COUNT(*) AS line_count,
      SUM(y.qty >= 2) AS multi_qty_lines,
      SUM(y.qty >= 2 AND ABS(y.total_price - y.log_sale * y.qty) <= 1) AS multi_is_line_total,
      SUM(y.qty >= 2 AND ABS(y.total_price - y.log_sale) <= 1) AS multi_is_unit_price,
      SUM(y.log_sale IS NULL) AS no_log,
      SUM(ABS(y.total_price / y.qty - y.log_sale) <= 1) AS unit_eq_sale,
      SUM(y.total_price / y.qty > y.log_sale + 1) AS unit_over_sale,
      SUM(y.total_price / y.qty < y.log_sale - 1) AS unit_under_sale,
      SUM(y.total_price / y.qty > y.log_list + 1) AS unit_over_list
    FROM (
      SELECT op.total_price, op.qty, ${logValue("sale_price")} AS log_sale, ${logValue("supply_price")} AS log_list
      FROM wt_order_product op
      WHERE op.reg_date BETWEEN '${from}' AND '${to}'
        AND op.product_order_state_cd IN ('30','35','40','90')
        AND op.total_price > 0 AND op.qty > 0
    ) y`);
}

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  try {
    if (section === "columns") return NextResponse.json(await columns());
    if (section === "categories") return NextResponse.json(await categories());
    if (section === "sold") return NextResponse.json(await sold());
    if (section === "price") return NextResponse.json(await price());
    return NextResponse.json({ error: "section 은 columns, categories, sold, price 중 하나" }, { status: 400 });
  } catch (e) {
    console.error("category-drill-probe", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회 실패" }, { status: 500 });
  }
}
