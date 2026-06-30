"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import SalesOverview from "@/components/SalesOverview";
import ProductMix from "@/components/ProductMix";
import InsightSection from "@/components/InsightSection";
import BuyerAnalysis from "@/components/BuyerAnalysis";
import PeriodFilter, { type DateRange, type PeriodPreset } from "@/components/PeriodFilter";
import type {
  PartnerDetail,
  DailySales,
  HourlySales,
  ProductSales,
  BrandInfo,
  MonthlySales,
  GrowthProduct,
  ReturnRate,
  BuyerTypeSummary,
  BuyerMonthly,
} from "@/lib/types";

interface DetailData {
  detail: PartnerDetail;
  sales: DailySales[] | HourlySales[];
  granularity: "daily" | "hourly";
  products: ProductSales[];
  brands: BrandInfo[];
}

interface InsightData {
  monthly: MonthlySales[];
  growth: GrowthProduct[];
  returnRate: ReturnRate | null;
  buyerType: BuyerTypeSummary[];
  buyerMonthly: BuyerMonthly[];
}

function toApiDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<DetailData | null>(null);
  const [compareData, setCompareData] = useState<Pick<DetailData, "sales"> | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ main: DateRange; compare: DateRange | null; isHourly: boolean } | null>(null);

  const handleFilterChange = useCallback((main: DateRange, compare: DateRange | null, preset: PeriodPreset) => {
    setFilter({ main, compare, isHourly: preset === "today" });
  }, []);

  useEffect(() => {
    if (!filter) return;

    const controller = new AbortController();
    const { signal } = controller;

    const safeFetch = (url: string): Promise<unknown> =>
      fetch(url, { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

    setLoading(true);

    const { main, compare: compareDateRange, isHourly } = filter;
    const granularityParam = isHourly ? "&granularity=hourly" : "";
    const startStr = toApiDate(main.start);
    const endStr = toApiDate(main.end);
    const mainUrl = `/api/partners/${id}?startDate=${startStr}&endDate=${endStr}${granularityParam}`;

    const cmpPromise: Promise<DetailData | null> = compareDateRange
      ? (() => {
          const cStart = toApiDate(compareDateRange.start);
          const cEnd = toApiDate(compareDateRange.end);
          return safeFetch(`/api/partners/${id}?startDate=${cStart}&endDate=${cEnd}${granularityParam}`) as Promise<DetailData>;
        })()
      : Promise.resolve(null);

    Promise.all([
      safeFetch(mainUrl) as Promise<DetailData>,
      safeFetch(`/api/partners/${id}/insights`).catch(() => null) as Promise<InsightData | null>,
      cmpPromise,
    ])
      .then(([detailData, insightData, cmpData]) => {
        if (signal.aborted) return;
        setData(detailData);
        setInsights(insightData);
        setCompareData(cmpData ? { sales: cmpData.sales } : null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          console.error(err);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id, filter]);

  const { detail, sales = [], products = [], brands = [] } = data ?? {};

  const totalSales = sales.reduce((s, d) => s + Number(d.total_sales), 0);
  const totalOrders = sales.reduce((s, d) => s + Number(d.order_count), 0);
  const totalBuyers = sales.reduce((s, d) => s + Number(d.buyer_count), 0);

  const compareSales = compareData?.sales ?? [];
  const compareTotalSales = compareData ? compareSales.reduce((s, d) => s + Number(d.total_sales), 0) : undefined;
  const compareTotalOrders = compareData ? compareSales.reduce((s, d) => s + Number(d.order_count), 0) : undefined;
  const compareTotalBuyers = compareData ? compareSales.reduce((s, d) => s + Number(d.buyer_count), 0) : undefined;

  return (
    <main className="max-w-[224.64rem] mx-auto px-4 py-8">
      {/* 목록 링크 */}
      <div className="flex items-center gap-3 mb-4 no-print">
        <Link href="/" className="text-blue-500 hover:text-blue-700 text-sm shrink-0">
          &larr; 목록
        </Link>
      </div>

      {/* 기간 필터 + 비교 옵션 — 항상 렌더링 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 no-print">
        <PeriodFilter onChange={handleFilterChange} />
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {/* 데이터 없음 */}
      {!loading && !detail && (
        <p className="text-center text-gray-400 py-20">파트너사를 찾을 수 없습니다</p>
      )}

      {/* 메인 콘텐츠 */}
      {!loading && detail && (
        <>
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{detail.partner_name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <span>
                입점일:{" "}
                {detail.joined_date
                  ? new Date(detail.joined_date).toLocaleDateString("ko-KR")
                  : "-"}
              </span>
              <span>브랜드: {detail.brand_count}개</span>
              <span>
                상품: {detail.active_product_count}/{detail.total_product_count}개 (활성/전체)
              </span>
            </div>
          </header>

          {brands.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">취급 브랜드</h2>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <span
                    key={b.brand_cd}
                    className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-full"
                  >
                    {b.brand_nm}{" "}
                    <span className="text-gray-400">({b.active_count})</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <div className="space-y-6">
            <SalesOverview
              sales={sales}
              isHourly={filter?.isHourly}
              totalSales={totalSales}
              totalOrders={totalOrders}
              totalBuyers={totalBuyers}
              compareSales={compareSales.length > 0 ? compareSales : undefined}
              compareTotalSales={compareTotalSales}
              compareTotalOrders={compareTotalOrders}
              compareTotalBuyers={compareTotalBuyers}
            />

            <ProductMix products={products} />

            {insights?.buyerType && insights.buyerType.length > 0 && (
              <BuyerAnalysis
                summary={insights.buyerType}
                monthly={insights.buyerMonthly}
              />
            )}

            {insights && (
              <InsightSection
                monthly={insights.monthly}
                growth={insights.growth}
                returnRate={insights.returnRate}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
