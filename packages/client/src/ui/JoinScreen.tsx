import { useState, type FormEvent } from "react";
import { APP_NAME, APP_VERSION } from "@p2evtt/shared";

type Props = {
  defaultName: string;
  busy: boolean;
  error: string | null;
  onJoin: (displayName: string) => void;
};

export function JoinScreen({ defaultName, busy, error, onJoin }: Props) {
  const [name, setName] = useState(defaultName);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onJoin(name.trim());
  };

  return (
    <main className="splash">
      <h1>{APP_NAME}</h1>
      <p className="tagline">Pathfinder 2e virtual tabletop — local table</p>
      <p className="meta">Open this page in a browser. Only the host runs the server.</p>
      <form className="join" onSubmit={submit}>
        <label>
          Display name
          <input
            autoFocus
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name at the table"
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy || name.trim().length < 1}>
          {busy ? "Sitting down…" : "Sit at the table"}
        </button>
      </form>
      {error ? <p className="err">{error}</p> : null}
      <p className="meta">client {APP_VERSION}</p>
    </main>
  );
}
