"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { BuyerTypeSummary, BuyerMonthly } from "@/lib/types";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ko-KR");
}

interface Props {
  summary: BuyerTypeSummary[];
  monthly: BuyerMonthly[];
}

export default function BuyerAnalysis({ summary, monthly }: Props) {
  const newData = summary.find((s) => s.buyer_type === "new");
  const repeatData = summary.find((s) => s.buyer_type === "repeat");
  const totalBuyers =
    Number(newData?.buyer_count ?? 0) + Number(repeatData?.buyer_count ?? 0);
  const newRatio =
    totalBuyers > 0
      ? ((Number(newData?.buyer_count ?? 0) / totalBuyers) * 100).toFixed(1)
      : "0";
  const repeatRatio =
    totalBuyers > 0
      ? ((Number(repeatData?.buyer_count ?? 0) / totalBuyers) * 100).toFixed(1)
      : "0";

  const months = [...new Set(monthly.map((m) => m.month))].sort();
  const chartData = months.map((month) => {
    const newRow = monthly.find(
      (m) => m.month === month && m.buyer_type === "new"
    );
    const repeatRow = monthly.find(
      (m) => m.month === month && m.buyer_type === "repeat"
    );
    return {
      month,
      new: Number(newRow?.buyer_count ?? 0),
      repeat: Number(repeatRow?.buyer_count ?? 0),
      newSales: Number(newRow?.total_sales ?? 0),
      repeatSales: Number(repeatRow?.total_sales ?? 0),
    };
  });

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        신규 / 재구매 분석
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-700">신규 고객</span>
            <span className="text-xs text-blue-500">{newRatio}%</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {Number(newData?.buyer_count ?? 0).toLocaleString("ko-KR")}
            <span className="text-sm font-normal text-blue-600 ml-1">명</span>
          </p>
          <div className="mt-2 text-sm text-blue-600 space-y-0.5">
            <p>매출 {formatCurrency(Number(newData?.total_sales ?? 0))}</p>
            <p>
              객단가{" "}
              {Number(newData?.avg_order_value ?? 0).toLocaleString("ko-KR")}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-emerald-700">
              재구매 고객
            </span>
            <span className="text-xs text-emerald-500">{repeatRatio}%</span>
          </div>
          <p className="text-2xl font-bold text-emerald-900">
            {Number(repeatData?.buyer_count ?? 0).toLocaleString("ko-KR")}
            <span className="text-sm font-normal text-emerald-600 ml-1">
              명
            </span>
          </p>
          <div className="mt-2 text-sm text-emerald-600 space-y-0.5">
            <p>
              매출 {formatCurrency(Number(repeatData?.total_sales ?? 0))}
            </p>
            <p>
              객단가{" "}
              {Number(repeatData?.avg_order_value ?? 0).toLocaleString("ko-KR")}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">월별 추이</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-blue-500" />
            신규
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-emerald-500" />
            재구매
          </span>
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
            <Tooltip
              formatter={(v, name) => [
                Number(v).toLocaleString("ko-KR") + "명",
                name === "new" ? "신규" : "재구매",
              ]}
            />
            <Bar
              dataKey="new"
              name="신규"
              fill="#3b82f6"
              stackId="buyers"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="repeat"
              name="재구매"
              fill="#10b981"
              stackId="buyers"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
