import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api";
import { pct, rupee } from "../format";

const RANGES = [
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
];

const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tip">
      <span>{new Date(p.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
      <strong>{rupee(p.close)}</strong>
    </div>
  );
}

export default function PriceChart({ symbol }) {
  const [range, setRange] = useState("1m");
  const [points, setPoints] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    api
      .get(`/stocks/${symbol}/chart`, { params: { range } })
      .then(({ data }) => alive && (setPoints(data.points), setState(data.points.length ? "ok" : "empty")))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [symbol, range]);

  const first = points[0]?.close;
  const last = points.at(-1)?.close;
  const change = first ? ((last - first) / first) * 100 : 0;
  const color = change >= 0 ? "var(--gain)" : "var(--loss)";

  return (
    <section className="panel chart-panel" aria-label="Price history">
      <div className="chart-head">
        <p className="muted">
          {state === "ok" ? (
            <>
              Over this period: <span className={change >= 0 ? "gain" : "loss"}>{pct(change)}</span>
            </>
          ) : (
            "Daily closing price"
          )}
        </p>
        <div className="segmented" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-box">
        {state === "loading" && <p className="chart-msg">Loading chart…</p>}
        {state === "error" && <p className="chart-msg">Chart data isn’t available right now. Try another range.</p>}
        {state === "empty" && <p className="chart-msg">No trading days in this range yet.</p>}
        {state === "ok" && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="date"
                tickFormatter={day}
                tick={{ fill: "var(--ink-3)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`}
                tick={{ fill: "var(--ink-3)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={72}
                orientation="right"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={color}
                strokeWidth={2}
                fill="url(#fill)"
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
