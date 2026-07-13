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

function categoryCodesFor(species: IntegratedSpecies, subCategory: string | null): string[] {
  const bySub = CATEGORY_CODES[species];
  if (subCategory && bySub[subCategory]) return bySub[subCategory];
  return Object.values(bySub).flat();
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
          WHERE pc.product_cd = op.product_cd
            AND pc.category1_cd IN (${categoryCodesFor(species, subCategory).map((c) => mysql.escape(c)).join(",")})
        )`;

  return `
    SELECT
      a.\`no\` AS partner_id,
      a.company_nm AS partner_name,
      p.brand_cd AS brand_cd,
      IFNULL(MAX(c2.code_nm2), p.brand_cd) AS brand_nm,
      COUNT(DISTINCT op.ocode) AS order_count,
      ROUND(SUM(op.total_price)) AS total_sales
    FROM wt_order_product op
    JOIN wt_order_info oi ON op.ocode = oi.ocode
    JOIN wt_product p ON op.product_cd = p.product_cd
    JOIN wt_admin a ON a.\`no\` = p.supplier
    LEFT JOIN wt_code2 c2 ON p.brand_cd = c2.code_cd2
    WHERE a.company_nm NOT LIKE '%바잇미%'
      AND oi.order_yn = 'y'
      AND op.product_order_state_cd NOT IN (${STATES})
      AND (oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))
      AND op.product_nm NOT LIKE '%응모권%'
      AND op.reg_date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
      ${categoryFilter}
    GROUP BY a.\`no\`, a.company_nm, p.brand_cd
    HAVING total_sales > 0
    ORDER BY total_sales DESC
  `;
}
