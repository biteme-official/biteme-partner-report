"use client";

import Link from "next/link";
import type { IntegratedBrandSummary } from "@/lib/types";

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return formatNumber(n);
}

export default function IntegratedBrandCard({
  brand,
  salesRank,
}: {
  brand: IntegratedBrandSummary;
  salesRank?: number;
}) {
  return (
    <Link
      href={`/partners/${brand.partner_id}/brands/${brand.brand_cd}`}
      className="relative block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
    >
      {salesRank !== undefined && (
        <span className="absolute -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow">
          {salesRank}
        </span>
      )}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 truncate">
          {brand.brand_nm}
        </h3>
        <span className="text-xs text-gray-400 ml-2 shrink-0 truncate">
          {brand.partner_name}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">매출</p>
          <p className="font-medium text-gray-900">
            {formatCurrency(brand.total_sales)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">주문</p>
          <p className="font-medium text-gray-900">
            {formatNumber(brand.order_count)}
          </p>
        </div>
      </div>
    </Link>
  );
}
