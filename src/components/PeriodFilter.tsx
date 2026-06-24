"use client";

import { useState, useRef, useEffect } from "react";

export interface DateRange {
  start: Date;
  end: Date;
}

export type CompareKey =
  | "preset"
  | "off"
  | "prevDay"
  | "prevWeek"
  | "prevMonth"
  | "custom";

export type PresetKey = "today" | "thisWeek" | "thisMonth" | "custom";

interface Props {
  onPeriodChange: (range: DateRange, presetKey: PresetKey) => void;
  onCompareChange: (range: DateRange | null, key: CompareKey) => void;
}

type SpecificCompareKey = "prevDay" | "prevWeek" | "prevMonth";

const PERIOD_PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "thisWeek", label: "이번주" },
  { key: "thisMonth", label: "이번달" },
];

const COMPARE_OPTIONS: { key: CompareKey; label: string }[] = [
  { key: "preset", label: "프리셋" },
  { key: "off", label: "끄기" },
  { key: "prevDay", label: "어제" },
  { key: "prevWeek", label: "전주" },
  { key: "prevMonth", label: "전월" },
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
    case "thisWeek": {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return { start: startOf(d), end: endOf(now) };
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOf(d), end: endOf(now) };
    }
    case "custom":
      return { start: startOf(now), end: endOf(now) };
  }
}

export function getCompareRange(period: DateRange, key: SpecificCompareKey): DateRange {
  switch (key) {
    case "prevDay": {
      const d = new Date(period.start);
      d.setDate(d.getDate() - 1);
      return { start: startOf(d), end: endOf(d) };
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
  }
}

function autoCompareKey(presetKey: PresetKey): SpecificCompareKey {
  switch (presetKey) {
    case "thisWeek":  return "prevWeek";
    case "thisMonth": return "prevMonth";
    default:          return "prevDay"; // 오늘 → 어제, 기간설정 → 전날
  }
}

function resolveCompare(
  compareKey: CompareKey,
  period: DateRange,
  presetKey: PresetKey,
  customRange: DateRange | null
): DateRange | null {
  switch (compareKey) {
    case "off":    return null;
    case "custom": return customRange;
    case "preset": return getCompareRange(period, autoCompareKey(presetKey));
    default:       return getCompareRange(period, compareKey as SpecificCompareKey);
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

function DatePickerDropdown({
  title,
  startVal,
  endVal,
  onStartChange,
  onEndChange,
  onApply,
}: {
  title: string;
  startVal: string;
  endVal: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-56">
      <p className="text-xs font-medium text-gray-700 mb-3">{title}</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">시작일</label>
          <input
            type="date"
            value={startVal}
            onChange={(e) => onStartChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">종료일</label>
          <input
            type="date"
            value={endVal}
            onChange={(e) => onEndChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <button
          onClick={onApply}
          className="w-full bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          적용
        </button>
      </div>
    </div>
  );
}

export default function PeriodFilter({ onPeriodChange, onCompareChange }: Props) {
  const [activePreset, setActivePreset] = useState<PresetKey>("today");
  const [activeCompare, setActiveCompare] = useState<CompareKey>("preset");
  const [period, setPeriod] = useState<DateRange>(() => getPresetRange("today"));
  const [customCompareRange, setCustomCompareRange] = useState<DateRange | null>(null);

  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showComparePicker, setShowComparePicker] = useState(false);

  const today = toInputDate(new Date());
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [compareStart, setCompareStart] = useState(today);
  const [compareEnd, setCompareEnd] = useState(today);

  const periodPickerRef = useRef<HTMLDivElement>(null);
  const comparePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        periodPickerRef.current &&
        !periodPickerRef.current.contains(e.target as Node)
      ) {
        setShowPeriodPicker(false);
      }
      if (
        comparePickerRef.current &&
        !comparePickerRef.current.contains(e.target as Node)
      ) {
        setShowComparePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function applyPeriod(range: DateRange, preset: PresetKey) {
    setPeriod(range);
    onPeriodChange(range, preset);
    const cRange = resolveCompare(activeCompare, range, preset, customCompareRange);
    onCompareChange(cRange, activeCompare);
  }

  function handlePreset(key: PresetKey) {
    setActivePreset(key);
    setShowComparePicker(false);
    if (key === "custom") {
      setShowPeriodPicker((v) => !v);
      return;
    }
    setShowPeriodPicker(false);
    applyPeriod(getPresetRange(key), key);
  }

  function handleApplyPeriodPicker() {
    if (!periodStart || !periodEnd) return;
    const range: DateRange = {
      start: new Date(periodStart + "T00:00:00"),
      end: new Date(periodEnd + "T23:59:59"),
    };
    setShowPeriodPicker(false);
    applyPeriod(range, "custom");
  }

  function handleCompare(key: CompareKey) {
    setActiveCompare(key);
    setShowPeriodPicker(false);
    if (key === "custom") {
      setShowComparePicker((v) => !v);
      return;
    }
    setShowComparePicker(false);
    const cRange = resolveCompare(key, period, activePreset, customCompareRange);
    onCompareChange(cRange, key);
  }

  function handleApplyComparePicker() {
    if (!compareStart || !compareEnd) return;
    const range: DateRange = {
      start: new Date(compareStart + "T00:00:00"),
      end: new Date(compareEnd + "T23:59:59"),
    };
    setCustomCompareRange(range);
    setShowComparePicker(false);
    onCompareChange(range, "custom");
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 기간 필터 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium w-6">기간</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIOD_PRESETS.map((p) => (
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
          <div ref={periodPickerRef} className="relative">
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
            {showPeriodPicker && (
              <DatePickerDropdown
                title="기간 직접 설정"
                startVal={periodStart}
                endVal={periodEnd}
                onStartChange={setPeriodStart}
                onEndChange={setPeriodEnd}
                onApply={handleApplyPeriodPicker}
              />
            )}
          </div>
        </div>
      </div>

      {/* 비교 옵션 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium w-6">비교</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {COMPARE_OPTIONS.map((c) => (
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
          <div ref={comparePickerRef} className="relative">
            <button
              onClick={() => handleCompare("custom")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeCompare === "custom"
                  ? "bg-orange-500 text-white font-medium shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              기간 설정
            </button>
            {showComparePicker && (
              <DatePickerDropdown
                title="비교 기간 직접 설정"
                startVal={compareStart}
                endVal={compareEnd}
                onStartChange={setCompareStart}
                onEndChange={setCompareEnd}
                onApply={handleApplyComparePicker}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
