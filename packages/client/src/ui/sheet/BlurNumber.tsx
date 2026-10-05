import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  label: string;
  max?: number;
  disabled?: boolean;
};

/** Commits on blur so a multi-digit edit does not shrink lists on the first key. */
export function BlurNumber({ value, onCommit, className, label, max = 15, disabled = false }: Props) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const commit = () => {
    focused.current = false;
    const n = Number(text);
    const next = Number.isFinite(n) ? Math.max(0, Math.min(max, Math.trunc(n))) : value;
    setText(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      className={className}
      inputMode="numeric"
      aria-label={label}
      disabled={disabled}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^\d+$/.test(raw)) return;
        setText(raw);
      }}
    />
  );
}
