import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.ts";
import "./index.css";
import { Index } from "./index";
import { Page } from "./layout/page.tsx";
import { ContextMenu } from "@theme/ContexMenu.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div id="modal-root"></div>
    <ContextMenu />
    <Page>
      <Index />
    </Page>
  </StrictMode>
);
