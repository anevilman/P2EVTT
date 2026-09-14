import type { Presence } from "@p2evtt/shared";

export function assigneeNames(players: Presence[], current: string | null): string[] {
  const names = players.filter((p) => p.role === "player").map((p) => p.displayName);
  if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
    names.push(current);
  }
  return [...new Set(names)];
}

type Props = {
  value: string | null;
  players: Presence[];
  onChange: (name: string | null) => void;
  label?: string;
};

export function AssignedToSelect({ value, players, onChange, label = "Assigned to" }: Props) {
  const names = assigneeNames(players, value);
  return (
    <label className="folder-move">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      >
        <option value="">Unassigned (GM only)</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
