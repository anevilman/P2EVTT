import type { SkillLine, StatBlockData, StrikeLine } from "@p2evtt/shared";

type Props = {
  data: StatBlockData;
  onChange: (data: StatBlockData) => void;
};

function nid(): string {
  return crypto.randomUUID();
}

export function StatBlockEditor({ data, onChange }: Props) {
  const set = (patch: Partial<StatBlockData>) => onChange({ ...data, ...patch });
  const num = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="stat-editor">
      <div className="stat-row">
        <label>
          Level
          <input type="number" value={data.level} onChange={(e) => set({ level: num(e.target.value) })} />
        </label>
        <label className="grow">
          Traits
          <input value={data.traits} onChange={(e) => set({ traits: e.target.value })} />
        </label>
      </div>
      <div className="stat-row">
        <label>
          Perception
          <input type="number" value={data.perception} onChange={(e) => set({ perception: num(e.target.value) })} />
        </label>
        <label className="grow">
          Speed
          <input value={data.speed} onChange={(e) => set({ speed: e.target.value })} />
        </label>
      </div>
      <div className="stat-row six">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => (
          <label key={key}>
            {key.toUpperCase()}
            <input type="number" value={data[key]} onChange={(e) => set({ [key]: num(e.target.value) })} />
          </label>
        ))}
      </div>
      <div className="stat-row">
        <label>
          AC
          <input type="number" value={data.ac} onChange={(e) => set({ ac: num(e.target.value) })} />
        </label>
        <label>
          HP
          <input type="number" value={data.hp} onChange={(e) => set({ hp: num(e.target.value) })} />
        </label>
        <label>
          Max HP
          <input type="number" value={data.hpMax} onChange={(e) => set({ hpMax: num(e.target.value) })} />
        </label>
      </div>
      <div className="stat-row">
        <label>
          Fort
          <input type="number" value={data.fort} onChange={(e) => set({ fort: num(e.target.value) })} />
        </label>
        <label>
          Ref
          <input type="number" value={data.ref} onChange={(e) => set({ ref: num(e.target.value) })} />
        </label>
        <label>
          Will
          <input type="number" value={data.will} onChange={(e) => set({ will: num(e.target.value) })} />
        </label>
      </div>
      <h3>Skills</h3>
      {data.skills.map((skill, i) => (
        <div className="stat-row" key={skill.id}>
          <input
            className="grow"
            value={skill.name}
            onChange={(e) => set({ skills: patchAt(data.skills, i, { ...skill, name: e.target.value }) })}
          />
          <input
            type="number"
            value={skill.bonus}
            onChange={(e) => set({ skills: patchAt(data.skills, i, { ...skill, bonus: num(e.target.value) }) })}
          />
          <button type="button" className="scene-x" onClick={() => set({ skills: data.skills.filter((_, j) => j !== i) })}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="file-btn"
        onClick={() => set({ skills: [...data.skills, { id: nid(), name: "Skill", bonus: 0 } satisfies SkillLine] })}
      >
        Add skill
      </button>
      <h3>Strikes</h3>
      {data.strikes.map((strike, i) => (
        <div className="stat-strike" key={strike.id}>
          <input
            value={strike.name}
            onChange={(e) => set({ strikes: patchAt(data.strikes, i, { ...strike, name: e.target.value }) })}
          />
          <input
            type="number"
            value={strike.attack}
            onChange={(e) => set({ strikes: patchAt(data.strikes, i, { ...strike, attack: num(e.target.value) }) })}
          />
          <input
            value={strike.damage}
            onChange={(e) => set({ strikes: patchAt(data.strikes, i, { ...strike, damage: e.target.value }) })}
          />
          <button type="button" className="scene-x" onClick={() => set({ strikes: data.strikes.filter((_, j) => j !== i) })}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="file-btn"
        onClick={() =>
          set({ strikes: [...data.strikes, { id: nid(), name: "Strike", attack: 0, damage: "1d8" } satisfies StrikeLine] })
        }
      >
        Add strike
      </button>
      <label className="folder-move">
        Notes
        <textarea rows={4} value={data.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
    </div>
  );
}

function patchAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item));
}
