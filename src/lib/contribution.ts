import type { SheetRow } from "@/lib/sheets";

// 위탁 파트너사 공헌이익 시트
// https://docs.google.com/spreadsheets/d/1b4PWZT0NE3e3mpdYFE4FrLNTUtdupVWSdeK0il_XNSc
// 탭 구성: `2025(TOTAL)`, `2026(TOTAL)` = 공급사명 × 월별,
//          `2601`~`2612` = 공급사명 × 주차별 (해당 연월)
export const CONTRIBUTION_SHEET_ID =
  "1b4PWZT0NE3e3mpdYFE4FrLNTUtdupVWSdeK0il_XNSc";

export const CONTRIBUTION_YEARS = [2025, 2026] as const;

export function yearTabName(year: number): string {
  return `${year}(TOTAL)`;
}

export function monthTabName(year: number, month: number): string {
  return `${String(year).slice(2)}${String(month).padStart(2, "0")}`;
}

export interface WeekRange {
  no: number;
  start: string;
  end: string;
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 시트의 주차 = 월 안에서 잘린 월~일 주. 월초/월말 주는 잘려서 하루짜리가 되기도 한다.
export function monthWeekRanges(year: number, month: number): WeekRange[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const ranges: WeekRange[] = [];
  let day = 1;
  while (day <= lastDay) {
    const dow = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7; // 0=월
    const end = Math.min(day + (6 - dow), lastDay);
    ranges.push({ no: ranges.length + 1, start: ymd(year, month, day), end: ymd(year, month, end) });
    day = end + 1;
  }
  return ranges;
}

function text(cell: unknown): string {
  return typeof cell === "string" ? cell.trim() : cell == null ? "" : String(cell).trim();
}

function num(cell: unknown): number {
  if (typeof cell === "number") return cell;
  if (typeof cell !== "string") return 0;
  // 수식 오류(#N/A 등)와 빈 칸은 0 으로 본다
  const cleaned = cell.replace(/[,\s원]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// 머리글 행을 이름으로 찾는다 — 열 위치가 바뀌어도 견디도록
function findHeaderRow(rows: SheetRow[], label: string): { row: number; col: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const col = (rows[r] ?? []).findIndex((c) => text(c) === label);
    if (col >= 0) return { row: r, col };
  }
  return null;
}

export interface YearContribution {
  /** 공급사명 → 12개월 공헌이익 (0-based: index 0 = 1월) */
  byPartner: Map<string, number[]>;
  partnerOrder: string[];
}

export function parseYearTab(rows: SheetRow[]): YearContribution {
  const header = findHeaderRow(rows, "공급사명");
  if (!header) throw new Error("시트에서 '공급사명' 머리글을 찾지 못했습니다");

  const headerRow = rows[header.row];
  const monthCols: number[] = [];
  for (let m = 1; m <= 12; m++) {
    monthCols.push(headerRow.findIndex((c, i) => i > header.col && text(c) === `${m}월`));
  }
  if (monthCols.some((c) => c < 0)) {
    throw new Error("시트에서 월 머리글(1월~12월)을 찾지 못했습니다");
  }

  const byPartner = new Map<string, number[]>();
  const partnerOrder: string[] = [];

  for (let r = header.row + 1; r < rows.length; r++) {
    const name = text(rows[r]?.[header.col]);
    if (!name || name === "공급사명") continue;
    const months = monthCols.map((c) => num(rows[r]?.[c]));
    // 같은 공급사가 두 번 나오면 합친다
    const prev = byPartner.get(name);
    if (prev) {
      months.forEach((v, i) => (prev[i] += v));
    } else {
      byPartner.set(name, months);
      partnerOrder.push(name);
    }
  }

  return { byPartner, partnerOrder };
}

export interface MonthContribution {
  /** 시트 상단의 "9/7 기준 실 공헌이익" 같은 취합 기준 표기 */
  basisLabel: string;
  /** 시트에 실제로 들어있는 주차 열 개수 */
  sheetWeekCount: number;
  /** 공급사명 → 주차별 공헌이익 */
  byPartner: Map<string, number[]>;
}

export function parseMonthTab(rows: SheetRow[]): MonthContribution {
  const header = findHeaderRow(rows, "공급사명");
  if (!header) throw new Error("월 탭에서 '공급사명' 머리글을 찾지 못했습니다");

  const headerRow = rows[header.row];
  // 오른쪽에 '내림차순 가공' 사본 표가 하나 더 있다. 머리글이 빈 열에서 끊는다.
  const weekCols: number[] = [];
  for (let c = header.col + 1; c < headerRow.length; c++) {
    const label = text(headerRow[c]);
    if (!label) break;
    if (/^\d+주차$/.test(label)) weekCols.push(c);
  }

  const basisLabel = rows
    .slice(0, header.row)
    .flatMap((r) => (r ?? []).map(text))
    .find((v) => v.includes("기준")) ?? "";

  const byPartner = new Map<string, number[]>();
  for (let r = header.row + 1; r < rows.length; r++) {
    const name = text(rows[r]?.[header.col]);
    if (!name || name === "공급사명") continue;
    const weeks = weekCols.map((c) => num(rows[r]?.[c]));
    const prev = byPartner.get(name);
    if (prev) {
      weeks.forEach((v, i) => (prev[i] += v));
    } else {
      byPartner.set(name, weeks);
    }
  }

  return { basisLabel, sheetWeekCount: weekCols.length, byPartner };
}
