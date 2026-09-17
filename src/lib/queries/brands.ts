import mysql from "mysql2/promise";
import { fmt, salesLinesSQL, salesWhereSQL, SALES_AGG_COLUMNS, EXCLUDED_USER_IDS } from "./salesLines";

// 매출은 전부 태블로 실매출 산식(salesLines.ts)으로 낸다 — 이슈 #59

export function brandAllListSQL(): string {
  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      p.brand_cd AS brand_cd,
      IFNULL(MAX(c2.code_nm2), p.brand_cd) AS brand_nm
    FROM wt_product p
    JOIN wt_admin a ON a.\`no\` = p.supplier
    LEFT JOIN wt_code2 c2 ON p.brand_cd = c2.code_cd2
    WHERE a.company_nm NOT LIKE '%바잇미%'
      AND a.use_yn = 'y'
      AND p.display_yn = 'y'
      AND p.del_yn = 'n'
    GROUP BY a.\`no\`, a.company_nm, p.brand_cd
    ORDER BY brand_nm
  `;
}

export function brandDetailSQL(partnerId: string, brandCd: string): string {
  const brand = mysql.escape(brandCd);
  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      p.brand_cd AS brand_cd,
      IFNULL(MAX(c2.code_nm2), p.brand_cd) AS brand_nm,
      COUNT(DISTINCT p.product_cd) AS total_product_count,
      COUNT(DISTINCT CASE
        WHEN p.display_yn = 'y' AND p.del_yn = 'n' THEN p.product_cd
      END) AS active_product_count
    FROM wt_product p
    JOIN wt_admin a ON a.\`no\` = p.supplier
    LEFT JOIN wt_code2 c2 ON p.brand_cd = c2.code_cd2
    WHERE p.supplier = ${Number(partnerId)}
      AND p.brand_cd = ${brand}
    GROUP BY a.\`no\`, a.company_nm, p.brand_cd
  `;
}

export function brandSalesSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  return `
    SELECT
      DATE(s.reg_date) AS sale_date,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, brandCd, start, end })}) s
    GROUP BY DATE(s.reg_date)
    ORDER BY sale_date
  `;
}

export function brandHourlySalesSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  return `
    SELECT
      HOUR(s.reg_date) AS sale_hour,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, brandCd, start, end })}) s
    GROUP BY HOUR(s.reg_date)
    ORDER BY sale_hour
  `;
}

export function brandProductsSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  return `
    SELECT
      s.product_cd,
      MAX(s.product_nm) AS product_nm,
      IFNULL(MAX(c2.code_nm2), MAX(s.brand_cd)) AS brand_nm,
      SUM(s.qty) AS total_qty,
      COUNT(DISTINCT s.ocode) AS order_count,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, brandCd, start, end })}) s
    LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
    GROUP BY s.product_cd
    ORDER BY total_sales DESC
  `;
}

export function brandMonthlySalesSQL(partnerId: string, brandCd: string, monthsBack: number = 6): string {
  return `
    SELECT
      DATE_FORMAT(s.reg_date, '%Y-%m') AS month,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, brandCd, sinceExpr: `DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)` })}) s
    GROUP BY DATE_FORMAT(s.reg_date, '%Y-%m')
    ORDER BY month
  `;
}

export function brandTopGrowthProductsSQL(partnerId: string, brandCd: string): string {
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
      FROM (${salesLinesSQL({ partnerId, brandCd, sinceExpr: "DATE_SUB(CURDATE(), INTERVAL 60 DAY)" })}) s
      GROUP BY s.product_cd
      HAVING curr_sales > 0 OR prev_sales > 0
    ) sub
    ORDER BY growth_rate DESC
    LIMIT 10
  `;
}

// "이 브랜드에서의 첫 주문" — 상태·계정 제외 규칙은 매출과 같고, 응모권만 기존처럼 안 뺀다
function brandFirstOrderSQL(partnerId: string, brandCd: string): string {
  return `
    SELECT
      oi.user_id,
      MIN(op.reg_date) AS first_date
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    WHERE ${salesWhereSQL({ partnerId, brandCd, memberOnly: true, excludeRaffle: false })}
    GROUP BY oi.user_id
  `;
}

export function brandBuyerTypeSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
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
      FROM (${salesLinesSQL({ partnerId, brandCd, start, end, memberOnly: true })}) s
      JOIN (${brandFirstOrderSQL(partnerId, brandCd)}) first_ord ON s.user_id = first_ord.user_id
      GROUP BY s.user_id
    ) buyer_summary
    GROUP BY buyer_type
  `;
}

export function brandBuyerMonthlySQL(partnerId: string, brandCd: string, monthsBack: number = 6): string {
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
    FROM (${salesLinesSQL({ partnerId, brandCd, sinceExpr: `DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)`, memberOnly: true })}) s
    JOIN (${brandFirstOrderSQL(partnerId, brandCd)}) first_ord ON s.user_id = first_ord.user_id
    GROUP BY month, buyer_type
    ORDER BY month
  `;
}

// 반품률은 매출 산식과 무관하게 전체 주문 상태를 본다(기존 그대로)
const USERS = EXCLUDED_USER_IDS.map((v) => `'${v}'`).join(",");

export function brandReturnRateSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  const brand = mysql.escape(brandCd);
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
      AND p.brand_cd = ${brand}
      AND oi.order_yn = 'y'
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
  `;
}
