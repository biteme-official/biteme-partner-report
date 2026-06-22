"use client";

import type { ProductSales } from "@/lib/types";

function formatCurrency(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface Props {
  products: ProductSales[];
}

export default function ProductMix({ products }: Props) {
  const totalSales = products.reduce((sum, p) => sum + Number(p.total_sales), 0);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        상품 성과
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-3 font-medium pr-4">#</th>
              <th className="pb-3 font-medium">상품명</th>
              <th className="pb-3 font-medium pl-6">브랜드</th>
              <th className="pb-3 font-medium text-right pl-10">매출</th>
              <th className="pb-3 font-medium text-right pl-10">비중</th>
              <th className="pb-3 font-medium text-right pl-10">수량</th>
              <th className="pb-3 font-medium text-right pl-10">주문</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 20).map((p, i) => {
              const share = totalSales
                ? ((Number(p.total_sales) / totalSales) * 100).toFixed(1)
                : "0";
              return (
                <tr
                  key={p.product_cd}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-2.5 text-gray-400 pr-4">{i + 1}</td>
                  <td className="py-2.5 text-gray-900 whitespace-nowrap">
                    {p.product_nm}
                  </td>
                  <td className="py-2.5 text-gray-500 whitespace-nowrap pl-6">
                    {p.brand_nm}
                  </td>
                  <td className="py-2.5 text-right font-medium pl-10">
                    {formatCurrency(Number(p.total_sales))}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 pl-10">{share}%</td>
                  <td className="py-2.5 text-right text-gray-500 pl-10">
                    {Number(p.total_qty).toLocaleString("ko-KR")}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 pl-10">
                    {Number(p.order_count).toLocaleString("ko-KR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length > 20 && (
          <p className="text-sm text-gray-400 mt-3">
            외 {products.length - 20}개 상품
          </p>
        )}
      </div>
    </section>
  );
}
