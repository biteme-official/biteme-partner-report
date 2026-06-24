"use client";

import { useState, useRef, useEffect } from "react";

export interface DateRange {
  start: Date;
  end: Date;
}

// "preset"은 PeriodFilter 내부에서만 처리됨 — 부모에는 항상 구체적 key 전달
export type CompareKey = "off" | "prevDay" | "prevWeek" | "prevMonth" | "custom";

export type PresetKey = "today" | "thisWeek" | "thisMonth" | "custom";

interface Props {
  onPeriodChange: (range: DateRange, presetKey: PresetKey) => void;
  onCompareChange: (range: DateRange | null, key: CompareKey) => void;
}

type SpecificCompareKey = "prevDay" | "prevWeek" | "prevMonth";
// 버튼에서만 사용하는 내부 key (프리셋 포함)
type BtnCompareKey = CompareKey | "preset";

const PERIOD_PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "thisWeek", label: "이번주" },
  { key: "thisMonth", label: "이번달" },
];

const COMPARE_OPTIONS: { key: BtnCompareKey; label: string }[] = [
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
    default:          return "prevDay";
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
  // isPreset: 프리셋 자동 선택 모드. 기간 버튼 클릭 시 비교 버튼 자동 전환
  const [isPreset, setIsPreset] = useState(true);
  // activeCompare: 현재 선택된 비교 key. "preset"은 가지지 않음 — isPreset이 모드 역할
  const [activeCompare, setActiveCompare] = useState<CompareKey>("prevDay");
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

    if (isPreset) {
      // 프리셋 모드: 기간에 맞는 비교 key 자동 선택 + 버튼 하이라이트 전환
      const specificKey = autoCompareKey(preset);
      setActiveCompare(specificKey);
      onCompareChange(getCompareRange(range, specificKey), specificKey);
    } else if (activeCompare === "off") {
      onCompareChange(null, "off");
    } else if (activeCompare === "custom") {
      onCompareChange(customCompareRange, "custom");
    } else {
      // 수동 선택 — 새 기간에 맞춰 비교 범위 재계산
      onCompareChange(
        getCompareRange(range, activeCompare as SpecificCompareKey),
        activeCompare
      );
    }
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

  function handleCompare(key: BtnCompareKey) {
    setShowPeriodPicker(false);

    if (key === "preset") {
      // 프리셋 모드 활성화: 현재 기간에 맞는 specific key로 즉시 전환
      setIsPreset(true);
      const specificKey = autoCompareKey(activePreset);
      setActiveCompare(specificKey);
      setShowComparePicker(false);
      onCompareChange(getCompareRange(period, specificKey), specificKey);
      return;
    }

    // 특정 버튼 선택 → 프리셋 모드 해제
    setIsPreset(false);
    setActiveCompare(key);

    if (key === "custom") {
      setShowComparePicker((v) => !v);
      return;
    }
    setShowComparePicker(false);

    if (key === "off") {
      onCompareChange(null, "off");
      return;
    }

    onCompareChange(getCompareRange(period, key as SpecificCompareKey), key);
  }

  function handleApplyComparePicker() {
    if (!compareStart || !compareEnd) return;
    const range: DateRange = {
      start: new Date(compareStart + "T00:00:00"),
      end: new Date(compareEnd + "T23:59:59"),
    };
    setCustomCompareRange(range);
    setIsPreset(false);
    setActiveCompare("custom");
    setShowComparePicker(false);
    onCompareChange(range, "custom");
  }

  // 프리셋 모드: "프리셋" + 현재 specific key 버튼 모두 주황 하이라이트 (듀얼 표시)
  // 수동 모드: 선택된 key만 하이라이트
  function isBtnActive(key: BtnCompareKey): boolean {
    if (key === "preset") return isPreset;
    return activeCompare === key;
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
                isBtnActive(c.key)
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
                isBtnActive("custom")
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
