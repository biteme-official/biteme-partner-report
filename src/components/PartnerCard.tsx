"use client";

import Link from "next/link";
import type { PartnerSummary } from "@/lib/types";
import { formatNumber, formatCurrency } from "@/lib/format";

export default function PartnerCard({
  partner,
  salesRank,
}: {
  partner: PartnerSummary;
  salesRank?: number;
}) {
  return (
    <Link
      href={`/partners/${partner.partner_id}`}
      className="relative block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
    >
      {salesRank !== undefined && (
        <span className="absolute -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow">
          {salesRank}
        </span>
      )}
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
