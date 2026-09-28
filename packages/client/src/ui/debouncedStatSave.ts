import { useEffect, useRef } from "react";

const WAIT_MS = 400;

type Save<T> = (id: string, data: T) => void | Promise<unknown>;

/** Collapse disk writes. Callers update the field immediately and must not wait on this. */
export function useDebouncedStatSave<T>(save: Save<T>): {
  schedule: (id: string, data: T) => void;
  cancelId: (id: string) => void;
} {
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef(0);
  const pending = useRef<{ id: string; data: T } | null>(null);
  const tail = useRef<Promise<void>>(Promise.resolve());

  const flush = () => {
    window.clearTimeout(timer.current);
    const job = pending.current;
    pending.current = null;
    if (!job) return;
    const run = saveRef.current;
    tail.current = tail.current
      .catch(() => undefined)
      .then(() => run(job.id, job.data))
      .then(() => undefined);
  };

  useEffect(() => () => flush(), []);

  return {
    schedule(id, data) {
      if (pending.current && pending.current.id !== id) flush();
      pending.current = { id, data };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, WAIT_MS);
    },
    cancelId(id) {
      if (pending.current?.id !== id) return;
      window.clearTimeout(timer.current);
      pending.current = null;
    },
  };
}
