import mysql from "mysql2/promise";
import { salesLinesSQL, SALES_AGG_COLUMNS } from "./salesLines";

// 매출은 태블로 실매출 산식(salesLines.ts)으로 낸다 — 이슈 #59

export type IntegratedSpecies = "dog" | "cat";

// wt_product_category.category1_cd → 종/세부카테고리 매핑 (담당자 전달 기준)
const CATEGORY_CODES: Record<IntegratedSpecies, Record<string, string[]>> = {
  dog: {
    "사료": ["031001"],
    "간식": ["031002"],
    "영양제": ["031009"],
    "용품": ["031004", "031006"],
    "의류/스타일": ["031003"],
    "장난감": ["031005"],
  },
  cat: {
    "사료": ["017001"],
    "간식": ["017003"],
    "영양제": ["017014"],
    "모래": ["017012"],
    "의류/스타일": ["017005"],
    "스크래쳐/캣타워": ["017016"],
    "화장실/위생": ["017015"],
    "용품": ["017011"],
    "장난감": ["017006"],
  },
};

export function subCategoriesFor(species: IntegratedSpecies): string[] {
  return Object.keys(CATEGORY_CODES[species]);
}

function categoryCodesFor(species: IntegratedSpecies, subCategory: string | null): string[] {
  const bySub = CATEGORY_CODES[species];
  if (!subCategory) return Object.values(bySub).flat();
  const codes = bySub[subCategory];
  if (!codes) throw new Error(`Unknown subCategory "${subCategory}" for species "${species}"`);
  return codes;
}

export function integratedBrandListSQL(
  species: "all" | IntegratedSpecies,
  subCategory: string | null,
  start: Date,
  end: Date
): string {
  const categoryFilter =
    species === "all"
      ? ""
      : `AND EXISTS (
          SELECT 1 FROM wt_product_category pc
          WHERE pc.product_cd = s.product_cd
            AND pc.category1_cd IN (${categoryCodesFor(species, subCategory).map((c) => mysql.escape(c)).join(",")})
        )`;

  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      s.brand_cd AS brand_cd,
      IFNULL(MAX(c2.code_nm2), s.brand_cd) AS brand_nm,
      COUNT(DISTINCT s.ocode) AS order_count,
      ${SALES_AGG_COLUMNS}
    FROM (${salesLinesSQL({ start, end })}) s
    JOIN wt_admin a ON a.\`no\` = s.supplier
    LEFT JOIN wt_code2 c2 ON s.brand_cd = c2.code_cd2
    WHERE a.company_nm NOT LIKE '%바잇미%'
      ${categoryFilter}
    GROUP BY a.\`no\`, a.company_nm, s.brand_cd
    HAVING total_sales > 0
    ORDER BY total_sales DESC
  `;
}
