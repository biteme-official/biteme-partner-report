"use client";

import {
  ComposedChart,
  LineChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatWonShort } from "@/lib/format";

export interface FlowPoint {
  key: string;
  label: string;
  sublabel?: string;
  contribution: number;
  sales: number;
  partial: boolean;
}

const COLOR_CONTRIBUTION = "#3b82f6";
const COLOR_CONTRIBUTION_PARTIAL = "#bfdbfe";
const COLOR_SALES = "#8b5cf6";
const COLOR_RATE = "#059669";

interface Props {
  points: FlowPoint[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}

export default function ContributionFlowChart({ points, selectedKey, onSelect }: Props) {
  // 진행 중인 구간은 시트 공헌이익이 아직 다 차지 않아 분자만 작다 — 이익률을 그리지 않는다
  const data = points.map((p) => ({
    ...p,
    rate:
      p.partial || p.sales <= 0
        ? null
        : Number(((p.contribution / p.sales) * 100).toFixed(2)),
  }));

  const hasPartial = points.some((p) => p.partial);

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#9ca3af" }} />
          <YAxis
            yAxisId="contribution"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={formatWonShort}
          />
          <YAxis
            yAxisId="sales"
            orientation="right"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={formatWonShort}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Math.round(Number(value)).toLocaleString("ko-KR")}원`,
              name,
            ]}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload as FlowPoint | undefined;
              return p?.sublabel ? `${label} (${p.sublabel})` : String(label);
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            formatter={(value) => (
              <span style={{ fontSize: 12, color: "#6b7280" }}>{value}</span>
            )}
          />
          <Bar
            yAxisId="contribution"
            dataKey="contribution"
            name="공헌이익"
            radius={[4, 4, 0, 0]}
            onClick={(entry: unknown) => {
              const point = entry as { payload?: FlowPoint };
              if (onSelect && point.payload) onSelect(point.payload.key);
            }}
            cursor={onSelect ? "pointer" : undefined}
          >
            {data.map((p) => (
              <Cell
                key={p.key}
                fill={p.partial ? COLOR_CONTRIBUTION_PARTIAL : COLOR_CONTRIBUTION}
                stroke={selectedKey === p.key ? "#1d4ed8" : undefined}
                strokeWidth={selectedKey === p.key ? 2 : 0}
              />
            ))}
          </Bar>
          <Line
            yAxisId="sales"
            type="monotone"
            dataKey="sales"
            name="거래액"
            stroke={COLOR_SALES}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-1 mb-1 ml-1">공헌이익률 (%)</p>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#d1d5db" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={(v) => `${v}%`}
            width={44}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "공헌이익률"]}
          />
          <Line
            type="monotone"
            dataKey="rate"
            name="공헌이익률"
            stroke={COLOR_RATE}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {hasPartial && (
        <p className="text-xs text-gray-400 mt-2">
          연한 막대는 아직 진행 중인 구간입니다 — 시트 공헌이익이 다 차지 않아 이익률은 그리지
          않았습니다.
        </p>
      )}
    </div>
  );
}
