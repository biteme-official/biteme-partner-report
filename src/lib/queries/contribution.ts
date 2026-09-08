import type { WeekRange } from "@/lib/contribution";

// 기존 파트너 매출 쿼리(queries/partners.ts, queries/insights.ts)와 같은 제외 규칙
const EXCLUDED_USER_IDS = [
  "ptest", "ptest2", "cafebiteme_SS", "cafebiteme_YN",
  "bite1008", "cafebiteme_CG",
];

const EXCLUDED_ORDER_STATES = ["10", "50", "65", "70", "95", "99"];

const USERS = EXCLUDED_USER_IDS.map((v) => `'${v}'`).join(",");
const STATES = EXCLUDED_ORDER_STATES.map((v) => `'${v}'`).join(",");

// 공헌이익 시트는 파트너사 코드가 아니라 공급사명으로 관리된다 —
// 조인 키를 맞추려고 매출도 wt_admin.company_nm 단위로 집계한다.
export function partnerMonthlySalesByNameSQL(year: number): string {
  return `
    SELECT
      a.company_nm AS partner_name,
      MONTH(op.reg_date) AS month,
      COUNT(DISTINCT op.ocode) AS order_count,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    JOIN wt_admin a ON p.supplier = a.\`no\`
    WHERE oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND a.company_nm NOT LIKE '%바잇미%'
      AND op.reg_date >= '${year}-01-01 00:00:00'
      AND op.reg_date < '${year + 1}-01-01 00:00:00'
    GROUP BY a.company_nm, MONTH(op.reg_date)
  `;
}

// 주차 구간을 시트와 똑같이 자르려고 경계값을 쿼리에 그대로 박는다
export function partnerWeeklySalesByNameSQL(weeks: WeekRange[]): string {
  if (weeks.length === 0) throw new Error("주차 구간이 비어 있습니다");

  const cases = weeks
    .map((w) => `WHEN DATE(op.reg_date) <= '${w.end}' THEN ${w.no}`)
    .join("\n        ");

  return `
    SELECT
      a.company_nm AS partner_name,
      CASE
        ${cases}
      END AS week_no,
      COUNT(DISTINCT op.ocode) AS order_count,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    JOIN wt_admin a ON p.supplier = a.\`no\`
    WHERE oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND a.company_nm NOT LIKE '%바잇미%'
      AND op.reg_date >= '${weeks[0].start} 00:00:00'
      AND op.reg_date <= '${weeks[weeks.length - 1].end} 23:59:59'
    GROUP BY a.company_nm, week_no
  `;
}
