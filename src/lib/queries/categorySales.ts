import mysql from "mysql2/promise";
import { salesLinesSQL } from "./salesLines";
import { majorCodes } from "../categoryMajors";

/**
 * 카테고리별 매출 — 프로모션 센터 관리자 매출통계 「카테고리 매출」 탭 (이슈 #75 · #77 · #79).
 *
 * 매출은 다른 화면과 같은 주문 라인(salesLines.ts)이고, 실매출(sales)·거래액(partner_sales) 둘 다 냅니다.
 * 바잇미 자체 매출은 통합 탭(integrated.ts)과 같이 뺍니다 — 프로모션 센터의 전체 거래액과 맞추려고.
 *
 * 🔴 상품 하나는 **한 카테고리에만** 잡습니다. 상품은 wt_product_category 에 여러 줄로 걸려 있어
 *    EXISTS·JOIN 으로 걸면 두 카테고리(심하면 강아지·고양이 양쪽)에 같은 매출이 들어갑니다.
 *    대분류 배정 순서
 *      1. 대표 카테고리(repre_category_yn = 'Y')가 대상 대분류면 그것
 *      2. 상품 pet_type(001 강아지 · 002 고양이)에 맞는 대상 대분류 연결 중 코드가 가장 작은 것
 *      3. 대상 대분류 연결 중 코드가 가장 작은 것
 *      4. 없으면 NULL — 「카테고리 미지정」
 *    중분류(category2_cd, 9자리)는 고른 대분류 아래 **중분류가 채워진** 연결 중 대표 줄을 먼저, 없으면 코드가 가장 작은 것.
 *    대표 줄은 category2_cd 가 빈 문자열인 경우가 많아, 빈 줄을 먼저 고르면 중분류가 거의 다 비어 버립니다.
 *    소분류(category3_cd)도 같습니다 — 고른 중분류 아래 **소분류가 채워진** 연결 중 대표 줄을 먼저, 없으면 코드가 가장 작은 것.
 *    2026-11 실측: 소분류는 대부분 비대표 줄에 있습니다(대표 줄의 소분류는 368줄뿐).
 *
 * ⚡ 속도 (#79) — 배정은 기간과 무관해 `categoryAssignSQL` 로 상품 전체를 따로 한 번 계산해 오래 담아 두고,
 *    기간 쿼리(`categoryOrderLinesSQL`)는 주문 라인을 **한 번만** 읽어 (주문 × 상품) 합계만 냅니다. 상품별 합계·
 *    대분류별 주문 수는 `lib/categoryFold.ts` 가 그 줄들로 접습니다. 예전에는 기간마다 배정 CTE 를 다시 묶고
 *    주문 라인 계산을 쿼리 두 개에서 되풀이해 같은 기간 통합 조회의 열 배쯤 걸렸습니다(25일 17초 · 90일 41초).
 */

export interface CategorySalesRange {
  /** YYYY-MM-DD 두 개 (양 끝 포함) — 호출하는 쪽에서 형식을 검사합니다 */
  start: string;
  end: string;
}

const inList = (codes: string[]) => codes.map((c) => mysql.escape(c)).join(",");

/** 상품 전부의 대분류·중분류 배정 — 기간과 무관합니다. 카테고리 연결이 없는 상품은 행이 없습니다(= 미지정) */
export function categoryAssignSQL(): string {
  const all = inList(majorCodes());
  const dog = inList(majorCodes("dog"));
  const cat = inList(majorCodes("cat"));
  return `
    SELECT
      a.product_cd,
      a.major,
      a.repre_major,
      a.mid,
      SUBSTRING(MIN(
        IF(pc.category1_cd = a.major AND pc.category2_cd = a.mid
           AND LEFT(pc.category3_cd, CHAR_LENGTH(a.mid)) = a.mid
           AND CHAR_LENGTH(pc.category3_cd) > CHAR_LENGTH(a.mid),
          CONCAT(IF(pc.repre_category_yn = 'Y', '0', '1'), pc.category3_cd),
          NULL)
      ), 2) AS small
    FROM (
    SELECT
      k.product_cd,
      k.major,
      k.repre_major,
      -- 정렬 열쇠: 중분류가 있는 줄 먼저(대표 줄은 category2_cd 가 빈 경우가 많음) → 대표 줄 → 코드
      SUBSTRING(MIN(
        IF(pc.category1_cd = k.major AND LEFT(pc.category2_cd, 6) = k.major,
          CONCAT(IF(pc.repre_category_yn = 'Y', '0', '1'), pc.category2_cd),
          NULL)
      ), 2) AS mid
    FROM (
      SELECT
        pc.product_cd,
        COALESCE(
          MAX(IF(pc.repre_category_yn = 'Y' AND pc.category1_cd IN (${all}), pc.category1_cd, NULL)),
          MIN(IF(p.pet_type = '001' AND pc.category1_cd IN (${dog}), pc.category1_cd, NULL)),
          MIN(IF(p.pet_type = '002' AND pc.category1_cd IN (${cat}), pc.category1_cd, NULL)),
          MIN(IF(pc.category1_cd IN (${all}), pc.category1_cd, NULL))
        ) AS major,
        MAX(IF(pc.repre_category_yn = 'Y', pc.category1_cd, NULL)) AS repre_major
      FROM wt_product_category pc
      JOIN wt_product p ON p.product_cd = pc.product_cd
      GROUP BY pc.product_cd
    ) k
    JOIN wt_product_category pc ON pc.product_cd = k.product_cd
    GROUP BY k.product_cd, k.major, k.repre_major
    ) a
    JOIN wt_product_category pc ON pc.product_cd = a.product_cd
    GROUP BY a.product_cd, a.major, a.repre_major, a.mid
  `;
}

/**
 * 기간의 (주문 × 상품 × 위탁사 × 브랜드) 한 줄 — 금액은 반올림 전 합계. 접기는 `lib/categoryFold.ts`.
 * 배정 조인 없이 통합 조회(integrated.ts)와 같은 모양이라 그만큼 빠릅니다.
 *
 * 판매 당시 가격 — 주문 라인의 정가(supply_price)·판매가(sale_price)에 수량을 곱한 합입니다. 판매가에는 옵션 추가금이
 * 들어가지 않습니다(2026-11 실측 98.9%: total_price = sale_price × qty + total_opt_price). coupon 은 그 줄에 나눠 든
 * 쿠폰 금액 전체이고, 어느 쿠폰인지는 주문의 coupon_member_seq → wt_coupon_member 로 찾습니다.
 * @param productCd 상품 하나만 — 조건은 안분이 끝난 바깥에서 겁니다(salesLines.ts 의 브랜드 조건과 같은 이유)
 */
export function categoryOrderLinesSQL(r: CategorySalesRange, productCd?: string): string {
  return `
    SELECT
      s.ocode,
      s.product_cd,
      MAX(s.product_nm) AS product_nm,
      s.supplier AS partner_id,
      MAX(a.company_nm) AS partner_name,
      s.brand_cd,
      IFNULL(MAX(c2.code_nm2), s.brand_cd) AS brand_nm,
      SUM(s.qty) AS qty,
      SUM(s.sales) AS sales,
      SUM(s.partner_sales) AS partner_sales,
      SUM(s.qty * s.list_unit) AS list_amount,
      SUM(s.qty * s.sale_unit) AS sale_amount,
      SUM(s.coupon) AS coupon,
      SUM(IF(s.coupon > 0, s.qty, 0)) AS coupon_qty,
      MAX(m.coupon_master_seq) AS coupon_master_seq,
      DATE_FORMAT(MIN(s.reg_date), '%Y-%m-%d %H:%i:%s') AS ordered_at
    FROM (${salesLinesSQL({ fromStr: `${r.start} 00:00:00`, toStr: `${r.end} 23:59:59` })}) s
    JOIN wt_admin a ON a.\`no\` = s.supplier
    LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
    LEFT JOIN wt_coupon_member m ON m.coupon_member_seq = s.coupon_member_seq
    WHERE a.company_nm NOT LIKE '%바잇미%'
      ${productCd === undefined ? "" : `AND s.product_cd = ${mysql.escape(productCd)}`}
    GROUP BY s.ocode, s.product_cd, s.supplier, s.brand_cd
  `;
}

/** 전시에 걸린 쿠폰과 그 전시 기간 — 기획전 쿠폰과 일반 쿠폰을 가르는 기준 (wt_group.coupon_master_seq) */
export function couponGroupWindowsSQL(): string {
  return `
    SELECT coupon_master_seq, DATE_FORMAT(s_date, '%Y-%m-%d') AS s, DATE_FORMAT(e_date, '%Y-%m-%d') AS e
    FROM wt_group
    WHERE use_yn = 'Y' AND IFNULL(coupon_master_seq, 0) > 0
  `;
}

/** 카테고리 이름 — 대분류(6자리) 전부와 대상 대분류의 중분류(9자리)·소분류(그보다 긴 코드) */
export function categoryNamesSQL(): string {
  return `
    SELECT category_cd, category_nm, pet_type, IF(use_yn = 'Y' AND IFNULL(del_yn, 'N') <> 'Y', 1, 0) AS active
    FROM wt_category
    WHERE CHAR_LENGTH(category_cd) = 6
       OR (CHAR_LENGTH(category_cd) >= 9 AND LEFT(category_cd, 6) IN (${inList(majorCodes())}))
    ORDER BY category_cd
  `;
}
