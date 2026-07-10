"use client";

import type { ReactNode } from "react";

interface QuickSearchResultsProps<T> {
  loading: boolean;
  error: boolean;
  items: T[];
  maxMatches: number;
  renderItem: (item: T) => ReactNode;
}

export default function QuickSearchResults<T>({
  loading,
  error,
  items,
  maxMatches,
  renderItem,
}: QuickSearchResultsProps<T>) {
  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
      {loading ? (
        <p className="px-4 py-3 text-sm text-gray-400">불러오는 중...</p>
      ) : error ? (
        <p className="px-4 py-3 text-sm text-gray-400">데이터를 불러올 수 없습니다</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다</p>
      ) : (
        <>
          {items.map(renderItem)}
          {items.length === maxMatches && (
            <p className="px-4 py-2 text-xs text-gray-400">
              상위 {maxMatches}개만 표시됩니다. 더 구체적인 이름을 입력하세요.
            </p>
          )}
        </>
      )}
    </div>
  );
}
