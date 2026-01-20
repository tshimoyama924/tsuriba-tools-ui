import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Legend } from "recharts";

interface Station {
  station_code: string;
  name: string;
  office_code: string;
  area_code: string;
  area_name?: string;
  forecast_area_code?: string;
}

interface FishingForecastResponse {
  station: Station;
  date: string;
  tide: {
    hourly_cm: (number | null)[];
    high: { time: string; height_cm: number }[];
    low: { time: string; height_cm: number }[];
    meta: { source: string; year: number; dataVersion: string };
  };
  today: {
    weather: {
      code?: string;
      text_ja?: string;
      icon?: string;
    };
    wind_text?: string;
    wave_text?: string;
    pop: { time: string; value?: number }[];
  };
  weekly: {
    date: string;
    weather: {
      code?: string;
      text_ja?: string;
      icon?: string;
    };
    pop?: number;
    temp_min?: number;
    temp_max?: number;
    reliability?: string;
  }[];
  meta: {
    forecast_source: string;
    forecast_report_datetime?: string;
    weekly_temp_area?: { name: string; code: string };
    used_area_code?: string;
    used_pop_area_code?: string;
  };
}

function getApiBase(): string {
  if (import.meta.env.DEV) return "";
  const env = (import.meta.env.VITE_API_BASE ?? "").trim();
  return (env || "https://api.tsuriba-guide.com").replace(/\/+$/, "");
}

export default function App() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [stationCode, setStationCode] = useState("");
  const [date, setDate] = useState("");
  const [forecast, setForecast] = useState<FishingForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStations = async () => {
      const base = getApiBase();
      const url = `${base}/api/v1/stations`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Stations fetch failed: ${res.status}`);
        const data: Station[] = await res.json();
        setStations(data);
      } catch (e: any) {
        setError(`Stations load error: ${e.message}`);
      }
    };
    fetchStations();
  }, []);

  const fetchForecast = async (st: string, dt: string) => {
    if (!st || !dt) {
      setError("港と日付を選択してください");
      return;
    }
    setLoading(true);
    setError(null);
    setForecast(null);
    const base = getApiBase();
    const url = `${base}/api/v1/fishing-forecast?station_code=${encodeURIComponent(st)}&date=${encodeURIComponent(dt)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const data: FishingForecastResponse = await res.json();
      setForecast(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = forecast ? Array.from({ length: 24 }, (_, h) => {
    const height = forecast.tide.hourly_cm[h];
    return {
      x: h,
      label: `${String(h).padStart(2, "0")}:00`,
      height: height !== null ? height : undefined,
    };
  }) : [];

  const toHourFraction = (time: string) => {
    const [hStr, mStr = "0"] = time.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    const hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0;
    const minute = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
    return hour + minute / 60;
  };

  const interpolateHeight = (hourFraction: number) => {
    const baseHour = Math.floor(hourFraction);
    const nextHour = Math.min(23, baseHour + 1);
    const h0 = forecast?.tide.hourly_cm[baseHour];
    if (h0 === null || h0 === undefined) return null;
    if (baseHour === 23) return h0;
    const h1 = forecast?.tide.hourly_cm[nextHour];
    if (h1 === null || h1 === undefined) return h0;
    const ratio = hourFraction - baseHour;
    return h0 + (h1 - h0) * ratio;
  };

  const tideEvents = forecast ? [
    ...forecast.tide.high.map(h => ({ type: "満潮" as const, time: h.time, height: h.height_cm })),
    ...forecast.tide.low.map(l => ({ type: "干潮" as const, time: l.time, height: l.height_cm })),
  ].sort((a, b) => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };
    return toMinutes(a.time) - toMinutes(b.time);
  }) : [];

  const lowMarkers = forecast ? forecast.tide.low.map(l => {
    const x = toHourFraction(l.time);
    const y = interpolateHeight(x);
    if (y === null) return null;
    return { x, height: y };
  }).filter((m): m is { x: number; height: number } => Boolean(m)) : [];

  const highMarkers = forecast ? forecast.tide.high.map(h => {
    const x = toHourFraction(h.time);
    const y = interpolateHeight(x);
    if (y === null) return null;
    return { x, height: y };
  }).filter((m): m is { x: number; height: number } => Boolean(m)) : [];

  const currentDay = forecast?.weekly.find(w => w.date === forecast.date);

  const hasToday = forecast ? (
    forecast.today.weather.code ||
    forecast.today.wind_text ||
    forecast.today.wave_text ||
    forecast.today.pop.some(p => p.value !== undefined)
  ) : false;

  const hasWeekly = forecast ? forecast.weekly.length > 0 : false;

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif", maxWidth: 1200 }}>
      <h1>潮汐・天気ダッシュボード</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchForecast(stationCode, date);
        }}
        style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>港選択</span>
          <select
            value={stationCode}
            onChange={(e) => setStationCode(e.target.value)}
            style={{ padding: 8, width: 200 }}
            disabled={!stations}
          >
            <option value="">選択してください</option>
            {stations?.map(s => (
              <option key={s.station_code} value={s.station_code}>
                {s.name}（{s.station_code}）
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>日付</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />
        </label>

        <button type="submit" style={{ padding: "10px 14px", cursor: "pointer" }} disabled={loading}>
          {loading ? "検索中..." : "検索"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>エラー: {error}</p>}
      {!forecast && !error && loading && <p>読み込み中...</p>}

      {forecast && (
        <>
          <h2>検索結果: {forecast.station.name} ({forecast.date})</h2>

          <h3>満潮・干潮</h3>
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: 8 }}>種別</th>
                <th style={{ border: "1px solid #ccc", padding: 8 }}>時刻</th>
                <th style={{ border: "1px solid #ccc", padding: 8 }}>潮位(cm)</th>
              </tr>
            </thead>
            <tbody>
              {tideEvents.map((event, idx) => (
                <tr key={`${event.type}-${event.time}-${idx}`}>
                  <td style={{ border: "1px solid #ccc", padding: 8 }}>{event.type}</td>
                  <td style={{ border: "1px solid #ccc", padding: 8 }}>{event.time}</td>
                  <td style={{ border: "1px solid #ccc", padding: 8 }}>{event.height}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>潮汐グラフ</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 23]}
                ticks={[0, 6, 12, 18, 23]}
                tickFormatter={(value) => `${String(Math.round(value)).padStart(2, "0")}:00`}
                allowDecimals={false}
              />
              <YAxis />
              <Tooltip />
              <Line name="潮位" type="monotone" dataKey="height" stroke="#8884d8" dot={false} legendType="line" />
              <Scatter name="干潮" data={lowMarkers} dataKey="height" fill="#1e88e5"  shape="circle" legendType="circle" />
              <Scatter name="満潮" data={highMarkers} dataKey="height" fill="#e53935" shape="square" legendType="square" />
              <Legend />
            </LineChart>
          </ResponsiveContainer>

          <h3>天気予報</h3>
          {hasToday ? (
            <div>
              <h4>当日予報</h4>
              <p>天気: {forecast.today.weather.text_ja || "不明"}</p>
              <p>風向・風速: {forecast.today.wind_text || "不明"}</p>
              <p>波: {forecast.today.wave_text || "不明"}</p>
              <p>降水確率: {forecast.today.pop.map(p => `${p.time}: ${p.value !== undefined ? `${p.value}%` : "不明"}`).join(", ")}</p>
            </div>
          ) : hasWeekly ? (
            <div>
              <h4>週間予報</h4>
              {currentDay && (
                <>
                  <p>天気: {currentDay.weather.text_ja || "不明"}</p>
                  <p>降水確率: {currentDay.pop !== undefined ? `${currentDay.pop}%` : "不明"}</p>
                  <p>気温: {currentDay.temp_min !== undefined && currentDay.temp_max !== undefined ? `${currentDay.temp_min}℃ / ${currentDay.temp_max}℃` : "不明"}</p>
                </>
              )}
            </div>
          ) : (
            <p>該当日の予報はありません</p>
          )}
        </>
      )}
    </main>
  );
}
