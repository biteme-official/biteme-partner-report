import { fmt, salesLinesSQL, salesWhereSQL, SALES_AGG_COLUMNS, EXCLUDED_USER_IDS } from "./salesLines";

// 매출은 전부 태블로 실매출 산식(salesLines.ts)으로 낸다 — 이슈 #59

export function partnerMonthlySalesSQL(partnerId: string, monthsBack: number = 6): string {
  return `
    SELECT
      DATE_FORMAT(s.reg_date, '%Y-%m') AS month,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, sinceExpr: `DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)` })}) s
    GROUP BY DATE_FORMAT(s.reg_date, '%Y-%m')
    ORDER BY month
  `;
}

export function partnerWeeklySalesSQL(partnerId: string, weeksBack: number = 12): string {
  return `
    SELECT
      YEARWEEK(s.reg_date, 1) AS year_week,
      MIN(DATE(s.reg_date)) AS week_start,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, sinceExpr: `DATE_SUB(CURDATE(), INTERVAL ${weeksBack} WEEK)` })}) s
    GROUP BY YEARWEEK(s.reg_date, 1)
    ORDER BY year_week
  `;
}

export function partnerTopGrowthProductsSQL(partnerId: string): string {
  return `
    SELECT
      product_cd,
      product_nm,
      prev_sales,
      curr_sales,
      ROUND((curr_sales - prev_sales) / NULLIF(prev_sales, 0) * 100, 1) AS growth_rate
    FROM (
      SELECT
        s.product_cd,
        MAX(s.product_nm) AS product_nm,
        ROUND(SUM(CASE
          WHEN s.reg_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          THEN s.net_sales ELSE 0
        END)) AS curr_sales,
        ROUND(SUM(CASE
          WHEN s.reg_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND s.reg_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          THEN s.net_sales ELSE 0
        END)) AS prev_sales
      FROM (${salesLinesSQL({ partnerId, sinceExpr: "DATE_SUB(CURDATE(), INTERVAL 60 DAY)" })}) s
      GROUP BY s.product_cd
      HAVING curr_sales > 0 OR prev_sales > 0
    ) sub
    ORDER BY growth_rate DESC
    LIMIT 10
  `;
}

// "이 위탁사에서의 첫 주문" — 상태·계정 제외 규칙은 매출과 같고, 응모권만 기존처럼 안 뺀다
function firstOrderSQL(partnerId: string): string {
  return `
    SELECT
      oi.user_id,
      MIN(op.reg_date) AS first_date
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    WHERE ${salesWhereSQL({ partnerId, memberOnly: true, excludeRaffle: false })}
    GROUP BY oi.user_id
  `;
}

export function partnerBuyerTypeSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      CASE
        WHEN first_order_date >= '${fmt(start)}' THEN 'new'
        ELSE 'repeat'
      END AS buyer_type,
      COUNT(*) AS buyer_count,
      ROUND(SUM(period_sales)) AS total_sales,
      SUM(period_orders) AS order_count,
      ROUND(SUM(period_sales) / SUM(period_orders)) AS avg_order_value
    FROM (
      SELECT
        s.user_id,
        MIN(first_ord.first_date) AS first_order_date,
        SUM(s.net_sales) AS period_sales,
        COUNT(DISTINCT s.ocode) AS period_orders
      FROM (${salesLinesSQL({ partnerId, start, end, memberOnly: true })}) s
      JOIN (${firstOrderSQL(partnerId)}) first_ord ON s.user_id = first_ord.user_id
      GROUP BY s.user_id
    ) buyer_summary
    GROUP BY buyer_type
  `;
}

/**
 * 신규/재구매 구매자를 브랜드별로 나눈 것 (promotion-manager 위탁사 화면 요청, 2026-09-17).
 *
 * 신규/재구매의 기준은 partnerBuyerTypeSQL 과 같은 "이 위탁사에서의 첫 주문"입니다 — 브랜드별로
 * 첫 주문을 따로 잡으면 브랜드 합이 위탁사 합계와 안 맞습니다. 한 구매자가 기간 안에 두 브랜드를
 * 샀으면 두 브랜드 양쪽에 셉니다(brand_cd 별 GROUP BY).
 */
export function partnerBuyerTypeByBrandSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      brand_cd,
      brand_nm,
      CASE
        WHEN first_order_date >= '${fmt(start)}' THEN 'new'
        ELSE 'repeat'
      END AS buyer_type,
      COUNT(*) AS buyer_count,
      ROUND(SUM(period_sales)) AS total_sales,
      SUM(period_orders) AS order_count
    FROM (
      SELECT
        s.user_id,
        s.brand_cd AS brand_cd,
        IFNULL(MAX(c2.code_nm2), s.brand_cd) AS brand_nm,
        MIN(first_ord.first_date) AS first_order_date,
        SUM(s.net_sales) AS period_sales,
        COUNT(DISTINCT s.ocode) AS period_orders
      FROM (${salesLinesSQL({ partnerId, start, end, memberOnly: true })}) s
      LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
      JOIN (${firstOrderSQL(partnerId)}) first_ord ON s.user_id = first_ord.user_id
      GROUP BY s.user_id, s.brand_cd
    ) buyer_brand
    GROUP BY brand_cd, brand_nm, buyer_type
    ORDER BY total_sales DESC
  `;
}

export function partnerBuyerMonthlySQL(partnerId: string, monthsBack: number = 6): string {
  return `
    SELECT
      DATE_FORMAT(s.reg_date, '%Y-%m') AS month,
      CASE
        WHEN first_ord.first_date >= DATE_FORMAT(s.reg_date, '%Y-%m-01')
          AND first_ord.first_date < DATE_ADD(DATE_FORMAT(s.reg_date, '%Y-%m-01'), INTERVAL 1 MONTH)
        THEN 'new'
        ELSE 'repeat'
      END AS buyer_type,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      ROUND(SUM(s.net_sales)) AS total_sales
    FROM (${salesLinesSQL({ partnerId, sinceExpr: `DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)`, memberOnly: true })}) s
    JOIN (${firstOrderSQL(partnerId)}) first_ord ON s.user_id = first_ord.user_id
    GROUP BY month, buyer_type
    ORDER BY month
  `;
}

// 반품률은 매출 산식과 무관하게 전체 주문 상태를 본다(기존 그대로)
const USERS = EXCLUDED_USER_IDS.map((v) => `'${v}'`).join(",");

export function partnerReturnRateSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      COUNT(DISTINCT CASE
        WHEN op.product_order_state_cd IN ('65', '70') THEN op.product_ocode
      END) AS return_count,
      COUNT(DISTINCT op.product_ocode) AS total_count,
      ROUND(
        COUNT(DISTINCT CASE
          WHEN op.product_order_state_cd IN ('65', '70') THEN op.product_ocode
        END) / NULLIF(COUNT(DISTINCT op.product_ocode), 0) * 100, 1
      ) AS return_rate
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    WHERE p.supplier = ${Number(partnerId)}
      AND oi.order_yn = 'y'
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
  `;
}
