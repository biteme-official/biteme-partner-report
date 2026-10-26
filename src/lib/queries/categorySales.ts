import mysql from "mysql2/promise";
import { salesLinesSQL } from "./salesLines";
import { majorCodes } from "../categoryMajors";

/**
 * 카테고리별 매출 — 프로모션 센터 관리자 매출통계 「카테고리 매출」 탭 (이슈 #75).
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
 *    중분류(category2_cd)는 고른 대분류 아래 연결 중 대표 줄을 먼저, 없으면 코드가 가장 작은 것.
 *
 * 상품 조건이 없으므로 안분은 salesLines 그대로입니다(배송비는 상품 줄마다 이미 나뉘어 있음).
 */

export interface CategorySalesRange {
  /** YYYY-MM-DD 두 개 (양 끝 포함) — 호출하는 쪽에서 형식을 검사합니다 */
  start: string;
  end: string;
}

const inList = (codes: string[]) => codes.map((c) => mysql.escape(c)).join(",");

function withLines(r: CategorySalesRange): string {
  const all = inList(majorCodes());
  const dog = inList(majorCodes("dog"));
  const cat = inList(majorCodes("cat"));
  return `
    WITH s AS (
      ${salesLinesSQL({ fromStr: `${r.start} 00:00:00`, toStr: `${r.end} 23:59:59` })}
    ),
    pick AS (
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
      WHERE pc.product_cd IN (SELECT DISTINCT product_cd FROM s)
      GROUP BY pc.product_cd
    ),
    asg AS (
      SELECT
        k.product_cd,
        k.major,
        k.repre_major,
        NULLIF(SUBSTRING(MIN(
          IF(pc.category1_cd = k.major,
            CONCAT(IF(pc.repre_category_yn = 'Y', '0', '1'), IFNULL(NULLIF(pc.category2_cd, ''), '~')),
            NULL)
        ), 2), '~') AS mid
      FROM pick k
      JOIN wt_product_category pc ON pc.product_cd = k.product_cd
      GROUP BY k.product_cd, k.major, k.repre_major
    )`;
}

const FROM = `
    FROM s
    JOIN wt_admin a ON a.\`no\` = s.supplier
    LEFT JOIN asg ON asg.product_cd = s.product_cd
    WHERE a.company_nm NOT LIKE '%바잇미%'`;

/** 상품 × 위탁사 × 브랜드 한 줄 — 배정한 대분류·중분류와 함께. 매출이 있던 상품만 */
export function categoryProductSalesSQL(r: CategorySalesRange): string {
  return `
    ${withLines(r)}
    SELECT
      s.product_cd,
      MAX(s.product_nm) AS product_nm,
      s.supplier AS partner_id,
      MAX(a.company_nm) AS partner_name,
      s.brand_cd,
      IFNULL(MAX(c2.code_nm2), s.brand_cd) AS brand_nm,
      asg.major,
      asg.mid,
      asg.repre_major,
      COUNT(DISTINCT s.ocode) AS order_count,
      SUM(s.qty) AS qty,
      ROUND(SUM(s.sales)) AS sales,
      ROUND(SUM(s.partner_sales)) AS partner_sales
    FROM s
    JOIN wt_admin a ON a.\`no\` = s.supplier
    LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
    LEFT JOIN asg ON asg.product_cd = s.product_cd
    WHERE a.company_nm NOT LIKE '%바잇미%'
    GROUP BY s.product_cd, s.supplier, s.brand_cd, asg.major, asg.mid, asg.repre_major
  `;
}

/**
 * 주문 수 — 상품별 주문 수를 더하면 한 주문에 상품이 둘인 경우를 두 번 셉니다. 그래서 주문 번호로 따로 셉니다.
 * level: all 전체 · major 대분류(NULL = 미지정) · mid 대분류 × 중분류.
 * 운영 DB 는 GROUPING() 을 못 써(ER_PROCACCESS_DENIED) WITH ROLLUP 대신 UNION ALL 로 셉니다.
 */
export function categoryOrderCountsSQL(r: CategorySalesRange): string {
  return `
    ${withLines(r)}
    SELECT 'all' AS level, NULL AS major, NULL AS mid, COUNT(DISTINCT s.ocode) AS order_count
    ${FROM}
    UNION ALL
    SELECT 'major', asg.major, NULL, COUNT(DISTINCT s.ocode)
    ${FROM}
    GROUP BY asg.major
    UNION ALL
    SELECT 'mid', asg.major, asg.mid, COUNT(DISTINCT s.ocode)
    ${FROM}
    GROUP BY asg.major, asg.mid
  `;
}

/** 카테고리 이름 — 대분류(6자리) 전부와 대상 대분류의 중분류(9자리) */
export function categoryNamesSQL(): string {
  return `
    SELECT category_cd, category_nm, pet_type
    FROM wt_category
    WHERE CHAR_LENGTH(category_cd) = 6
       OR (CHAR_LENGTH(category_cd) = 9 AND LEFT(category_cd, 6) IN (${inList(majorCodes())}))
    ORDER BY category_cd
  `;
}
