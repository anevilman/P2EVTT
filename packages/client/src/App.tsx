import { useEffect, useState } from "react";
import { APP_NAME, APP_VERSION } from "@p2evtt/shared";

type Health = {
  ok: boolean;
  name: string;
  version: string;
};

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) throw new Error(`health ${res.status}`);
        return (await res.json()) as Health;
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="splash">
      <h1>{APP_NAME}</h1>
      <p className="tagline">Pathfinder 2e virtual tabletop — local table</p>
      <p className="meta">client {APP_VERSION}</p>
      {health ? (
        <p className="ok">server {health.version} · ok</p>
      ) : error ? (
        <p className="err">server unreachable: {error}</p>
      ) : (
        <p className="meta">checking server…</p>
      )}
    </main>
  );
}
