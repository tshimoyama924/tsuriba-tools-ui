import { useEffect, useMemo, useState } from "react";

type TideEvent = { time: string; heightCm: number };
type TideResponse = {
  station_code: string;
  date: string;
  hourly: (number | null)[];
  highTides: TideEvent[];
  lowTides: TideEvent[];
};

function todayJst(): string {
  // ブラウザのローカル日付でOK（JST運用前提なら十分）
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialStation = params.get("station_code") ?? "D1";
  const initialDate = params.get("date") ?? todayJst();

  const [stationCode, setStationCode] = useState(initialStation);
  const [date, setDate] = useState(initialDate);

  const [data, setData] = useState<TideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTides = async (st: string, dt: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    const url = `/api/v1/tides?station_code=${encodeURIComponent(
      st
    )}&date=${encodeURIComponent(dt)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TideResponse;
      setData(json);

      // URLも更新（WP iframe運用で効く）
      const next = new URL(window.location.href);
      next.searchParams.set("station_code", st);
      next.searchParams.set("date", dt);
      window.history.replaceState({}, "", next.toString());
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初回はURLパラメータ（or デフォルト）で取得
    fetchTides(initialStation, initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif", maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>潮汐データ</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchTides(stationCode.trim().toUpperCase(), date);
        }}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>station_code</span>
          <input
            value={stationCode}
            onChange={(e) => setStationCode(e.target.value)}
            placeholder="D1"
            style={{ padding: 8, width: 160 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: "10px 14px",
            cursor: "pointer",
          }}
          disabled={loading}
        >
          {loading ? "取得中..." : "取得"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!data && !error && loading && <p>Loading...</p>}

      {data && (
        <>
          <p style={{ marginTop: 0 }}>
            station: <b>{data.station_code}</b> / date: <b>{data.date}</b>
          </p>

          <h2>高潮</h2>
          <ul>
            {data.highTides.map((t, i) => (
              <li key={i}>
                {t.time}（{t.heightCm}cm）
              </li>
            ))}
          </ul>

          <h2>低潮</h2>
          <ul>
            {data.lowTides.map((t, i) => (
              <li key={i}>
                {t.time}（{t.heightCm}cm）
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
