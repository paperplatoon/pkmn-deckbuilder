"use strict";

// Bootstrap: create state and render UI.

(function () {
  function boot() {
    const state = createInitialState();
    // Expose for quick manual inspection during MVP
    window.__STATE__ = state;

    // Initial log line before first render
    log(state, "Game ready. Seeded starting deck.");
    render(state);
    attachHandlers(state);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
