import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  TrendingUp,
} from "lucide-react";
import { API_URL, dateLabel, money, request } from "../data";
type Segment = { name: string; pct: number; color: string };
type Analytics = {
  series: { date: string; revenue: number }[];
  segments: Segment[];
};
function useAnalytics(from: string, to: string) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;
    request(`/analytics/revenue?from=${from}&to=${to}`)
      .then((result) => {
        if (!cancelled) setAnalytics(result);
      })
      .catch(() => {
        if (!cancelled) setAnalytics({ series: [], segments: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);
  return analytics;
}
export function RevenueChart({
  revenue = 48520,
  range = "This month",
  from = "2026-10-01",
  to = "2026-10-31",
}: {
  revenue?: number;
  range?: string;
  from?: string;
  to?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [metric, setMetric] = useState("Collected revenue");
  const analytics = useAnalytics(from, to);
  const samples = [
    25, 34, 29, 41, 36, 45, 42, 53, 45, 57, 52, 66, 62, 72, 64, 79, 74, 83, 76,
    88, 85, 101, 95, 108, 102, 116, 110, 125, 121, 137, 133,
  ];
  const series = API_URL
    ? analytics?.series || []
    : samples.map((n, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        revenue: (n / 137) * 14000,
      }));
  const values = series.length ? series.map((s) => Number(s.revenue)) : [0, 0];
  const normalized =
    metric === "Cumulative revenue"
      ? values.map((_, i) => values.slice(0, i + 1).reduce((n, v) => n + v, 0))
      : values;
  const maximum = API_URL
    ? Math.max(...normalized, 1) * 1.15
    : metric === "Cumulative revenue"
      ? Math.max(...normalized, 1) * 1.15
      : 16000;
  const pts = normalized.map((v, i) => [
    40 + (i / Math.max(normalized.length - 1, 1)) * 621,
    198 - (v / maximum) * 172,
  ]);
  const path = pts.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ");
  const prior = pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"} ${p[0]} ${Math.min(197, p[1] + 32 + Math.sin(i * 0.7) * 10)}`,
    )
    .join(" ");
  return (
    <section className="card revenue-card">
      <div className="card-heading">
        <div>
          <h2>
            Revenue overview <CircleHelp size={14} className="muted-icon" />
          </h2>
          <p>A little perspective on your business growth.</p>
        </div>
        <div className="chart-select">
          <select
            aria-label="Revenue metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option>Collected revenue</option>
            <option>Cumulative revenue</option>
          </select>
          <ChevronDown size={13} />
        </div>
      </div>
      <div className="chart-summary">
        <strong>{money(revenue)}</strong>
        <span className="trend">
          <TrendingUp size={13} />
          {API_URL ? "Cash receipts" : "18.6%"}
        </span>
        <span className="subtle">
          {API_URL ? "in selected period" : "vs. previous period"}
        </span>
      </div>
      <div className="revenue-chart">
        <svg
          viewBox="0 0 700 238"
          role="img"
          aria-label={`${range} ${API_URL ? "recorded" : "illustrative demo"} revenue trend`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a77e" stopOpacity=".17" />
              <stop offset="100%" stopColor="#16a77e" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((n) => (
            <g key={n}>
              <line
                x1="40"
                x2="682"
                y1={26 + n * 43}
                y2={26 + n * 43}
                stroke="#ebefec"
                strokeDasharray="3 4"
              />
              <text x="0" y={30 + n * 43} fill="#8b9591" fontSize="10">
                {maximum >= 1000
                  ? `$${((((4 - n) / 4) * maximum) / 1000).toFixed(0)}k`
                  : money(((4 - n) / 4) * maximum)}
              </text>
            </g>
          ))}
          <path d={`${path} L 661 200 L 40 200 Z`} fill="url(#revenue-fill)" />
          {!API_URL && (
            <path
              d={prior}
              fill="none"
              stroke="#c4cdc7"
              strokeWidth="2"
              strokeDasharray="5 5"
              strokeLinejoin="round"
            />
          )}
          <path
            d={path}
            fill="none"
            stroke="#16836b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {Array.from({ length: 7 }, (_, i) => {
            const date =
              series[
                Math.min(
                  series.length - 1,
                  Math.round((i / 6) * (series.length - 1)),
                )
              ]?.date;
            return (
              <text
                key={i}
                x={40 + i * 103.5}
                y="225"
                textAnchor={i === 0 ? "start" : i === 6 ? "end" : "middle"}
                fill="#89938e"
                fontSize="10"
              >
                {date ? dateLabel(date, true) : "—"}
              </text>
            );
          })}
          {pts.map((p, i) => (
            <rect
              key={i}
              x={p[0] - 10}
              y="15"
              width="21"
              height="187"
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          {hover !== null && pts[hover] && (
            <g pointerEvents="none">
              <line
                x1={pts[hover][0]}
                x2={pts[hover][0]}
                y1="20"
                y2="200"
                stroke="#7ca393"
                strokeDasharray="4 4"
              />
              <circle
                cx={pts[hover][0]}
                cy={pts[hover][1]}
                r="5"
                fill="#14856b"
                stroke="white"
                strokeWidth="3"
              />
              <rect
                x={Math.min(pts[hover][0] - 35, 590)}
                y={Math.max(pts[hover][1] - 40, 0)}
                width="75"
                height="27"
                rx="5"
                fill="#193d32"
              />
              <text
                x={Math.min(pts[hover][0] + 2, 628)}
                y={Math.max(pts[hover][1] - 22, 18)}
                textAnchor="middle"
                fill="white"
                fontSize="11"
              >
                {money(normalized[hover])}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-line current" />
          This period
        </span>
        {!API_URL && (
          <span>
            <i className="legend-line previous" />
            Previous period
          </span>
        )}
        <span className="chart-note">
          {API_URL ? "Actual payments · USD" : "Illustrative demo trend · USD"}
        </span>
      </div>
    </section>
  );
}
export function RevenueBreakdown({
  revenue = 48520,
  from = "2026-10-01",
  to = "2026-10-31",
}: {
  revenue?: number;
  from?: string;
  to?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const analytics = useAnalytics(from, to);
  const segments = API_URL
    ? analytics?.segments || []
    : [
        { name: "Monthly plans", pct: 62, color: "#21866b" },
        { name: "Yearly plans", pct: 30, color: "#8ac9a8" },
        { name: "Add-ons", pct: 8, color: "#e5e9b4" },
      ];
  const selection = selected !== null ? segments[selected] : null;
  return (
    <section className="card breakdown-card">
      <div className="card-heading">
        <div>
          <h2>Revenue breakdown</h2>
          <p>Where your revenue comes from.</p>
        </div>
        <CircleHelp size={15} className="muted-icon" />
      </div>
      <div className="donut-wrap">
        <svg
          viewBox="0 0 220 220"
          role="img"
          aria-label={segments.map((s) => `${s.name} ${s.pct}%`).join(", ")}
        >
          <circle
            cx="110"
            cy="110"
            r="79"
            fill="none"
            stroke="#f0f3ef"
            strokeWidth="26"
          />
          {segments.map((s, i) => {
            const offset = segments.slice(0, i).reduce((a, v) => a + v.pct, 0);
            return (
              <circle
                key={s.name}
                cx="110"
                cy="110"
                r="79"
                fill="none"
                stroke={s.color}
                strokeWidth={selected === i ? 30 : 26}
                strokeDasharray={`${Math.max(0, (s.pct / 100) * 496.37 - 5)} 496.37`}
                strokeDashoffset={(-offset / 100) * 496.37}
                transform="rotate(-90 110 110)"
                className="donut-segment"
                onMouseEnter={() => setSelected(i)}
                onMouseLeave={() => setSelected(null)}
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <span>{selection ? selection.name : "Total revenue"}</span>
          <strong>
            {money(selection ? (revenue * selection.pct) / 100 : revenue)}
          </strong>
          <span className="donut-growth">
            <ArrowUpRight size={13} />
            {API_URL ? "Selected period" : "18.6% this month"}
          </span>
        </div>
      </div>
      <div className="breakdown-legend">
        {segments.map((s, i) => (
          <button
            key={s.name}
            onMouseEnter={() => setSelected(i)}
            onMouseLeave={() => setSelected(null)}
            onFocus={() => setSelected(i)}
            onBlur={() => setSelected(null)}
            onClick={() => setSelected(selected === i ? null : i)}
          >
            <span>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
            <strong>
              {money((revenue * s.pct) / 100)}
              <small>{Math.round(s.pct)}%</small>
            </strong>
          </button>
        ))}
      </div>
    </section>
  );
}
