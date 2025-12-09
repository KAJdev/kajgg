import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.ts";
import "./index.css";
import { Index } from "./index";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Index />
  </StrictMode>
);
