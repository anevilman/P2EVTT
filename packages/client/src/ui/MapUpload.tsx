import { useRef, useState } from "react";

type Props = {
  sessionToken: string;
};

export function MapUpload({ sessionToken }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus("Uploading…");
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/scene/background", {
        method: "POST",
        headers: { "X-Session-Token": sessionToken },
        body,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `Upload failed (${res.status})`);
      }
      setStatus("Map updated.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="map-upload">
      <h2>Scene</h2>
      <button type="button" className="file-btn" onClick={() => inputRef.current?.click()}>
        Upload map image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onFile(file);
        }}
      />
      {status ? <p className="meta">{status}</p> : null}
    </div>
  );
}
