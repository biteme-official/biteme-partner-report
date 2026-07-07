"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PartnerCard from "@/components/PartnerCard";
import type { PartnerSummary, PartnerBasic } from "@/lib/types";

const PAGE_SIZE = 12;
const MAX_QUICK_MATCHES = 8;

type Tab = "list" | "search";

export default function PartnersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("search");
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [quickSearch, setQuickSearch] = useState("");
  const [allPartners, setAllPartners] = useState<PartnerBasic[]>([]);
  const [allPartnersLoading, setAllPartnersLoading] = useState(true);
  const [allPartnersError, setAllPartnersError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    setError(false);
    fetch(`/api/partners?days=${days}`, { signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (signal.aborted) return;
        setPartners(data.partners ?? []);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        console.error(e);
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [days]);

  useEffect(() => {
    // 매출 유무와 무관하게 전체 파트너사를 찾을 수 있어야 하므로
    // 기간(days) 기반 목록과 별개의 엔드포인트를 사용한다
    fetch("/api/partners/all")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setAllPartners(data.partners ?? []))
      .catch((e) => {
        console.error(e);
        setAllPartnersError(true);
      })
      .finally(() => setAllPartnersLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, days]);

  const filtered = partners.filter((p) =>
    p.partner_name.toLowerCase().includes(search.toLowerCase())
  );

  const salesRankMap = useMemo(() => {
    const map = new Map<number, number>();
    partners.forEach((p, i) => map.set(p.partner_id, i + 1));
    return map;
  }, [partners]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const PAGE_WINDOW = 10;
  const groupStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const groupEnd = Math.min(totalPages, groupStart + PAGE_WINDOW - 1);
  const pageNumbers = Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);

  const quickMatches = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return [];
    return allPartners
      .filter((p) => p.partner_name.toLowerCase().includes(q))
      .slice(0, MAX_QUICK_MATCHES);
  }, [quickSearch, allPartners]);

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

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit no-print">
        <button
          onClick={() => setTab("list")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            tab === "list"
              ? "bg-white text-gray-900 shadow-sm font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          전체 목록
        </button>
        <button
          onClick={() => setTab("search")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            tab === "search"
              ? "bg-white text-gray-900 shadow-sm font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          파트너사 검색
        </button>
      </div>

      {tab === "list" ? (
        <>
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
          ) : error ? (
            <p className="text-center text-gray-400 py-20">
              데이터를 불러올 수 없습니다
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-20">
              {search ? "검색 결과가 없습니다" : "표시할 파트너사가 없습니다"}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginated.map((p) => (
                  <PartnerCard
                    key={p.partner_id}
                    partner={p}
                    salesRank={salesRankMap.get(p.partner_id)}
                  />
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
        </>
      ) : (
        <div className="max-w-xl mx-auto py-12 no-print">
          <input
            type="text"
            autoFocus
            placeholder="파트너사명을 입력하세요..."
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {(allPartnersLoading || quickSearch.trim()) && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
              {allPartnersLoading ? (
                <p className="px-4 py-3 text-sm text-gray-400">불러오는 중...</p>
              ) : allPartnersError ? (
                <p className="px-4 py-3 text-sm text-gray-400">데이터를 불러올 수 없습니다</p>
              ) : quickMatches.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다</p>
              ) : (
                <>
                  {quickMatches.map((p) => (
                    <button
                      key={p.partner_id}
                      onClick={() => router.push(`/partners/${p.partner_id}`)}
                      className="w-full text-left px-4 py-3 text-sm text-gray-900 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      {p.partner_name}
                    </button>
                  ))}
                  {quickMatches.length === MAX_QUICK_MATCHES && (
                    <p className="px-4 py-2 text-xs text-gray-400">
                      상위 {MAX_QUICK_MATCHES}개만 표시됩니다. 더 구체적인 이름을 입력하세요.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
