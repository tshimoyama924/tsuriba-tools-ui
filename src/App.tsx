import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

  const chartData = forecast ? forecast.tide.hourly_cm.map((height, index) => ({
    time: `${String(index).padStart(2, "0")}:00`,
    height: height !== null ? height : undefined,
  })) : [];

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
      <h1>釣り場ツール UI</h1>

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

          <h3>潮汐データ</h3>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: 8 }}>時刻</th>
                <th style={{ border: "1px solid #ccc", padding: 8 }}>潮位(cm)</th>
              </tr>
            </thead>
            <tbody>
              {forecast.tide.hourly_cm.map((height, index) => {
                const time = `${String(index).padStart(2, "0")}:00`;
                const isHigh = forecast.tide.high.some(h => h.time === time);
                const isLow = forecast.tide.low.some(l => l.time === time);
                return (
                  <tr key={index} style={{ backgroundColor: isHigh ? "#ffcccc" : isLow ? "#ccccff" : "transparent" }}>
                    <td style={{ border: "1px solid #ccc", padding: 8 }}>{time}</td>
                    <td style={{ border: "1px solid #ccc", padding: 8 }}>{height !== null ? height : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3>潮汐＋日の出・日の入りグラフ</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="height" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
          <p>この日の出没データは取得できません</p>

          <h3>天気・釣り予報情報</h3>
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
              <h4>週間予報のみ取得</h4>
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
