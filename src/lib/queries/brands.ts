import mysql from "mysql2/promise";

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
  const brand = mysql.escape(brandCd);
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
      AND p.brand_cd = ${brand}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY DATE(op.reg_date)
    ORDER BY sale_date
  `;
}

export function brandHourlySalesSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  const brand = mysql.escape(brandCd);
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
      AND p.brand_cd = ${brand}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY HOUR(op.reg_date)
    ORDER BY sale_hour
  `;
}

export function brandProductsSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  const brand = mysql.escape(brandCd);
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
      AND p.brand_cd = ${brand}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
    GROUP BY op.product_cd
    ORDER BY total_sales DESC
  `;
}

export function brandMonthlySalesSQL(partnerId: string, brandCd: string, monthsBack: number = 6): string {
  const brand = mysql.escape(brandCd);
  return `
    SELECT
      DATE_FORMAT(op.reg_date, '%Y-%m') AS month,
      COUNT(DISTINCT op.ocode) AS order_count,
      COUNT(DISTINCT oi.user_id) AS buyer_count,
      SUM(op.qty) AS total_qty,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    WHERE p.supplier = ${Number(partnerId)}
      AND p.brand_cd = ${brand}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
    GROUP BY DATE_FORMAT(op.reg_date, '%Y-%m')
    ORDER BY month
  `;
}

export function brandTopGrowthProductsSQL(partnerId: string, brandCd: string): string {
  const brand = mysql.escape(brandCd);
  return `
    SELECT
      product_cd,
      product_nm,
      prev_sales,
      curr_sales,
      ROUND((curr_sales - prev_sales) / NULLIF(prev_sales, 0) * 100, 1) AS growth_rate
    FROM (
      SELECT
        op.product_cd,
        MAX(op.product_nm) AS product_nm,
        SUM(CASE
          WHEN op.reg_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          THEN op.total_price ELSE 0
        END) AS curr_sales,
        SUM(CASE
          WHEN op.reg_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND op.reg_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          THEN op.total_price ELSE 0
        END) AS prev_sales
      FROM wt_order_product op
      JOIN wt_order_info oi ON op.ocode = oi.ocode
      JOIN wt_product p ON op.product_cd = p.product_cd
      WHERE p.supplier = ${Number(partnerId)}
        AND p.brand_cd = ${brand}
        AND oi.order_yn = 'y'
        AND op.product_order_state_cd NOT IN (${STATES})
        AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
        AND op.product_nm NOT LIKE '%응모권%'
        AND op.reg_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
      GROUP BY op.product_cd
      HAVING curr_sales > 0 OR prev_sales > 0
    ) sub
    ORDER BY growth_rate DESC
    LIMIT 10
  `;
}

export function brandBuyerTypeSQL(partnerId: string, brandCd: string, start: Date, end: Date): string {
  const brand = mysql.escape(brandCd);
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
        oi.user_id,
        MIN(first_ord.first_date) AS first_order_date,
        SUM(op.total_price) AS period_sales,
        COUNT(DISTINCT op.ocode) AS period_orders
      FROM wt_order_product op
      JOIN wt_order_info oi ON op.ocode = oi.ocode
      JOIN wt_product p ON op.product_cd = p.product_cd
      JOIN (
        SELECT
          oi2.user_id,
          MIN(op2.reg_date) AS first_date
        FROM wt_order_product op2
        JOIN wt_order_info oi2 ON op2.ocode = oi2.ocode
        JOIN wt_product p2 ON op2.product_cd = p2.product_cd
        WHERE p2.supplier = ${Number(partnerId)}
          AND p2.brand_cd = ${brand}
          AND oi2.order_yn = 'y'
          AND op2.product_order_state_cd NOT IN (${STATES})
          AND oi2.user_id IS NOT NULL
          AND oi2.user_id NOT IN (${USERS})
        GROUP BY oi2.user_id
      ) first_ord ON oi.user_id = first_ord.user_id
      WHERE p.supplier = ${Number(partnerId)}
        AND p.brand_cd = ${brand}
        AND oi.order_yn = 'y'
        AND op.product_order_state_cd NOT IN (${STATES})
        AND oi.user_id IS NOT NULL
        AND oi.user_id NOT IN (${USERS})
        AND op.product_nm NOT LIKE '%응모권%'
        AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
      GROUP BY oi.user_id
    ) buyer_summary
    GROUP BY buyer_type
  `;
}

export function brandBuyerMonthlySQL(partnerId: string, brandCd: string, monthsBack: number = 6): string {
  const brand = mysql.escape(brandCd);
  return `
    SELECT
      DATE_FORMAT(op.reg_date, '%Y-%m') AS month,
      CASE
        WHEN first_ord.first_date >= DATE_FORMAT(op.reg_date, '%Y-%m-01')
          AND first_ord.first_date < DATE_ADD(DATE_FORMAT(op.reg_date, '%Y-%m-01'), INTERVAL 1 MONTH)
        THEN 'new'
        ELSE 'repeat'
      END AS buyer_type,
      COUNT(DISTINCT oi.user_id) AS buyer_count,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    JOIN (
      SELECT
        oi2.user_id,
        MIN(op2.reg_date) AS first_date
      FROM wt_order_product op2
      JOIN wt_order_info oi2 ON op2.ocode = oi2.ocode
      JOIN wt_product p2 ON op2.product_cd = p2.product_cd
      WHERE p2.supplier = ${Number(partnerId)}
        AND p2.brand_cd = ${brand}
        AND oi2.order_yn = 'y'
        AND op2.product_order_state_cd NOT IN (${STATES})
        AND oi2.user_id IS NOT NULL
        AND oi2.user_id NOT IN (${USERS})
      GROUP BY oi2.user_id
    ) first_ord ON oi.user_id = first_ord.user_id
    WHERE p.supplier = ${Number(partnerId)}
      AND p.brand_cd = ${brand}
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND oi.user_id IS NOT NULL
      AND oi.user_id NOT IN (${USERS})
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
    GROUP BY month, buyer_type
    ORDER BY month
  `;
}

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
