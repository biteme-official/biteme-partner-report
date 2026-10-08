import mysql from "mysql2/promise";
import { salesLinesSQL } from "./salesLines";
import type { ProductDailyRange } from "./productDaily";

/**
 * 기획전 고객·운영 지표 — 프로모션 센터 「기획전 성과」 탭의 고객·운영 구획.
 *
 * 매출은 productDaily.ts 와 같은 태블로 실매출 줄(salesLines.ts)에서 시작합니다. 참여 상품 줄을
 * 주문 속성(주문 경로·회원 등급)·상품 속성(반려동물 구분)과 함께 그대로 받아 와 route 에서
 * 접습니다 — 축이 여러 개라 축마다 무거운 줄 쿼리를 다시 돌리지 않으려는 것입니다.
 * (10월 메인기획전 14일치가 수천 줄 수준)
 *
 * 🔴 user_id 는 route 밖으로 내보내지 않습니다. 집계만 응답합니다.
 */

const lines = (r: Pick<ProductDailyRange, "start" | "end">) =>
  salesLinesSQL({ fromStr: `${r.start} 00:00:00`, toStr: `${r.end} 23:59:59` });

const inList = (codes: string[]) => codes.map((c) => mysql.escape(c)).join(",");

/** 참여 상품 줄 — 주문·상품 속성을 붙여서 */
export function promoLinesSQL(r: ProductDailyRange): string {
  return `
    SELECT
      s.ocode,
      s.user_id,
      DATE_FORMAT(s.reg_date, '%Y-%m-%d') AS d,
      HOUR(s.reg_date) AS h,
      s.product_cd,
      s.qty,
      s.sales,
      s.coupon,
      (s.reserve + s.deposit) AS points,
      oi.order_path,
      oi.member_grp_cd,
      p.pet_type
    FROM (${lines(r)}) s
    JOIN wt_order_info oi ON oi.ocode = s.ocode
    JOIN wt_product p ON p.product_cd = s.product_cd
    WHERE s.product_cd IN (${inList(r.productCds)})
  `;
}

/**
 * 회원별 사이트 첫 주문일·가입일 — 신규 구매자 판정용.
 * 첫 주문은 결제가 된 주문(order_yn = 'y') 중 가장 이른 것입니다(나중에 취소됐어도 첫 주문으로 칩니다).
 */
export function firstOrdersSQL(r: ProductDailyRange): string {
  return `
    SELECT
      u.user_id,
      DATE_FORMAT((SELECT MIN(o.reg_date) FROM wt_order_info o
                    WHERE o.user_id = u.user_id AND o.order_yn = 'y'), '%Y-%m-%d') AS first_order,
      DATE_FORMAT(m.reg_date, '%Y-%m-%d') AS joined
    FROM (SELECT DISTINCT s.user_id FROM (${lines(r)}) s
           WHERE s.user_id IS NOT NULL AND s.product_cd IN (${inList(r.productCds)})) u
    LEFT JOIN wt_member m ON m.user_id = u.user_id
  `;
}

/** 같은 기간 사이트 전체 회원 구매자 수와 그중 첫 주문 고객 수 — 기획전 신규 비중의 비교 기준 */
export function siteBuyersSQL(r: Pick<ProductDailyRange, "start" | "end">): string {
  return `
    SELECT
      COUNT(*) AS buyers,
      SUM(x.first_order >= '${r.start} 00:00:00') AS new_buyers
    FROM (
      SELECT u.user_id,
        (SELECT MIN(o.reg_date) FROM wt_order_info o
          WHERE o.user_id = u.user_id AND o.order_yn = 'y') AS first_order
      FROM (SELECT DISTINCT s.user_id FROM (${lines(r)}) s WHERE s.user_id IS NOT NULL) u
    ) x
  `;
}

/** 참여 상품의 대표 카테고리(1단계) */
export function productCategoriesSQL(codes: string[]): string {
  return `
    SELECT pc.product_cd, c.category_nm, c.pet_type
    FROM wt_product_category pc
    JOIN wt_category c ON c.category_cd = pc.category1_cd
    WHERE pc.repre_category_yn = 'Y' AND pc.product_cd IN (${inList(codes)})
  `;
}

/**
 * 참여 상품의 지금 판매 상태와 기간 중 옵션 품절 — 「손볼 상품」.
 * product_state: 0 준비중 · 1 승인요청 · 2 판매중 · 3 판매중지 · 4 품절 (types.ts 와 같음)
 */
export function productStatusSQL(r: ProductDailyRange): string {
  return `
    SELECT
      p.product_cd,
      p.product_state,
      p.display_yn,
      IFNULL(so.n, 0) AS soldout_options,
      DATE_FORMAT(so.first_at, '%Y-%m-%d %H:%i') AS soldout_first
    FROM wt_product p
    LEFT JOIN (
      SELECT product_cd, COUNT(*) AS n, MIN(reg_date) AS first_at
      FROM wt_product_stock_soldout_log
      WHERE product_cd IN (${inList(r.productCds)})
        AND reg_date BETWEEN '${r.start} 00:00:00' AND '${r.end} 23:59:59'
      GROUP BY product_cd
    ) so ON so.product_cd = p.product_cd
    WHERE p.product_cd IN (${inList(r.productCds)})
      AND (p.product_state <> '2' OR p.display_yn <> 'Y' OR so.n > 0)
  `;
}
