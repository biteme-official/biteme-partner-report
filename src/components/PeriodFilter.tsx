"use client";

import { useState, useRef, useEffect } from "react";

export interface DateRange {
  start: Date;
  end: Date;
}

export type CompareKey = "none" | "prevPeriod" | "prevWeek" | "prevMonth" | "prevYear";
export type PresetKey = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

interface Props {
  onPeriodChange: (range: DateRange, presetKey: PresetKey) => void;
  onCompareChange: (range: DateRange | null, key: CompareKey) => void;
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "thisWeek", label: "이번주" },
  { key: "lastWeek", label: "지난주" },
  { key: "thisMonth", label: "이번달" },
  { key: "lastMonth", label: "지난달" },
  { key: "custom", label: "기간 설정" },
];

const COMPARES: { key: CompareKey; label: string }[] = [
  { key: "none", label: "비교 안함" },
  { key: "prevPeriod", label: "전기간" },
  { key: "prevWeek", label: "전주" },
  { key: "prevMonth", label: "전월" },
  { key: "prevYear", label: "전년동기" },
];

function startOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  switch (key) {
    case "today":
      return { start: startOf(now), end: endOf(now) };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { start: startOf(d), end: endOf(d) };
    }
    case "thisWeek": {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return { start: startOf(d), end: endOf(now) };
    }
    case "lastWeek": {
      const d = new Date(now);
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: startOf(mon), end: endOf(sun) };
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOf(d), end: endOf(now) };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOf(first), end: endOf(last) };
    }
    case "custom":
      return { start: startOf(now), end: endOf(now) };
  }
}

export function getCompareRange(period: DateRange, key: CompareKey): DateRange | null {
  if (key === "none") return null;
  const diffMs = period.end.getTime() - period.start.getTime();
  switch (key) {
    case "prevPeriod": {
      const end = new Date(period.start.getTime() - 1);
      const start = new Date(end.getTime() - diffMs);
      return { start, end };
    }
    case "prevWeek": {
      const ms = 7 * 24 * 60 * 60 * 1000;
      return {
        start: new Date(period.start.getTime() - ms),
        end: new Date(period.end.getTime() - ms),
      };
    }
    case "prevMonth": {
      const start = new Date(period.start);
      start.setMonth(start.getMonth() - 1);
      const end = new Date(period.end);
      end.setMonth(end.getMonth() - 1);
      return { start, end };
    }
    case "prevYear": {
      const start = new Date(period.start);
      start.setFullYear(start.getFullYear() - 1);
      const end = new Date(period.end);
      end.setFullYear(end.getFullYear() - 1);
      return { start, end };
    }
  }
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function formatDateRange(range: DateRange): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(range.start)} ~ ${fmt(range.end)}`;
}

export default function PeriodFilter({ onPeriodChange, onCompareChange }: Props) {
  const [activePreset, setActivePreset] = useState<PresetKey>("thisMonth");
  const [activeCompare, setActiveCompare] = useState<CompareKey>("none");
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(toInputDate(new Date()));
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()));
  const [period, setPeriod] = useState<DateRange>(() => getPresetRange("thisMonth"));
  const customRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handlePreset(key: PresetKey) {
    setActivePreset(key);
    if (key === "custom") {
      setShowCustom((v) => !v);
      return;
    }
    setShowCustom(false);
    const range = getPresetRange(key);
    setPeriod(range);
    onPeriodChange(range, key);
    if (activeCompare !== "none") {
      onCompareChange(getCompareRange(range, activeCompare), activeCompare);
    }
  }

  function handleApplyCustom() {
    if (!customStart || !customEnd) return;
    const range: DateRange = {
      start: new Date(customStart + "T00:00:00"),
      end: new Date(customEnd + "T23:59:59"),
    };
    setPeriod(range);
    setShowCustom(false);
    onPeriodChange(range, "custom");
    if (activeCompare !== "none") {
      onCompareChange(getCompareRange(range, activeCompare), activeCompare);
    }
  }

  function handleCompare(key: CompareKey) {
    setActiveCompare(key);
    onCompareChange(key === "none" ? null : getCompareRange(period, key), key);
  }

  const nonCustomPresets = PRESETS.filter((p) => p.key !== "custom");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium w-6">기간</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {nonCustomPresets.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activePreset === p.key
                  ? "bg-orange-500 text-white font-medium shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div ref={customRef} className="relative">
            <button
              onClick={() => handlePreset("custom")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activePreset === "custom"
                  ? "bg-orange-500 text-white font-medium shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              기간 설정
            </button>
            {showCustom && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-56">
                <p className="text-xs font-medium text-gray-700 mb-3">기간 직접 설정</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">시작일</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">종료일</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <button
                    onClick={handleApplyCustom}
                    className="w-full bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    적용
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium w-6">비교</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {COMPARES.map((c) => (
            <button
              key={c.key}
              onClick={() => handleCompare(c.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeCompare === c.key
                  ? "bg-orange-500 text-white font-medium shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
