export interface PartnerSummary {
  partner_id: number;
  partner_name: string;
  product_count: number;
  active_product_count: number;
  order_count: number;
  total_sales: number;
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

export interface ReturnRate {
  return_count: number;
  total_count: number;
  return_rate: number | null;
}
