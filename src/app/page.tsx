"use client";

import { useState, useEffect } from "react";
import PartnerCard from "@/components/PartnerCard";
import type { PartnerSummary } from "@/lib/types";

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/partners?days=${days}`)
      .then((r) => r.json())
      .then((data) => setPartners(data.partners ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const filtered = partners.filter((p) =>
    p.partner_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PartnerCard key={p.partner_id} partner={p} />
          ))}
        </div>
      )}
    </main>
  );
}
