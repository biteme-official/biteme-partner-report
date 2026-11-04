import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { categoryAssignSQL } from "@/lib/queries/categorySales";
import { salesLinesSQL } from "@/lib/queries/salesLines";

/**
 * 🔴 임시 조사용 — 머지 금지. 확인이 끝나면 브랜치째 지웁니다.
 * 칼럼 이름과 건수·비율만 돌려주고, 상품·주문·금액 값은 내지 않습니다. 읽기 전용입니다.
 *   GET /api/category-drill-probe?section=columns|categories|sold|price|orderPrice|coupon
 */
export const maxDuration = 60;

const TABLES = ["wt_order_product", "wt_product_category", "wt_category", "wt_product_trg_log", "wt_group", "wt_coupon_master", "wt_coupon_member"];

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

/** 최근 14일 주문 줄 — 주문 라인의 정가·판매가·기획전 칸이 채워지는지, total_price 와 어떻게 맞는지 */
async function orderPrice() {
  const from = `${ymd(14)} 00:00:00`;
  const to = `${ymd(1)} 23:59:59`;
  const base = `wt_order_product op
    WHERE op.reg_date BETWEEN '${from}' AND '${to}'
      AND op.product_order_state_cd IN ('30','35','40','90')
      AND op.total_price > 0 AND op.qty > 0`;
  const fill = await query(`
    SELECT
      COUNT(*) AS line_count,
      SUM(IFNULL(op.supply_price, 0) > 0) AS has_list,
      SUM(IFNULL(op.sale_price, 0) > 0) AS has_sale,
      SUM(IFNULL(op.price, 0) > 0) AS has_price,
      SUM(op.sale_price > op.supply_price) AS sale_over_list,
      SUM(op.price = op.sale_price) AS price_eq_sale,
      SUM(op.price = op.supply_price) AS price_eq_list,
      SUM(op.total_price = op.price * op.qty) AS total_eq_price_qty,
      SUM(op.total_price = op.sale_price * op.qty) AS total_eq_sale_qty,
      SUM(op.total_price = op.sale_price * op.qty + IFNULL(op.total_opt_price, 0)) AS total_eq_sale_qty_opt,
      SUM(op.total_price = IFNULL(op.total_origin_price, 0)) AS total_eq_origin,
      SUM(IFNULL(op.total_opt_price, 0) <> 0) AS has_opt_price,
      SUM(IFNULL(op.total_origin_price, 0) = op.supply_price * op.qty) AS origin_eq_list_qty,
      SUM(IFNULL(op.product_coupon_dc_price, 0) > 0) AS has_coupon_dc,
      SUM(IFNULL(op.group_cd, 0) > 0) AS has_group,
      SUM(IFNULL(op.event_seq, 0) > 0) AS has_event,
      COUNT(DISTINCT NULLIF(op.group_cd, 0)) AS distinct_groups
    FROM ${base}`);
  const group = await query(`
    SELECT
      COUNT(*) AS line_count,
      SUM(y.in_live_group > 0) AS product_in_live_group,
      SUM(y.in_live_group > 0 AND IFNULL(y.group_cd, 0) > 0) AS live_and_has_group,
      SUM(y.in_live_group > 0 AND y.own_group_live > 0) AS live_and_own_group_live,
      SUM(y.in_live_group = 0 AND IFNULL(y.group_cd, 0) > 0) AS not_live_but_has_group,
      SUM(IFNULL(y.group_cd, 0) > 0 AND y.own_group_live > 0) AS own_group_live,
      SUM(y.in_live_group > 0 AND y.sale_price < y.supply_price) AS live_discounted,
      SUM(y.in_live_group = 0 AND y.sale_price < y.supply_price) AS not_live_discounted,
      SUM(y.in_live_group > 1) AS in_two_or_more_live_groups
    FROM (
      SELECT op.group_cd, op.sale_price, op.supply_price,
        (SELECT COUNT(*) FROM wt_group_product gp JOIN wt_group g ON g.group_cd = gp.group_cd
          WHERE gp.product_cd = op.product_cd AND gp.use_yn = 'Y'
            AND op.reg_date BETWEEN g.s_date AND g.e_date) AS in_live_group,
        (SELECT COUNT(*) FROM wt_group g
          WHERE g.group_cd = op.group_cd AND op.reg_date BETWEEN g.s_date AND g.e_date) AS own_group_live
      FROM ${base}
    ) y`);
  return { fill, group };
}

/** 최근 90일 — 주문 쿠폰이 어떤 종류로 이어지는지. 건수만 */
async function coupon() {
  const from = `${ymd(90)} 00:00:00`;
  const to = `${ymd(1)} 23:59:59`;
  return query(`
    SELECT
      cm.sale_target,
      COUNT(*) AS line_count,
      COUNT(DISTINCT cm.coupon_master_seq) AS masters,
      SUM(IFNULL(op.product_coupon_dc_price, 0) > 0) AS has_product_dc,
      SUM(IFNULL(op.division_coupon_product_price, 0) > 0) AS has_division_dc,
      SUM(IFNULL(oi.coupon_member_seq, 0) > 0) AS order_has_coupon
    FROM wt_order_product op
    JOIN wt_order_info oi ON oi.ocode = op.ocode
    LEFT JOIN wt_coupon_member m ON m.coupon_member_seq = oi.coupon_member_seq
    LEFT JOIN wt_coupon_master cm ON cm.coupon_master_seq = m.coupon_master_seq
    WHERE op.reg_date BETWEEN '${from}' AND '${to}'
      AND op.product_order_state_cd IN ('30','35','40','90')
      AND op.total_price > 0 AND op.qty > 0
    GROUP BY cm.sale_target
    ORDER BY cm.sale_target`);
}

/** 쿠폰 마스터가 전시(wt_group)에 연결되는지 — 건수만 */
async function couponLink() {
  const from = `${ymd(90)} 00:00:00`;
  const to = `${ymd(1)} 23:59:59`;
  const groups = await query(`
    SELECT COUNT(*) AS live_groups, SUM(IFNULL(g.coupon_master_seq, 0) > 0) AS with_coupon,
      COUNT(DISTINCT NULLIF(g.coupon_master_seq, 0)) AS distinct_coupons
    FROM wt_group g
    WHERE g.use_yn = 'Y' AND g.s_date <= '${to}' AND g.e_date >= '${from}'`);
  // 전시 쪽 쿠폰 목록을 먼저 한 번 묶어 조인합니다 — 줄마다 EXISTS 를 돌리면 60초를 넘깁니다. 범위도 14일로 줄입니다
  const recent = `${ymd(14)} 00:00:00`;
  const lines = await query(`
    SELECT
      cm.sale_target,
      COUNT(*) AS line_count,
      COUNT(DISTINCT cm.coupon_master_seq) AS masters,
      SUM(gc.seq IS NOT NULL) AS coupon_on_group,
      COUNT(DISTINCT gc.seq) AS masters_on_group,
      SUM(IFNULL(cm.partner_coupn_yn, 'N') = 'Y') AS partner_coupon
    FROM wt_order_product op
    JOIN wt_order_info oi ON oi.ocode = op.ocode
    JOIN wt_coupon_member m ON m.coupon_member_seq = oi.coupon_member_seq
    JOIN wt_coupon_master cm ON cm.coupon_master_seq = m.coupon_master_seq
    LEFT JOIN (
      SELECT DISTINCT coupon_master_seq AS seq FROM wt_group WHERE IFNULL(coupon_master_seq, 0) > 0
    ) gc ON gc.seq = cm.coupon_master_seq
    WHERE op.reg_date BETWEEN '${recent}' AND '${to}'
      AND op.product_order_state_cd IN ('30','35','40','90')
      AND IFNULL(op.division_coupon_product_price, 0) > 0
    GROUP BY cm.sale_target
    ORDER BY cm.sale_target`);
  return { groups, lines };
}

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  try {
    if (section === "columns") return NextResponse.json(await columns());
    if (section === "categories") return NextResponse.json(await categories());
    if (section === "sold") return NextResponse.json(await sold());
    if (section === "price") return NextResponse.json(await price());
    if (section === "orderPrice") return NextResponse.json(await orderPrice());
    if (section === "coupon") return NextResponse.json(await coupon());
    if (section === "couponLink") return NextResponse.json(await couponLink());
    return NextResponse.json({ error: "section 은 columns, categories, sold, price 중 하나" }, { status: 400 });
  } catch (e) {
    console.error("category-drill-probe", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회 실패" }, { status: 500 });
  }
}
