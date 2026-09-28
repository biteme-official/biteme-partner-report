/**
 * 찜 — 브랜드 찜(wt_brand_wishlist)·상품 찜(wt_wishlist) 집계.
 *
 * 프로모션 센터 주간 매출 리포트 메일이 씁니다. 전체 위탁사 몫을 한 번에 돌려주므로
 * 메일 645통이어도 조회는 한 번입니다 (매출의 /api/integrated 와 같은 방식).
 *
 * 🔑 키 맞추기
 *   - 브랜드 찜의 brand_cd 는 wt_brand.brand_seq 입니다. 매출 쪽 brand_cd(= wt_code2.code_cd2)는
 *     wt_brand.brand_type_s 라서, wt_brand 를 거쳐 brand_type_s 로 바꿔 돌려줍니다.
 *   - 상품 찜은 wt_product.brand_cd 가 곧 매출 쪽 brand_cd 입니다.
 *
 * 🔴 찜을 해제하면 행이 지워집니다. 그래서
 *   - 누적 찜(total_wish) = 지금 찜하고 있는 사람 수
 *   - 기간 찜(period_wish) = 기간 안에 찜해서 **아직 유지 중인** 수 (해제된 건 빠짐, 순증 아님)
 */

/** YYYY-MM-DD 두 개 — 호출하는 쪽에서 형식을 검사합니다 */
export interface WishRange {
  start: string;
  end: string;
}

const periodCond = (col: string, r: WishRange) =>
  `${col} >= '${r.start} 00:00:00' AND ${col} < DATE_ADD('${r.end}', INTERVAL 1 DAY)`;

/** 브랜드별 기간 찜·누적 찜 (매출 쪽 brand_cd 기준, 누적 1건 이상인 브랜드만) */
export function brandWishSQL(r: WishRange): string {
  return `
    SELECT
      b.brand_type_s AS brand_cd,
      IFNULL(MAX(c.code_nm2), b.brand_type_s) AS brand_nm,
      CAST(SUM(CASE WHEN ${periodCond("w.reg_date", r)} THEN 1 ELSE 0 END) AS UNSIGNED) AS period_wish,
      COUNT(*) AS total_wish
    FROM wt_brand_wishlist w
    JOIN wt_brand b ON b.brand_seq = w.brand_cd AND b.use_yn = 'Y'
    LEFT JOIN wt_code2 c ON c.code_cd2 = b.brand_type_s
    GROUP BY b.brand_type_s
  `;
}

/**
 * 위탁사별로 기간 찜이 많은 상품 상위 N개와 그 상품의 누적 찜.
 * 누적은 상위 N개로 줄인 뒤에만 셉니다 — 찜 전체를 상품별로 먼저 세면 무겁습니다.
 */
export function topProductWishSQL(r: WishRange, perPartner: number): string {
  const n = Math.max(1, Math.floor(perPartner));
  return `
    SELECT
      t.partner_id, a.company_nm AS partner_name, t.product_cd, t.product_nm, t.brand_cd, t.product_state, t.display_yn, t.period_wish,
      (SELECT COUNT(*) FROM wt_wishlist w2 WHERE w2.product_cd = t.product_cd) AS total_wish
    FROM (
      SELECT
        p.supplier AS partner_id,
        p.product_cd,
        p.product_nm,
        p.brand_cd,
        p.product_state,
        p.display_yn,
        wp.period_wish,
        ROW_NUMBER() OVER (PARTITION BY p.supplier ORDER BY wp.period_wish DESC, p.product_cd ASC) AS rn
      FROM (
        SELECT product_cd, COUNT(*) AS period_wish
        FROM wt_wishlist
        WHERE ${periodCond("reg_date", r)}
        GROUP BY product_cd
      ) wp
      JOIN wt_product p ON p.product_cd = wp.product_cd
      WHERE p.del_yn = 'n'
    ) t
    LEFT JOIN wt_admin a ON a.\`no\` = t.partner_id
    WHERE t.rn <= ${n}
    ORDER BY t.partner_id, t.rn
  `;
}
