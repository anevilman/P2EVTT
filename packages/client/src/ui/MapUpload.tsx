import { useRef, useState } from "react";
import { gmFetch } from "../net/gmApi";

type Props = {
  sessionToken: string;
  sceneId: string;
};

export function MapUpload({ sessionToken, sceneId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus("Uploading…");
    const body = new FormData();
    body.append("file", file);
    try {
      await gmFetch(`/api/scenes/${sceneId}/background`, sessionToken, {
        method: "POST",
        body,
      });
      setStatus("Map updated.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="map-upload">
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
