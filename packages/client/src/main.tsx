import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TableStoreProvider } from "./store/TableStore";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(
  <StrictMode>
    <TableStoreProvider>
      <App />
    </TableStoreProvider>
  </StrictMode>,
);
