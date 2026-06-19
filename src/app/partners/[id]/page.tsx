"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import SalesOverview from "@/components/SalesOverview";
import ProductMix from "@/components/ProductMix";
import InsightSection from "@/components/InsightSection";
import BuyerAnalysis from "@/components/BuyerAnalysis";
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

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<DetailData | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/partners/${id}?days=${days}`).then((r) => r.json()),
      fetch(`/api/partners/${id}/insights`).then((r) => r.json()),
    ])
      .then(([detailData, insightData]) => {
        setData(detailData);
        setInsights(insightData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, days]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </main>
    );
  }

  if (!data?.detail) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
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

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6 no-print">
        <Link
          href="/"
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          &larr; 목록
        </Link>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                days === d
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      <header className="mb-8">
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
    </main>
  );
}
