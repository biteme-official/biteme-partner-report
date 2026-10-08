import mysql from "mysql2/promise";
import { salesLinesSQL } from "./salesLines";

/**
 * 상품 묶음의 일자별 매출 — 프로모션 센터 「기획전 성과」 탭이 씁니다.
 *
 * 기획전에 참여한 상품 코드 목록을 받아, 그 상품들의 하루하루 매출과 같은 날 사이트 전체 매출을
 * 함께 돌려줍니다(기획전 매출 비중을 내는 분모). 매출은 다른 화면과 같은 태블로 실매출 산식입니다
 * (salesLines.ts).
 *
 * 🔴 상품 조건은 **안분이 끝난 바깥에서** 겁니다. 안쪽에서 걸면 배송 묶음 안에 참여 상품 줄만 남아
 *    배송비를 통째로 가져갑니다(salesLines.ts 의 브랜드 조건과 같은 이유).
 */

export interface ProductDailyRange {
  /** YYYY-MM-DD 두 개 (양 끝 포함) — 호출하는 쪽에서 형식을 검사합니다 */
  start: string;
  end: string;
  /** 상품 코드 — 호출하는 쪽에서 형식을 검사합니다 */
  productCds: string[];
}

const lines = (r: ProductDailyRange) =>
  salesLinesSQL({ fromStr: `${r.start} 00:00:00`, toStr: `${r.end} 23:59:59` });

const inList = (r: ProductDailyRange) => r.productCds.map((c) => mysql.escape(c)).join(",");

/** 상품 × 일자 — 그날 팔린 참여 상품만 (0 인 날은 행이 없습니다) */
export function productDailySalesSQL(r: ProductDailyRange): string {
  return `
    SELECT
      DATE_FORMAT(s.reg_date, '%Y-%m-%d') AS d,
      s.product_cd,
      COUNT(DISTINCT s.ocode) AS order_count,
      SUM(s.qty) AS qty,
      ROUND(SUM(s.sales)) AS sales
    FROM (${lines(r)}) s
    WHERE s.product_cd IN (${inList(r)})
    GROUP BY d, s.product_cd
  `;
}

/**
 * 일자별 합계 — 사이트 전체와 참여 상품 묶음.
 *
 * 묶음의 주문 수는 상품별 주문 수를 더하면 안 됩니다(한 주문에 참여 상품이 둘이면 두 번 셉니다).
 * 그래서 여기서 주문 번호로 따로 셉니다.
 */
export function dailyTotalsSQL(r: ProductDailyRange): string {
  return `
    SELECT
      DATE_FORMAT(s.reg_date, '%Y-%m-%d') AS d,
      ROUND(SUM(s.sales)) AS site_sales,
      COUNT(DISTINCT s.ocode) AS site_orders,
      ROUND(SUM(IF(s.product_cd IN (${inList(r)}), s.sales, 0))) AS promo_sales,
      COUNT(DISTINCT IF(s.product_cd IN (${inList(r)}), s.ocode, NULL)) AS promo_orders
    FROM (${lines(r)}) s
    GROUP BY d
  `;
}
