import { useEffect, useRef } from "react";
import type { RollResult } from "@p2evtt/shared";
import { useStore } from "../store/TableStore";

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function dieLabel(die: RollResult["dice"][number]): string {
  return `${die.sign < 0 ? "−" : ""}d${die.sides} ${die.face}`;
}

export function RollLog() {
  const log = useStore().state.rollLog;
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [log.length]);

  return (
    <ol className="roll-log" aria-label="Rolls">
      {log.length === 0 ? <li className="roll-empty">Rolls show up here.</li> : null}
      {log.map((roll) => {
        return (
          <li key={roll.id}>
            <span className="roll-who">{roll.roller}</span>
            {" · "}
            {roll.dice.map((die, index) => (
              <span key={index} className={die.kept ? undefined : "die-drop"}>
                {index > 0 ? ", " : ""}
                {dieLabel(die)}
              </span>
            ))}
            {" · "}
            {roll.constants.length > 0
              ? `sum ${roll.diceTotal} ${roll.constants.map(signed).join(" ")} = ${roll.total}`
              : `sum ${roll.diceTotal}`}
            {roll.degree ? (
              <>
                {" · "}
                <span className={`deg-${roll.degree}`}>{roll.degree}</span>
              </>
            ) : null}
          </li>
        );
      })}
      <li ref={end} className="roll-empty" hidden />
    </ol>
  );
}
