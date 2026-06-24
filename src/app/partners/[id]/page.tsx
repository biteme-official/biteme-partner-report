"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import SalesOverview from "@/components/SalesOverview";
import ProductMix from "@/components/ProductMix";
import InsightSection from "@/components/InsightSection";
import BuyerAnalysis from "@/components/BuyerAnalysis";
import PeriodFilter, {
  getPresetRange,
  formatDateRange,
} from "@/components/PeriodFilter";
import type { DateRange, CompareKey, PresetKey } from "@/components/PeriodFilter";
import type {
  PartnerDetail,
  DailySales,
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
  sales: DailySales[];
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

const COMPARE_LABELS: Record<CompareKey, string> = {
  preset: "프리셋",
  custom: "직접",
  off: "",
  prevPeriod: "전기간",
  prevWeek: "전주",
  prevMonth: "전월",
  prevYear: "전년동기",
};

function toApiDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [period, setPeriod] = useState<DateRange>(() => getPresetRange("thisMonth"));
  const [compareRange, setCompareRange] = useState<DateRange | null>(null);
  const [compareKey, setCompareKey] = useState<CompareKey>("off");

  const [data, setData] = useState<DetailData | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [compareData, setCompareData] = useState<DetailData | null>(null);
  const [compareInsights, setCompareInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const start = toApiDate(period.start);
    const end = toApiDate(period.end);
    const baseUrl = `/api/partners/${id}`;

    const fetches: Promise<unknown>[] = [
      fetch(`${baseUrl}?start=${start}&end=${end}`).then((r) => r.json()),
      fetch(`${baseUrl}/insights?start=${start}&end=${end}`).then((r) => r.json()),
    ];

    if (compareRange) {
      const cs = toApiDate(compareRange.start);
      const ce = toApiDate(compareRange.end);
      fetches.push(
        fetch(`${baseUrl}?start=${cs}&end=${ce}`).then((r) => r.json()),
        fetch(`${baseUrl}/insights?start=${cs}&end=${ce}`).then((r) => r.json()),
      );
    }

    Promise.all(fetches)
      .then(([detailData, insightData, cDetail, cInsight]) => {
        setData(detailData as DetailData);
        setInsights(insightData as InsightData);
        if (compareRange) {
          setCompareData(cDetail as DetailData);
          setCompareInsights(cInsight as InsightData);
        } else {
          setCompareData(null);
          setCompareInsights(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, period, compareRange]);

  function handlePeriodChange(range: DateRange, _preset: PresetKey) {
    setPeriod(range);
    // PeriodFilter가 onCompareChange를 통해 비교 범위를 함께 전달함
  }

  function handleCompareChange(range: DateRange | null, key: CompareKey) {
    setCompareKey(key);
    setCompareRange(range);
  }

  if (loading) {
    return (
      <main className="max-w-[224.64rem] mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      </main>
    );
  }

  if (!data?.detail) {
    return (
      <main className="max-w-[224.64rem] mx-auto px-4 py-8">
        <p className="text-center text-gray-400 py-20">
          파트너사를 찾을 수 없습니다
        </p>
      </main>
    );
  }

  const { detail, sales, products, brands } = data;
  const totalSales = sales.reduce((s, d) => s + Number(d.total_sales), 0);
  const totalOrders = sales.reduce((s, d) => s + Number(d.order_count), 0);
  const totalBuyers = sales.reduce((s, d) => s + Number(d.buyer_count), 0);

  const compareSales = compareData?.sales;
  const compareTotalSales = compareSales?.reduce((s, d) => s + Number(d.total_sales), 0);
  const compareTotalOrders = compareSales?.reduce((s, d) => s + Number(d.order_count), 0);
  const compareTotalBuyers = compareSales?.reduce((s, d) => s + Number(d.buyer_count), 0);
  const compareLabel = compareKey !== "off" ? COMPARE_LABELS[compareKey] : undefined;

  return (
    <main className="max-w-[224.64rem] mx-auto px-4 py-8">
      <div className="flex items-start gap-3 mb-6 no-print flex-wrap">
        <Link
          href="/"
          className="text-blue-500 hover:text-blue-700 text-sm mt-2"
        >
          &larr; 목록
        </Link>
        <div className="ml-auto">
          <PeriodFilter
            onPeriodChange={handlePeriodChange}
            onCompareChange={handleCompareChange}
          />
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {detail.partner_name}
        </h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
          <span>
            입점일: {detail.joined_date ? new Date(detail.joined_date).toLocaleDateString("ko-KR") : "-"}
          </span>
          <span>브랜드: {detail.brand_count}개</span>
          <span>
            상품: {detail.active_product_count}/{detail.total_product_count}개 (활성/전체)
          </span>
          <span className="text-orange-500 font-medium">
            {formatDateRange(period)}
          </span>
          {compareRange && (
            <span className="text-gray-400">
              비교: {formatDateRange(compareRange)} ({compareLabel})
            </span>
          )}
        </div>
      </header>

      {brands.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            취급 브랜드
          </h2>
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
          totalSales={totalSales}
          totalOrders={totalOrders}
          totalBuyers={totalBuyers}
          compareSales={compareSales}
          compareLabel={compareLabel}
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
            compareMonthly={compareInsights?.monthly}
            compareLabel={compareLabel}
          />
        )}
      </div>
    </main>
  );
}
