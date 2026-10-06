import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
// The playground has its own sheet — it is a workbench bolted to the side of
// the game, and keeping it separate keeps that visible.
import "./lab.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable to a phone home screen, and playable on a bad connection.
// Dev is left alone — a service worker there just gets in the way of HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Whether this page was ALREADY running under a service worker. On a first
  // ever visit the controller appears a moment later, and that is not a stale
  // page — reloading for it would be a pointless flash.
  const wasControlled = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // A new version took over a page that was running an old one. Without this
    // the player keeps the old app until they happen to close every tab, which
    // on a phone home screen can be never.
    if (!wasControlled || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => reg.update())
      .catch(() => {
        /* no service worker is survivable; the game still runs */
      });
  });
}
