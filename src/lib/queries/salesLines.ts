import mysql from "mysql2/promise";

/**
 * 태블로 실매출 재현용 공통 주문 라인 뷰 (이슈 #59).
 *
 * 태블로 산식
 *   실매출 = price + trans − coupon − reserve − deposit
 *   매출액 = price + trans
 *
 * DB 매핑
 *   price   = wt_order_product.total_price
 *   coupon  = wt_order_product.division_coupon_product_price
 *   reserve = wt_order_product.division_reserve_product_price + wt_order_product_trans.division_reserve_trans_price
 *   deposit = wt_order_product.division_deposit_product_price + wt_order_product_trans.division_deposit_trans_price
 *   trans   = wt_order_product_trans.trans_price + add_trans_price
 *
 * 🔴 wt_order_product_trans 는 같은 배송 묶음(ocode + product_trans_seq)의 상품 줄마다 배송비가 중복 기록되어 있다.
 *    (펫생각 상품 3개 주문 → 3,500원이 3줄) 줄별로 그냥 SUM 하면 배송비가 부풀려지므로
 *    묶음 안에서 상품가 비중으로 안분해 묶음당 1회만 잡히게 한다.
 *    (태블로 원본 쿼리와 같은 방식 — 상품가 합이 0이면 줄 수로 균등 분할)
 *    ⚠️ ocode+supplier 로 묶으면 한 주문에 배송 묶음이 둘인 경우(product_trans_seq 가 다른 줄) 값이 어긋난다 —
 *       실측: 3줄 중 1줄만 3,500원인 주문이 있어 supplier 기준 안분은 2,117원 모자랐다.
 *
 * 검증: 주식회사 펫생각(1502) 2026-09-01~ 재현 3,877,797 / 태블로 3,877,796 (일자별 ±3원, 안분 반올림 차이)
 * 태블로는 매일 11:30 갱신이라 당일 수치를 비교할 땐 reg_date < 당일 11:30 로 잘라야 한다.
 */

export const EXCLUDED_USER_IDS = [
  "ptest", "ptest2", "cafebiteme_SS", "cafebiteme_YN",
  "bite1008", "cafebiteme_CG",
];

// 태블로 실매출 기준 주문 상태 — 결제완료·배송준비·배송중·구매확정
export const SALES_ORDER_STATES = ["30", "35", "40", "90"];

const USERS = EXCLUDED_USER_IDS.map((v) => `'${v}'`).join(",");
const STATES = SALES_ORDER_STATES.map((v) => `'${v}'`).join(",");

export function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface SalesLineFilter {
  /** wt_product.supplier */
  partnerId?: string | number;
  /** wt_product.brand_cd */
  brandCd?: string;
  /** op.reg_date BETWEEN start AND end */
  start?: Date;
  end?: Date;
  /** op.reg_date >= (SQL 식 그대로, 예: DATE_SUB(CURDATE(), INTERVAL 6 MONTH)) */
  sinceExpr?: string;
  /** op.reg_date 하한·상한을 문자열로 직접 줄 때 (연·주차 조회) */
  fromStr?: string;
  toStr?: string;
  /** 회원 주문만 (구매자 분석) */
  memberOnly?: boolean;
  /** 응모권 상품 제외 여부 (기본 true) */
  excludeRaffle?: boolean;
}

/**
 * 모든 매출 쿼리가 공유하는 WHERE 절. 별칭은 op / oi / p 고정.
 * 기존 제외 규칙(테스트 계정·응모권·order_yn)은 유지하고, 상태만 태블로 기준 IN 으로 바꿨다.
 */
export function salesWhereSQL(f: SalesLineFilter): string {
  const conds = [
    `oi.order_yn = 'y'`,
    `op.product_order_state_cd IN (${STATES})`,
    f.memberOnly
      ? `oi.user_id IS NOT NULL AND oi.user_id NOT IN (${USERS})`
      : `(oi.user_id IS NULL OR oi.user_id NOT IN (${USERS}))`,
  ];
  if (f.excludeRaffle !== false) conds.push(`op.product_nm NOT LIKE '%응모권%'`);
  if (f.partnerId !== undefined) conds.push(`p.supplier = ${Number(f.partnerId)}`);
  if (f.brandCd !== undefined) conds.push(`p.brand_cd = ${mysql.escape(f.brandCd)}`);
  if (f.start && f.end) conds.push(`op.reg_date BETWEEN '${fmt(f.start)}' AND '${fmt(f.end)}'`);
  if (f.sinceExpr) conds.push(`op.reg_date >= ${f.sinceExpr}`);
  if (f.fromStr) conds.push(`op.reg_date >= '${f.fromStr}'`);
  if (f.toStr) conds.push(`op.reg_date <= '${f.toStr}'`);
  return conds.join("\n      AND ");
}

/**
 * 상품 줄 하나 = 한 행. 바깥에서 `(${salesLinesSQL(f)}) s` 로 감싸 원하는 축으로 접는다.
 *
 * 컬럼
 *   price, coupon, reserve, deposit          — 상품 줄 값
 *   trans, trans_reserve, trans_deposit      — 배송비·배송비 적립금·예치금 (배송 묶음당 1회, 상품가 비중 안분)
 *   gross_sales = price + trans              — 태블로 매출액
 *   net_sales   = 태블로 실매출
 *   그 외 ocode·product_ocode·product_cd·product_nm·qty·reg_date·supplier·brand_cd·user_id
 */
export function salesLinesSQL(f: SalesLineFilter): string {
  // 배송비는 묶음 안 줄마다 같은 값이 복사돼 있으니, 상품가 비중을 곱해 더하면 묶음당 정확히 1회가 된다.
  // supplier 는 product_trans_seq 가 비어 있는 옛 주문에서 다른 위탁사 줄과 섞이지 않게 하는 안전장치.
  const share = `IF(SUM(op.total_price) OVER w > 0,
        op.total_price / SUM(op.total_price) OVER w,
        1 / COUNT(*) OVER w)`;

  return `
    SELECT
      l.*,
      (l.price + l.trans) AS gross_sales,
      (l.price + l.trans - l.coupon - l.reserve - l.deposit - l.trans_reserve - l.trans_deposit) AS net_sales
    FROM (
      SELECT
        op.ocode,
        op.product_ocode,
        op.product_cd,
        op.product_nm,
        op.qty,
        op.reg_date,
        p.supplier,
        p.brand_cd,
        oi.user_id,
        op.total_price AS price,
        CASE
          WHEN op.coupon_use_yn = 'n' OR IFNULL(op.division_coupon_product_price, 0) < 5 THEN 0
          ELSE op.division_coupon_product_price
        END AS coupon,
        IFNULL(op.division_reserve_product_price, 0) AS reserve,
        IFNULL(op.division_deposit_product_price, 0) AS deposit,
        ROUND((IFNULL(t.trans_price, 0) + IFNULL(t.add_trans_price, 0)) * ${share}) AS trans,
        ROUND(IFNULL(t.division_reserve_trans_price, 0) * ${share}) AS trans_reserve,
        ROUND(IFNULL(t.division_deposit_trans_price, 0) * ${share}) AS trans_deposit
      FROM wt_order_product op
      JOIN wt_order_info oi ON op.ocode = oi.ocode
      JOIN wt_product p ON op.product_cd = p.product_cd
      LEFT JOIN wt_order_product_trans t ON t.product_ocode = op.product_ocode
      WHERE ${salesWhereSQL(f)}
      WINDOW w AS (PARTITION BY op.ocode, p.supplier, op.product_trans_seq)
    ) l
  `;
}

/** 집계 쿼리에서 반복되는 매출 컬럼 묶음. 별칭 s 고정. */
export const SALES_AGG_COLUMNS = `
      ROUND(SUM(s.net_sales)) AS total_sales,
      ROUND(SUM(s.gross_sales)) AS gross_sales,
      ROUND(SUM(s.coupon)) AS coupon,
      ROUND(SUM(s.reserve + s.trans_reserve)) AS reserve,
      ROUND(SUM(s.deposit + s.trans_deposit)) AS deposit,
      ROUND(SUM(s.trans)) AS trans`;
