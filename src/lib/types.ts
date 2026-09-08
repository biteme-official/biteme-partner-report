export interface PartnerSummary {
  partner_id: number;
  partner_name: string;
  product_count: number;
  active_product_count: number;
  order_count: number;
  total_sales: number;
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

export interface DailySales {
  sale_date: string;
  order_count: number;
  buyer_count: number;
  total_qty: number;
  total_sales: number;
}

export interface HourlySales {
  sale_hour: number;
  order_count: number;
  buyer_count: number;
  total_qty: number;
  total_sales: number;
}

export interface ProductSales {
  product_cd: string;
  product_nm: string;
  brand_nm: string;
  total_qty: number;
  order_count: number;
  total_sales: number;
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

export interface MonthlySales {
  month: string;
  order_count: number;
  buyer_count: number;
  total_qty: number;
  total_sales: number;
}

export interface WeeklySales {
  year_week: number;
  week_start: string;
  order_count: number;
  buyer_count: number;
  total_qty: number;
  total_sales: number;
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

export interface IntegratedBrandSummary {
  partner_id: number;
  partner_name: string;
  brand_cd: string;
  brand_nm: string;
  order_count: number;
  total_sales: number;
}

export interface ContributionMonthPoint {
  month: number;
  contribution: number;
  sales: number;
  order_count: number;
  /** 아직 끝나지 않은 달 — 증감 비교에서 제외한다 */
  partial: boolean;
}

export interface ContributionPartnerRow {
  partner_id: number | null;
  partner_name: string;
  /** index 0 = 1월 */
  contribution: number[];
  sales: number[];
  orders: number[];
  contribution_total: number;
  sales_total: number;
  /** 시트에 공헌이익 행이 있는지 */
  in_sheet: boolean;
}

export interface ContributionMeta {
  sheet_partner_count: number;
  matched_partner_count: number;
  /** 시트에는 있는데 DB 파트너사명과 못 맞춘 공급사 */
  unmatched_sheet_partners: string[];
  /** 매출은 있는데 시트에 공헌이익 행이 없는 파트너사 */
  sales_only_partner_count: number;
  sales_only_total: number;
  current_month: number | null;
}

export interface ContributionYearResponse {
  year: number;
  months: ContributionMonthPoint[];
  partners: ContributionPartnerRow[];
  meta: ContributionMeta;
}

export interface ContributionWeekPoint {
  week_no: number;
  start: string;
  end: string;
  contribution: number;
  sales: number;
  order_count: number;
  partial: boolean;
}

export interface ContributionWeekPartnerRow {
  partner_id: number | null;
  partner_name: string;
  contribution: number[];
  sales: number[];
  contribution_total: number;
  sales_total: number;
}

export interface ContributionWeekResponse {
  year: number;
  month: number;
  /** 해당 연월의 주차별 시트 탭이 있는지 */
  sheet_available: boolean;
  basis_label: string;
  weeks: ContributionWeekPoint[];
  partners: ContributionWeekPartnerRow[];
  /** 시트 주차 열 수와 달력에서 계산한 주차 수가 다르면 채운다 */
  week_count_warning: string | null;
}
