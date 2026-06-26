const EXCLUDED_USER_IDS = [
  "ptest", "ptest2", "cafebiteme_SS", "cafebiteme_YN",
  "bite1008", "cafebiteme_CG",
];

const EXCLUDED_ORDER_STATES = ["10", "50", "65", "70", "95", "99"];

const USERS = EXCLUDED_USER_IDS.map((v) => `'${v}'`).join(",");
const STATES = EXCLUDED_ORDER_STATES.map((v) => `'${v}'`).join(",");

function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function partnerListSQL(start: Date, end: Date): string {
  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      COUNT(DISTINCT p.product_cd) AS product_count,
      COUNT(DISTINCT CASE
        WHEN p.display_yn = 'y' AND p.del_yn = 'n' THEN p.product_cd
      END) AS active_product_count,
      COUNT(DISTINCT op.ocode) AS order_count,
      ROUND(IFNULL(SUM(op.total_price), 0)) AS total_sales
    FROM wt_admin a
    LEFT JOIN wt_product p ON a.\`no\` = p.supplier
    LEFT JOIN wt_order_product op ON p.product_cd = op.product_cd
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
      AND op.product_order_state_cd NOT IN (${STATES})
    LEFT JOIN wt_order_info oi ON op.ocode = oi.ocode
      AND oi.order_yn = 'y'
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
    WHERE a.company_nm NOT LIKE '%바잇미%'
      AND a.use_yn = 'y'
    GROUP BY a.\`no\`, a.company_nm
    HAVING total_sales > 0
    ORDER BY total_sales DESC
  `;
}

export function partnerDetailSQL(partnerId: string, start: Date, end: Date): string {
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
      DATE(op.reg_date) AS sale_date,
      COUNT(DISTINCT op.ocode) AS order_count,
      COUNT(DISTINCT oi.user_id) AS buyer_count,
      SUM(op.qty) AS total_qty,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    WHERE p.supplier = ${Number(partnerId)}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY DATE(op.reg_date)
    ORDER BY sale_date
  `;
}

export function partnerHourlySalesSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      HOUR(op.reg_date) AS sale_hour,
      COUNT(DISTINCT op.ocode) AS order_count,
      COUNT(DISTINCT oi.user_id) AS buyer_count,
      SUM(op.qty) AS total_qty,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    WHERE p.supplier = ${Number(partnerId)}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY HOUR(op.reg_date)
    ORDER BY sale_hour
  `;
}

export function partnerProductsSQL(partnerId: string, start: Date, end: Date): string {
  return `
    SELECT
      op.product_cd,
      MAX(op.product_nm) AS product_nm,
      IFNULL(MAX(c2.code_nm2), MAX(p.brand_cd)) AS brand_nm,
      SUM(op.qty) AS total_qty,
      COUNT(DISTINCT op.ocode) AS order_count,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    LEFT JOIN wt_code2 c2 ON p.brand_cd = c2.code_cd2
    WHERE p.supplier = ${Number(partnerId)}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY op.product_cd
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
