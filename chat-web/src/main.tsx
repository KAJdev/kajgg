import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.ts";
import "./index.css";
import { Index } from "./index";
import { Page } from "./layout/page.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div id="modal-root"></div>
    <Page>
      <Index />
    </Page>
  </StrictMode>
);
