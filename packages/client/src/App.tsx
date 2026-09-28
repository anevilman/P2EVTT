import { useStore } from "./store/TableStore";
import { GmShell } from "./ui/GmShell";
import { JoinScreen } from "./ui/JoinScreen";
import { PlayerShell } from "./ui/PlayerShell";

export function App() {
  const { state } = useStore();

  if (state.session?.you.role === "gm" && state.scene) return <GmShell />;
  if (state.session?.you.role === "player" && state.scene) return <PlayerShell />;
  return <JoinScreen />;
}
