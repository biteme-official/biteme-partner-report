import type { WeekRange } from "@/lib/date";
import { salesLinesSQL } from "./salesLines";

// 매출은 태블로 실매출 산식(salesLines.ts)으로 낸다 — 이슈 #59.
// 공헌이익 시트의 거래액이 태블로 실매출 기준이라, 여기서도 같은 값을 내야 맞아떨어진다.

// 공헌이익 시트가 파트너사 코드가 아니라 공급사명으로 관리되어,
// 바깥에서 이름으로 붙일 수 있도록 company_nm 단위로 집계한다.
export function partnerMonthlySalesByNameSQL(year: number): string {
  return `
    SELECT
      a.company_nm AS partner_name,
      MIN(a.\`no\`) AS partner_id,
      MONTH(s.reg_date) AS month,
      COUNT(DISTINCT s.ocode) AS order_count,
      ROUND(SUM(s.net_sales)) AS total_sales,
      ROUND(SUM(s.gross_sales)) AS gross_sales
    FROM (${salesLinesSQL({ fromStr: `${year}-01-01 00:00:00`, toStr: `${year}-12-31 23:59:59` })}) s
    JOIN wt_admin a ON s.supplier = a.\`no\`
    WHERE a.company_nm NOT LIKE '%바잇미%'
    GROUP BY a.company_nm, MONTH(s.reg_date)
  `;
}

// 주차 구간을 부르는 쪽과 똑같이 자르려고 경계값을 쿼리에 그대로 박는다
export function partnerWeeklySalesByNameSQL(weeks: WeekRange[]): string {
  if (weeks.length === 0) throw new Error("주차 구간이 비어 있습니다");

  const cases = weeks
    .map((w) => `WHEN DATE(s.reg_date) <= '${w.end}' THEN ${w.no}`)
    .join("\n        ");

  return `
    SELECT
      a.company_nm AS partner_name,
      MIN(a.\`no\`) AS partner_id,
      CASE
        ${cases}
      END AS week_no,
      COUNT(DISTINCT s.ocode) AS order_count,
      ROUND(SUM(s.net_sales)) AS total_sales,
      ROUND(SUM(s.gross_sales)) AS gross_sales
    FROM (${salesLinesSQL({
      fromStr: `${weeks[0].start} 00:00:00`,
      toStr: `${weeks[weeks.length - 1].end} 23:59:59`,
    })}) s
    JOIN wt_admin a ON s.supplier = a.\`no\`
    WHERE a.company_nm NOT LIKE '%바잇미%'
    GROUP BY a.company_nm, week_no
  `;
}
