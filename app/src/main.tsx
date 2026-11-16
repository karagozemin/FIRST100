import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import process from "process";
import "@near-wallet-selector/modal-ui/styles.css";
import "./styles.css";
import "./product.css";
import App from "./App";

(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
(globalThis as typeof globalThis & { process: typeof process }).process = process;

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
