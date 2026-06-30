"use client";

import { useState, useEffect, useRef } from "react";

export type PeriodPreset = "today" | "week" | "month" | "3months" | "6months" | "custom";
export type CompareOption = "preset" | "off" | "yesterday" | "prev_week" | "prev_month" | "prev_year";

export interface DateRange {
  start: Date;
  end: Date;
}

interface Props {
  onChange: (main: DateRange, compare: DateRange | null, preset: PeriodPreset) => void;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function shiftMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function shiftYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

function getMainRange(preset: PeriodPreset, customStart: string, customEnd: string): DateRange {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case "today":
      return { start: today, end: now };
    case "week": {
      const dow = today.getDay();
      const monday = shiftDays(today, -(dow === 0 ? 6 : dow - 1));
      return { start: monday, end: now };
    }
    case "month":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: now };
    case "3months":
      return { start: shiftMonths(now, -3), end: now };
    case "6months":
      return { start: shiftMonths(now, -6), end: now };
    case "custom":
      return {
        start: customStart ? new Date(customStart + "T00:00:00") : today,
        end: customEnd ? new Date(customEnd + "T23:59:59") : now,
      };
  }
}

function getCompareRange(
  compareOption: CompareOption,
  periodPreset: PeriodPreset,
  main: DateRange
): DateRange | null {
  if (compareOption === "off") return null;

  const today = startOfDay(new Date());

  if (compareOption === "preset") {
    switch (periodPreset) {
      case "today": {
        const y = shiftDays(today, -1);
        return { start: y, end: endOfDay(y) };
      }
      case "week":
        return { start: shiftDays(main.start, -7), end: shiftDays(main.end, -7) };
      case "month":
        return { start: shiftMonths(main.start, -1), end: shiftMonths(main.end, -1) };
      case "3months":
      case "6months":
        return { start: shiftYears(main.start, -1), end: shiftYears(main.end, -1) };
      case "custom": {
        const duration = main.end.getTime() - main.start.getTime();
        const prevEnd = new Date(main.start.getTime() - 1000);
        const prevStart = new Date(prevEnd.getTime() - duration);
        return { start: prevStart, end: prevEnd };
      }
    }
  }

  switch (compareOption) {
    case "yesterday": {
      const y = shiftDays(today, -1);
      return { start: y, end: endOfDay(y) };
    }
    case "prev_week":
      return { start: shiftDays(main.start, -7), end: shiftDays(main.end, -7) };
    case "prev_month":
      return { start: shiftMonths(main.start, -1), end: shiftMonths(main.end, -1) };
    case "prev_year":
      return { start: shiftYears(main.start, -1), end: shiftYears(main.end, -1) };
  }
  return null;
}

const PERIOD_PRESETS: PeriodPreset[] = ["today", "week", "month", "3months", "6months", "custom"];
const COMPARE_OPTIONS: CompareOption[] = ["preset", "off", "yesterday", "prev_week", "prev_month", "prev_year"];

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "오늘",
  week: "이번주",
  month: "이번달",
  "3months": "최근 3개월",
  "6months": "최근 6개월",
  custom: "기간 설정",
};

const COMPARE_LABELS: Record<CompareOption, string> = {
  preset: "자동",
  off: "끄기",
  yesterday: "어제",
  prev_week: "전주",
  prev_month: "전월",
  prev_year: "전년 동기간",
};

const PRESET_EFFECTIVE_LABEL: Record<PeriodPreset, string> = {
  today: "어제",
  week: "전주",
  month: "전월",
  "3months": "전년 동기간",
  "6months": "전년 동기간",
  custom: "직전 동기간",
};

const PRESET_COMPARE_MAP: Partial<Record<PeriodPreset, CompareOption>> = {
  today: "yesterday",
  week: "prev_week",
  month: "prev_month",
  "3months": "prev_year",
  "6months": "prev_year",
};

export default function PeriodFilter({ onChange }: Props) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [compareOption, setCompareOption] = useState<CompareOption>("preset");

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const main = getMainRange(periodPreset, customStart, customEnd);
    const compare = getCompareRange(compareOption, periodPreset, main);
    onChangeRef.current(main, compare, periodPreset);
  }, [periodPreset, customStart, customEnd, compareOption]);

  const activeBtn = "bg-orange-500 text-white font-medium";
  const mappedBtn = "text-orange-500 ring-1 ring-orange-400 bg-orange-50 font-medium";
  const inactiveBtn = "text-gray-600 hover:text-gray-900 hover:bg-gray-100";
  const btnBase = "px-3 py-1.5 text-sm rounded-md transition-colors";

  const dateInputClass =
    "border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400";

  return (
    <div className="space-y-2">
      {/* 기간 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium shrink-0 w-8">기간</span>
        <div className="flex flex-wrap gap-1">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setPeriodPreset(preset)}
              className={`${btnBase} ${periodPreset === preset ? activeBtn : inactiveBtn}`}
            >
              {PERIOD_LABELS[preset]}
            </button>
          ))}
        </div>
        {periodPreset === "custom" && (
          <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className={dateInputClass}
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className={dateInputClass}
            />
          </div>
        )}
      </div>

      {/* 비교 옵션 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium shrink-0 w-8">비교</span>
        <div className="flex flex-wrap gap-1">
          {(compareOption === "off" ? (["preset", "off"] as CompareOption[]) : COMPARE_OPTIONS).map((opt) => {
            const isSelected = compareOption === opt;
            const isMapped = compareOption === "preset" && opt !== "preset" && !!PRESET_COMPARE_MAP[periodPreset] && PRESET_COMPARE_MAP[periodPreset] === opt;
            const cls = isSelected ? activeBtn : isMapped ? mappedBtn : inactiveBtn;
            return (
              <button
                key={opt}
                onClick={() => setCompareOption(opt)}
                className={`${btnBase} ${cls}`}
              >
                {COMPARE_LABELS[opt]}
              </button>
            );
          })}
        </div>
        {compareOption === "preset" && (
          <span className="text-xs text-orange-500 font-medium">
            → {PRESET_EFFECTIVE_LABEL[periodPreset]}와 비교
          </span>
        )}
      </div>
    </div>
  );
}
