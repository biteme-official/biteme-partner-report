"use client";

import Link from "next/link";
import type { PartnerSummary } from "@/lib/types";

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return formatNumber(n);
}

export default function PartnerCard({ partner }: { partner: PartnerSummary }) {
  return (
    <Link
      href={`/partners/${partner.partner_id}`}
      className="block w-[400px] bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 truncate">
          {partner.partner_name}
        </h3>
        <span className="text-xs text-gray-400 ml-2 shrink-0">
          #{partner.partner_id}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-gray-500">매출</p>
          <p className="font-medium text-gray-900">
            {formatCurrency(partner.total_sales)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">주문</p>
          <p className="font-medium text-gray-900">
            {formatNumber(partner.order_count)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">상품</p>
          <p className="font-medium text-gray-900">
            {partner.active_product_count}/{partner.product_count}
          </p>
        </div>
      </div>
    </Link>
  );
}
