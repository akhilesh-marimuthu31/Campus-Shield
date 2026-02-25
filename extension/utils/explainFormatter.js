(function () {
  function formatExplanation(result) {
    if (!result) return "<p>No analysis available.</p>";

    const { risk_level, confidence_score, explanations } = result;

    return `
      <h3>Risk Level: ${risk_level}</h3>
      <p>Confidence: ${(confidence_score * 100).toFixed(0)}%</p>
      <ul>
        ${explanations.map(e => `<li>${e}</li>`).join("")}
      </ul>
    `;
  }

  // Expose globally
  window.CampusShieldExplain = {
    formatExplanation
  };
})();