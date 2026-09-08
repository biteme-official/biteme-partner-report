export function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface WeekRange {
  no: number;
  start: string;
  end: string;
}

// 월 안에서 잘린 월~일 주. 월초/월말 주는 잘려서 하루짜리가 되기도 한다.
export function monthWeekRanges(year: number, month: number): WeekRange[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: number) => `${year}-${pad(month)}-${pad(d)}`;

  const ranges: WeekRange[] = [];
  let day = 1;
  while (day <= lastDay) {
    const dow = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7; // 0=월
    const end = Math.min(day + (6 - dow), lastDay);
    ranges.push({ no: ranges.length + 1, start: ymd(day), end: ymd(end) });
    day = end + 1;
  }
  return ranges;
}
