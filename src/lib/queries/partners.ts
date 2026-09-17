import { salesLinesSQL, SALES_AGG_COLUMNS } from "./salesLines";

// 매출은 전부 태블로 실매출 산식(salesLines.ts)으로 낸다 — 이슈 #59

export function partnerAllListSQL(): string {
  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name
    FROM wt_admin a
    WHERE a.company_nm NOT LIKE '%바잇미%'
      AND a.use_yn = 'y'
    ORDER BY a.company_nm
  `;
}

export function partnerListSQL(start: Date, end: Date): string {
  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      IFNULL(pc.product_count, 0) AS product_count,
      IFNULL(pc.active_product_count, 0) AS active_product_count,
      sales.order_count,
      sales.total_sales,
      sales.gross_sales
    FROM (
      SELECT
        s.supplier,
        COUNT(DISTINCT s.ocode) AS order_count,
        ${SALES_AGG_COLUMNS}
      FROM (${salesLinesSQL({ start, end })}) s
      GROUP BY s.supplier
      HAVING total_sales > 0
    ) sales
    JOIN wt_admin a ON a.\`no\` = sales.supplier
    LEFT JOIN (
      SELECT
        p.supplier,
        COUNT(DISTINCT p.product_cd) AS product_count,
        COUNT(DISTINCT CASE
          WHEN p.display_yn = 'y' AND p.del_yn = 'n' THEN p.product_cd
        END) AS active_product_count
      FROM wt_product p
      GROUP BY p.supplier
    ) pc ON pc.supplier = a.\`no\`
    WHERE a.company_nm NOT LIKE '%바잇미%'
      AND a.use_yn = 'y'
    ORDER BY sales.total_sales DESC
  `;
}

export function partnerDetailSQL(partnerId: string): string {
  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      a.reg_date AS joined_date,
      COUNT(DISTINCT p.product_cd) AS total_product_count,
      COUNT(DISTINCT CASE
        WHEN p.display_yn = 'y' AND p.del_yn = 'n' THEN p.product_cd
      END) AS active_product_count,
      COUNT(DISTINCT c2.code_cd2) AS brand_count
    FROM wt_admin a
    LEFT JOIN wt_product p ON a.\`no\` = p.supplier
    LEFT JOIN wt_code2 c2 ON p.brand_cd = c2.code_cd2
    WHERE a.\`no\` = ${Number(partnerId)}
    GROUP BY a.\`no\`
  `;
}

export function partnerSalesSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      DATE(s.reg_date) AS sale_date,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, start, end })}) s
    GROUP BY DATE(s.reg_date)
    ORDER BY sale_date
  `;
}

export function partnerHourlySalesSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      HOUR(s.reg_date) AS sale_hour,
      COUNT(DISTINCT s.ocode) AS order_count,
      COUNT(DISTINCT s.user_id) AS buyer_count,
      SUM(s.qty) AS total_qty,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, start, end })}) s
    GROUP BY HOUR(s.reg_date)
    ORDER BY sale_hour
  `;
}

export function partnerProductsSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      s.product_cd,
      MAX(s.product_nm) AS product_nm,
      IFNULL(MAX(c2.code_nm2), MAX(s.brand_cd)) AS brand_nm,
      SUM(s.qty) AS total_qty,
      COUNT(DISTINCT s.ocode) AS order_count,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ partnerId, start, end })}) s
    LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
    GROUP BY s.product_cd
    ORDER BY total_sales DESC
  `;
}

export function partnerBrandsSQL(partnerId: string): string {
  return `
    SELECT
      p.brand_cd,
      IFNULL(c2.code_nm2, p.brand_cd) AS brand_nm,
      COUNT(DISTINCT p.product_cd) AS product_count,
      COUNT(DISTINCT CASE
        WHEN p.display_yn = 'y' AND p.del_yn = 'n' THEN p.product_cd
      END) AS active_count
    FROM wt_product p
    LEFT JOIN wt_code2 c2 ON p.brand_cd = c2.code_cd2
    WHERE p.supplier = ${Number(partnerId)}
    GROUP BY p.brand_cd
    ORDER BY product_count DESC
  `;
}
