"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailySales } from "@/lib/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("ko-KR");
}

interface Props {
  sales: DailySales[];
  totalSales: number;
  totalOrders: number;
  totalBuyers: number;
}

export default function SalesOverview({
  sales,
  totalSales,
  totalOrders,
  totalBuyers,
}: Props) {
  const chartData = sales.map((s) => ({
    date: formatDate(s.sale_date),
    sales: Number(s.total_sales),
    orders: Number(s.order_count),
  }));

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        매출 현황
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">총 매출</p>
          <p className="text-xl font-bold text-blue-900">
            {formatCurrency(totalSales)}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">주문 수</p>
          <p className="text-xl font-bold text-green-900">
            {totalOrders.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600">구매자 수</p>
          <p className="text-xl font-bold text-purple-900">
            {totalBuyers.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              formatter={(v) => Number(v).toLocaleString("ko-KR")}
              labelFormatter={(l) => `${l}`}
            />
            <Bar dataKey="sales" name="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
