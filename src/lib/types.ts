export interface SalesBreakdown {
  /** 태블로 실매출 = 매출액 − 쿠폰 − 적립금 − 예치금 */
  total_sales: number;
  /** 태블로 매출액 = 상품가 + 배송비 */
  gross_sales: number;
  coupon: number;
  reserve: number;
  deposit: number;
  trans: number;
}

export interface PartnerSummary {
  partner_id: number;
  partner_name: string;
  product_count: number;
  active_product_count: number;
  order_count: number;
  total_sales: number;
  gross_sales: number;
}

export interface PartnerBasic {
  partner_id: number;
  partner_name: string;
}

export interface BrandBasic {
  partner_id: number;
  partner_name: string;
  brand_cd: string;
  brand_nm: string;
}

export interface PartnerDetail {
  partner_id: number;
  partner_name: string;
  joined_date: string;
  total_product_count: number;
  active_product_count: number;
  brand_count: number;
}

export interface DailySales extends SalesBreakdown {
  sale_date: string;
  order_count: number;
  buyer_count: number;
  total_qty: number;
}

export interface HourlySales extends SalesBreakdown {
  sale_hour: number;
  order_count: number;
  buyer_count: number;
  total_qty: number;
}

export interface ProductSales extends SalesBreakdown {
  product_cd: string;
  product_nm: string;
  brand_nm: string;
  total_qty: number;
  order_count: number;
}

export interface BrandInfo {
  brand_cd: string;
  brand_nm: string;
  product_count: number;
  active_count: number;
}

export interface BrandDetail {
  partner_id: number;
  partner_name: string;
  brand_cd: string;
  brand_nm: string;
  total_product_count: number;
  active_product_count: number;
}

export interface MonthlySales extends SalesBreakdown {
  month: string;
  order_count: number;
  buyer_count: number;
  total_qty: number;
}

export interface WeeklySales extends SalesBreakdown {
  year_week: number;
  week_start: string;
  order_count: number;
  buyer_count: number;
  total_qty: number;
}

export interface GrowthProduct {
  product_cd: string;
  product_nm: string;
  prev_sales: number;
  curr_sales: number;
  growth_rate: number | null;
}

export interface BuyerTypeSummary {
  buyer_type: "new" | "repeat";
  buyer_count: number;
  total_sales: number;
  order_count: number;
  avg_order_value: number;
}

/** 브랜드별 신규/재구매 — 기준은 BuyerTypeSummary 와 같은 "이 위탁사에서의 첫 주문" */
export interface BuyerTypeByBrand {
  brand_cd: string;
  brand_nm: string;
  buyer_type: "new" | "repeat";
  buyer_count: number;
  total_sales: number;
  order_count: number;
}

export interface BuyerMonthly {
  month: string;
  buyer_type: "new" | "repeat";
  buyer_count: number;
  total_sales: number;
}

export interface DateRangeStr {
  start: string;
  end: string;
}

export interface ReturnRate {
  return_count: number;
  total_count: number;
  return_rate: number | null;
}

export interface IntegratedBrandSummary extends SalesBreakdown {
  partner_id: number;
  partner_name: string;
  brand_cd: string;
  brand_nm: string;
  order_count: number;
}

export interface PartnerSalesSeries {
  partner_id: number | null;
  partner_name: string;
  /** 조회 단위(월 또는 주차)별 거래액 */
  sales: number[];
  order_count: number[];
  sales_total: number;
}

export interface PartnerSalesYearResponse {
  year: number;
  /** index 0 = 1월 */
  months: number[];
  partners: PartnerSalesSeries[];
}

export interface PartnerSalesWeekResponse {
  year: number;
  month: number;
  weeks: { no: number; start: string; end: string }[];
  partners: PartnerSalesSeries[];
}

/** /api/wishes — 브랜드 찜 (brand_cd 는 매출 쪽과 같은 wt_code2.code_cd2) */
export interface BrandWish {
  brand_cd: string;
  brand_nm: string;
  /** 기간 안에 찜해서 아직 유지 중인 수 (해제하면 행이 지워져 빠짐) */
  period_wish: number;
  /** 지금 찜하고 있는 수 */
  total_wish: number;
}

/** /api/wishes — 위탁사별 기간 찜 상위 상품 */
export interface ProductWish {
  partner_id: number;
  partner_name: string;
  product_cd: string;
  product_nm: string;
  brand_cd: string;
  /** wt_product.product_state — 0 준비중 · 1 승인요청 · 2 판매중 · 3 판매중지 · 4 품절 */
  product_state: string;
  display_yn: string;
  period_wish: number;
  total_wish: number;
}

export interface WishesResponse {
  period: { start: string; end: string };
  brands: BrandWish[];
  products: ProductWish[];
}
