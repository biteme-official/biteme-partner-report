import mysql from "mysql2/promise";
import { salesLinesSQL, SALES_AGG_COLUMNS } from "./salesLines";

/**
 * 기획전 전시 이력 — 프로모션 센터 「기획전 비교」 화면이 씁니다.
 *
 * 운영 DB 의 전시 리스트(wt_group = 전시, wt_group_product = 전시에 올라간 상품)를 읽어
 * 전시 × 브랜드 단위로 참여 상품 수와 할인율을 돌려줍니다. 매출은 여기서 내지 않습니다 —
 * 프로모션 센터가 기존 `/api/integrated` 를 전시 기간으로 불러 "참여 기간 브랜드 매출"로 붙입니다.
 *
 * 할인율 = **전시 기간 중 판매가가 가장 낮았을 때의 정가 대비 할인율** (1 − 판매가 ÷ 정가).
 *   🔴 wt_group_product 의 sale_price 는 쓰지 않습니다 — 상품을 전시에 **등록한 시점**의 값이라
 *      (10월 메인기획전: 9/29 등록, 할인 전 가격) 기획전 할인이 빠져 있습니다.
 *   대신 가격 변경 로그(wt_product_trg_log)로 상품마다 "이 가격이 언제부터 언제까지였나" 구간을
 *   만들고, 전시 기간과 겹치는 구간 중 가장 깊은 할인을 그 상품의 할인율로 봅니다. 기간 중
 *   가격이 안 바뀐 상품은 시작 전 마지막 가격이 그대로 잡힙니다.
 *   로그 거르는 조건은 MD 가 쓰는 가격 이력 쿼리와 같습니다(판매가·정가 > 0, 판매가 ≤ 정가 등).
 *
 * 바잇미 자체(PB·사입) 상품은 위탁사 숫자에서 다른 화면과 같이 뺍니다(company_nm LIKE '%바잇미%' 가 자체).
 * 다만 월간바잇미·바잇미 브랜드위크처럼 **자체 상품으로만 꾸린 기획전**(PB 기획전)도 비교해야 해서(#71),
 * 자체 상품은 위탁사 하나처럼 묶어(partner_id 0 「바잇미 자체」) 따로 셉니다 — 바잇미 계정이 별도배송·모래배송
 * 등 10곳 넘게 쪼개져 있어 계정별로 두면 같은 브랜드가 여러 줄이 됩니다.
 */

/** 바잇미 자체 계정 — wt_admin 별칭 a */
const OWN = `a.company_nm LIKE '%바잇미%'`;

/** 자체 상품을 묶는 위탁사 번호·이름 */
export const OWN_PARTNER_ID = 0;
export const OWN_PARTNER_NAME = "바잇미 자체";

/**
 * PB 기획전 — 자체 상품이 이만큼 이상이고 전시 상품의 이 비율 이상이 자체인 전시.
 * 2024-08 이후 실측: 월간바잇미 메인전시 122~589개·자체 100%, 바잇미 브랜드위크·패밀리세일 400개 넘게·100%.
 * 메인기획전의 예상매출용 목록은 자체 비중이 절반 안팎이라 걸리지 않습니다.
 */
export const PB_MIN_OWN_PRODUCTS = 100;
export const PB_MIN_OWN_SHARE = 0.9;

/** 할인율·상품 수를 셀 상품 — 위탁만 · 자체만 · 둘 다 */
export type BrandScope = "consign" | "own" | "all";

const scopeWhere = (scope: BrandScope) =>
  scope === "consign" ? `AND NOT (${OWN})` : scope === "own" ? `AND ${OWN}` : "";

export interface PromoGroupRange {
  /** YYYY-MM-DD 두 개 (양 끝 포함) — 기간이 이 범위와 겹치는 전시를 봅니다 */
  start: string;
  end: string;
}

/**
 * 기간이 겹치는 전시. 두 달 넘게 열려 있는 전시(패션관 아울렛 같은 상시 전시)는 기획전이 아니라 뺍니다 —
 * 그대로 두면 그 반년 동안의 매출이 한 기획전 성과로 잡힙니다.
 */
export const MAX_GROUP_DAYS = 62;

const overlaps = (r: PromoGroupRange) =>
  `g.use_yn = 'Y' AND g.s_date <= ${mysql.escape(`${r.end} 23:59:59`)} AND g.e_date >= ${mysql.escape(`${r.start} 00:00:00`)}
   AND DATEDIFF(g.e_date, g.s_date) < ${MAX_GROUP_DAYS}`;

/**
 * 전시 × 상품 → 그 기간 최대 할인율, 다시 전시 × 브랜드로 접기.
 * pairsWhere 는 wt_group g · wt_group_product gp · wt_product p · wt_admin a 에 거는 조건입니다.
 * 자체 상품은 partner_id 0 으로 묶어 돌려줍니다.
 */
function brandStatsSQL(pairsWhere: string, scope: BrandScope): string {
  return `
    WITH pairs AS (
      SELECT DISTINCT gp.group_cd, gp.product_cd, p.brand_cd,
        IF(${OWN}, ${OWN_PARTNER_ID}, a.\`no\`) AS partner_id,
        DATE(g.s_date) AS s, DATE(g.e_date) AS e
      FROM wt_group g
      JOIN wt_group_product gp ON gp.group_cd = g.group_cd AND gp.use_yn = 'Y'
      JOIN wt_product p ON p.product_cd = gp.product_cd
      JOIN wt_admin a ON a.\`no\` = p.supplier
      WHERE ${pairsWhere} ${scopeWhere(scope)}
    ),
    products AS (
      SELECT DISTINCT product_cd FROM pairs
    ),
    price_log AS (
      SELECT t.product_cd, DATE(t.mod_date) AS d, t.sale_price, t.supply_price,
        LEAD(DATE(t.mod_date)) OVER (PARTITION BY t.product_cd ORDER BY t.mod_date, t.seq) AS nd
      FROM products
      JOIN wt_product_trg_log t ON t.product_cd = products.product_cd
      WHERE t.del_yn = 'N'
        AND t.product_state IN ('1','2','3','4')
        AND t.sale_price > 0 AND t.supply_price > 0 AND t.sale_price <= t.supply_price
    ),
    product_rate AS (
      SELECT pairs.group_cd, pairs.product_cd,
        MAX((1 - l.sale_price / l.supply_price) * 100) AS rate
      FROM pairs
      JOIN price_log l ON l.product_cd = pairs.product_cd
        AND l.d <= pairs.e AND (l.nd IS NULL OR l.nd > pairs.s)
      GROUP BY pairs.group_cd, pairs.product_cd
    )
    SELECT
      pairs.group_cd,
      pairs.brand_cd,
      IFNULL(MAX(c2.code_nm2), pairs.brand_cd) AS brand_nm,
      pairs.partner_id,
      IFNULL(MAX(a.company_nm), ${mysql.escape(OWN_PARTNER_NAME)}) AS partner_name,
      COUNT(*) AS products,
      ROUND(AVG(pr.rate), 1) AS avg_rate,
      ROUND(MAX(pr.rate)) AS max_rate
    FROM pairs
    LEFT JOIN product_rate pr ON pr.group_cd = pairs.group_cd AND pr.product_cd = pairs.product_cd
    LEFT JOIN wt_admin a ON a.\`no\` = pairs.partner_id
    LEFT JOIN wt_code2 c2 ON c2.code_cd2 = pairs.brand_cd
    GROUP BY pairs.group_cd, pairs.brand_cd, pairs.partner_id
  `;
}

/** 전시 하나의 크기 — products·brands 는 위탁만, own_products 는 자체 상품 수 */
const GROUP_COLUMNS = `
      g.group_cd,
      g.group_nm,
      g.list_type,
      DATE_FORMAT(g.s_date, '%Y-%m-%d') AS s,
      DATE_FORMAT(g.e_date, '%Y-%m-%d') AS e,
      COUNT(DISTINCT CASE WHEN NOT (${OWN}) THEN gp.product_cd END) AS products,
      COUNT(DISTINCT CASE WHEN NOT (${OWN}) THEN p.brand_cd END) AS brands,
      COUNT(DISTINCT CASE WHEN ${OWN} THEN gp.product_cd END) AS own_products`;

const GROUP_FROM = `
    FROM wt_group g
    JOIN wt_group_product gp ON gp.group_cd = g.group_cd AND gp.use_yn = 'Y'
    JOIN wt_product p ON p.product_cd = gp.product_cd
    JOIN wt_admin a ON a.\`no\` = p.supplier`;

/** 전시 종류 — main: 위탁 브랜드 minBrands 곳 이상 · pb: 자체 상품 기획전 · null: 그 밖(브랜드위크 등) */
export function groupKind(
  g: { products: number; brands: number; own_products: number },
  minBrands: number
): "main" | "pb" | null {
  if (g.brands >= minBrands) return "main";
  const all = g.products + g.own_products;
  if (g.own_products >= PB_MIN_OWN_PRODUCTS && all > 0 && g.own_products / all >= PB_MIN_OWN_SHARE) return "pb";
  return null;
}

/**
 * 전시 목록 — 위탁 브랜드가 minBrands 곳 이상 올라간 전시(메인급 후보)와 PB 기획전.
 * 브랜드위크처럼 한두 브랜드만 있는 전시는 여기 오지 않고, 브랜드 조회로만 봅니다.
 */
export function promoGroupsSQL(r: PromoGroupRange, minBrands: number): string {
  return `
    SELECT ${GROUP_COLUMNS}
    ${GROUP_FROM}
    WHERE ${overlaps(r)}
    GROUP BY g.group_cd
    HAVING brands >= ${Number(minBrands)}
      OR (own_products >= ${PB_MIN_OWN_PRODUCTS} AND own_products >= ${PB_MIN_OWN_SHARE} * (own_products + products))
    ORDER BY g.s_date, g.group_cd
  `;
}

/** 위 전시들의 브랜드별 참여 상품 수·할인율 — 위탁과 자체(partner_id 0) 둘 다 */
export function promoGroupBrandsSQL(groupCds: number[]): string {
  return brandStatsSQL(`g.group_cd IN (${groupCds.map((c) => mysql.escape(c)).join(",")})`, "all");
}

/**
 * 한 브랜드가 올라간 모든 전시 — 크기와 상관없이 (브랜드위크 포함). 전시 정보는 groupInfoSQL.
 * own 이면 그 브랜드의 자체 상품만, 아니면 위탁 상품만 봅니다 (사입 브랜드는 위탁사도 같은 브랜드를 팝니다).
 */
export function brandGroupStatsSQL(r: PromoGroupRange, brandCd: string, own = false): string {
  return brandStatsSQL(`${overlaps(r)} AND p.brand_cd = ${mysql.escape(brandCd)}`, own ? "own" : "consign");
}

/** 전시 정보 — 이름·기간과 전시 전체 상품·브랜드 수 */
export function groupInfoSQL(groupCds: number[]): string {
  return `
    SELECT ${GROUP_COLUMNS}
    ${GROUP_FROM}
    WHERE g.group_cd IN (${groupCds.map((c) => mysql.escape(c)).join(",")})
    GROUP BY g.group_cd
    ORDER BY g.s_date, g.group_cd
  `;
}

// ─── 자체 상품 매출 ─────────────────────────────────────────────────────────
// 다른 매출 API(/api/integrated, /api/partners/…)는 자체 계정을 빼므로 PB 기획전 매출은 여기서 냅니다.
// 산식은 같은 태블로 실매출(salesLines.ts)이고, 자체 계정 여럿을 브랜드별로 합칩니다.

/** 기간 중 자체 상품의 브랜드별 매출 — /api/integrated 행과 같은 모양 (partner_id 0) */
export function ownBrandSalesSQL(start: Date, end: Date): string {
  return `
    SELECT
      ${OWN_PARTNER_ID} AS partner_id,
      ${mysql.escape(OWN_PARTNER_NAME)} AS partner_name,
      s.brand_cd AS brand_cd,
      IFNULL(MAX(c2.code_nm2), s.brand_cd) AS brand_nm,
      COUNT(DISTINCT s.ocode) AS order_count,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ start, end })}) s
    JOIN wt_admin a ON a.\`no\` = s.supplier
    LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
    WHERE ${OWN}
    GROUP BY s.brand_cd
    HAVING total_sales > 0
    ORDER BY total_sales DESC
  `;
}

/** 자체 브랜드 하나의 일별 매출 — /api/partners/{no}/brands/{cd} 의 sales 와 같은 열 */
export function ownBrandDailySQL(brandCd: string, start: Date, end: Date): string {
  return `
    SELECT
      DATE_FORMAT(s.reg_date, '%Y-%m-%d') AS sale_date,
      COUNT(DISTINCT s.ocode) AS order_count,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ brandCd, start, end })}) s
    JOIN wt_admin a ON a.\`no\` = s.supplier
    WHERE ${OWN}
    GROUP BY DATE_FORMAT(s.reg_date, '%Y-%m-%d')
    ORDER BY sale_date
  `;
}
