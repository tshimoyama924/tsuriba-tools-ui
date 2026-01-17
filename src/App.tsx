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
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 入力が "YYYY-MM-DD" 以外でも可能な限り YYYY-MM-DD に寄せる。
 * - "YYYY/MM/DD" -> "YYYY-MM-DD"
 * - "YYYY.MM.DD" -> "YYYY-MM-DD"
 * - "YYYY-M-D"   -> "YYYY-MM-DD"
 * それ以外はそのまま返す（API側で弾かれるならエラーに出る）
 */
function normalizeDate(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return todayJst();

  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return s;

  const yyyy = m[1];
  const mm = String(Number(m[2])).padStart(2, "0");
  const dd = String(Number(m[3])).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * APIベースURL:
 * - 優先: VITE_API_BASE
 * - 既定: https://api.tsuriba-guide.com
 *
 * 末尾スラッシュは除去して統一。
 */
function getApiBase(): string {
  // 本番ビルド時（Cloudflare Pages）
  if (import.meta.env.PROD) {
    return "https://api.tsuriba-guide.com";
  }
  // ローカル開発時（Vite proxy を使う）
  return "";
}

export default function App() {
  const [stationCode, setStationCode] = useState("");
  const [date, setDate] = useState("");

  const [data, setData] = useState<TideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTides = async (stRaw: string, dtRaw: string) => {
    const st = (stRaw ?? "").trim().toUpperCase();
    const dt = normalizeDate(dtRaw);

    if (!st) {
      setError("station_code が空です");
      return;
    }
    if (!dt) {
      setError("date が空です");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    const base = getApiBase();
    const url = `${base}/api/v1/tides?station_code=${encodeURIComponent(
      st
    )}&date=${encodeURIComponent(dt)}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        // 可能なら本文も読んでデバッグしやすくする（HTMLが返ってきても分かる）
        const text = await res.text().catch(() => "");
        const hint =
          text && text.trim().startsWith("<")
            ? "（HTMLが返っています。URLがPages側/別ページを指している可能性）"
            : "";
        throw new Error(`HTTP ${res.status} ${res.statusText} ${hint}`);
      }

      // JSON以外が返ってきたらここで落ちるが、上の text 判定が効くケースも多い
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
  const params = new URLSearchParams(window.location.search);

  const st = params.get("station_code");
  const dt = params.get("date");

  if (st) {
    setStationCode(st.trim().toUpperCase());
  }

  if (dt) {
    setDate(normalizeDate(dt));
  }

  // 読み終わったらURLからクエリを消す
  if (st || dt) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif", maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>潮汐データ</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchTides(stationCode, date);
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
            onChange={(e) => setDate(normalizeDate(e.target.value))}
            style={{ padding: 8, width: 180 }}
          />
        </label>

        <button
          type="submit"
          style={{ padding: "10px 14px", cursor: "pointer" }}
          disabled={loading}
        >
          {loading ? "取得中..." : "取得"}
        </button>
      </form>

      <p style={{ marginTop: 0, opacity: 0.7 }}>
        API: <code>{getApiBase()}</code>
      </p>

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
