(function () {
  console.log("✅ CampusShield panel script loaded");

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(() => {
    initCampusShieldPanel();
  });

  function initCampusShieldPanel() {
    const closeBtn = document.getElementById("cs-close");
    const dismissBtn = document.getElementById("cs-dismiss");
    const learnBtn = document.getElementById("cs-learn");

    if (closeBtn)
      closeBtn.addEventListener("click", () =>
        window.parent.postMessage({ type: "cs-close" }, "*")
      );

    if (dismissBtn)
      dismissBtn.addEventListener("click", () =>
        window.parent.postMessage({ type: "cs-close" }, "*")
      );

    if (learnBtn)
      learnBtn.addEventListener("click", () =>
        alert(
          "Avoid clicking unknown links. Verify sender domain. Beware of urgency language."
        )
      );
  }

  // Listen for scan results
  window.addEventListener("message", (ev) => {
    if (ev.data?.type !== "cs-result") return;
    const r = ev.data.payload || {};

    document.getElementById("cs-risk").textContent =
      r.risk_level || "Unknown";

    document.getElementById("cs-confidence").textContent =
      Math.round((r.confidence_score || 0) * 100) + "% confidence";

    const explain = document.getElementById("cs-explain");
    explain.innerHTML = "<h4>Why we flagged this</h4><ul>" +
      (r.explanations || []).map(e => `<li>${e}</li>`).join("") +
      "</ul>";

    const links = document.getElementById("cs-links-list");
    links.innerHTML = (r.suspicious_links || [])
      .map(l => `<li><a href="${l}" target="_blank">${l}</a></li>`)
      .join("");
  });
})();