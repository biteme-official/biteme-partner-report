"use client";

import { useState, useEffect } from "react";
import PartnerCard from "@/components/PartnerCard";
import type { PartnerSummary } from "@/lib/types";

const PAGE_SIZE = 12;

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/partners?days=${days}`)
      .then((r) => r.json())
      .then((data) => setPartners(data.partners ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    setPage(1);
  }, [search, days]);

  const filtered = partners.filter((p) =>
    p.partner_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const PAGE_WINDOW = 10;
  const groupStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const groupEnd = Math.min(totalPages, groupStart + PAGE_WINDOW - 1);
  const pageNumbers = Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);

  return (
    <main className="max-w-[1300px] mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Partner Report
        </h1>
        <p className="text-gray-500 mt-1">
          바잇미 파트너사 영업 리포트
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
        <input
          type="text"
          placeholder="파트너사 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
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
        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length}개 파트너사
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-20">
          {search ? "검색 결과가 없습니다" : "데이터를 불러올 수 없습니다"}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map((p) => (
              <PartnerCard key={p.partner_id} partner={p} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 no-print">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    page === p
                      ? "bg-blue-500 text-white border-blue-500 font-medium"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
