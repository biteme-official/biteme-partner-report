"use client";

import Link from "next/link";
import type { IntegratedBrandSummary } from "@/lib/types";
import { formatNumber } from "@/lib/format";

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
      className="flex items-center gap-3 py-3 px-2 hover:bg-gray-50 transition-colors"
    >
      <span className="text-sm font-bold text-gray-400 w-6 text-right shrink-0">
        {salesRank ?? ""}
      </span>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-800 truncate">
          {brand.brand_nm}
        </span>
        <span className="text-xs text-gray-400 truncate shrink-0">
          {brand.partner_name}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-orange-600 tabular-nums">
          {formatNumber(brand.total_sales)}원
        </span>
        <span className="text-xs text-gray-400 tabular-nums w-14 text-right">
          {formatNumber(brand.order_count)}건
        </span>
      </div>
    </Link>
  );
}
