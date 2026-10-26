import mysql from "mysql2/promise";

/**
 * 위탁사 상세 쿼리가 보는 범위 (#83).
 *
 *   위탁사 하나 — wt_admin.no (지금까지처럼 문자열·숫자)
 *   바잇미 자체 — company_nm LIKE '%바잇미%' 인 계정 전부(/api/promo-groups?ownSales=1 과 같은 기준),
 *                 그중 brands 만 / notBrands 를 뺀 것. 브랜드는 wt_code2.code_nm2(브랜드명) 그대로 받습니다.
 *
 * promotion-manager 가 biteme_1 을 브랜드 이름으로 나눈 계정(PB 두 곳 + 사입 = 그 여집합)을 보려고 씁니다.
 * 바잇미 계정이 별도배송·모래배송 등 여러 곳으로 쪼개져 있어 계정 번호 하나로는 못 묶습니다.
 */
export interface OwnScope {
  own: true;
  /** 이 브랜드명만 */
  brands?: readonly string[];
  /** 이 브랜드명은 빼고 — 브랜드명이 없는(wt_code2 에 없는) 상품은 남깁니다 */
  notBrands?: readonly string[];
}

export type PartnerScope = string | number | OwnScope;

/** 경로의 이 번호가 바잇미 자체 — promoGroups.ts 의 OWN_PARTNER_ID 와 같은 값 */
export const OWN_SCOPE_ID = "0";

export const isOwnScope = (s: PartnerScope): s is OwnScope => typeof s === "object";

const brandCodesOf = (names: readonly string[]) =>
  `SELECT bc.code_cd2 FROM wt_code2 bc WHERE bc.code_cd2 IS NOT NULL AND bc.code_nm2 IN (${names.map((n) => mysql.escape(n)).join(",")})`;

/** 계정 조건 — col 은 wt_product.supplier 를 가리키는 컬럼 */
export function scopeSupplierSQL(scope: PartnerScope, col: string): string {
  if (!isOwnScope(scope)) return `${col} = ${Number(scope)}`;
  return `${col} IN (SELECT wa.\`no\` FROM wt_admin wa WHERE wa.company_nm LIKE '%바잇미%')`;
}

/** 브랜드 조건 — col 은 brand_cd 컬럼. 위탁사 하나면 조건 없음(null) */
export function scopeBrandSQL(scope: PartnerScope, col: string): string | null {
  if (!isOwnScope(scope)) return null;
  const conds: string[] = [];
  // 빈 목록은 「아무 브랜드도 아님」 — IN () 은 문법 오류라 거짓으로 둡니다
  if (scope.brands) conds.push(scope.brands.length ? `${col} IN (${brandCodesOf(scope.brands)})` : "FALSE");
  if (scope.notBrands?.length) conds.push(`(${col} IS NULL OR ${col} NOT IN (${brandCodesOf(scope.notBrands)}))`);
  return conds.length ? conds.join(" AND ") : null;
}

/** 상품 별칭 하나에 계정 + 브랜드 조건을 함께 — 배송비 안분이 없는 쿼리(상품 수·반품률 등)용 */
export function scopeProductSQL(scope: PartnerScope, alias = "p"): string {
  const brand = scopeBrandSQL(scope, `${alias}.brand_cd`);
  return brand ? `${scopeSupplierSQL(scope, `${alias}.supplier`)} AND ${brand}` : scopeSupplierSQL(scope, `${alias}.supplier`);
}

const MAX_BRANDS = 50;
const MAX_BRAND_LEN = 100;

/**
 * 경로 id + 쿼리를 범위로 — id 가 0 이면 `brand` / `notBrand`(여러 번)를 읽습니다.
 * 잘못된 값이면 오류 문구(string)를 돌려줍니다.
 */
export function parsePartnerScope(id: string, params: URLSearchParams): PartnerScope | string {
  if (id !== OWN_SCOPE_ID) return id;
  const brands = params.getAll("brand").map((s) => s.trim()).filter(Boolean);
  const notBrands = params.getAll("notBrand").map((s) => s.trim()).filter(Boolean);
  const all = [...brands, ...notBrands];
  if (all.length > MAX_BRANDS || all.some((b) => b.length > MAX_BRAND_LEN)) return "brand / notBrand 가 너무 많거나 깁니다";
  return {
    own: true,
    ...(params.has("brand") ? { brands } : {}),
    ...(notBrands.length ? { notBrands } : {}),
  };
}
