console.log("✅ CampusShield panel loaded");

// #region agent log
console.log("[DEBUG] Panel script loaded", {
  documentReadyState: document.readyState,
  hasCsRisk: !!document.getElementById('cs-risk'),
  hasCsConfidence: !!document.getElementById('cs-confidence'),
  hasCsExplain: !!document.getElementById('cs-explain')
});
// #endregion

// Queue for messages that arrive before DOM is ready
let pendingResult = null;

function renderResult(result) {
  // #region agent log
  console.log("[DEBUG] renderResult called", {
    hasResult: !!result,
    riskLevel: result?.risk_level,
    confidenceScore: result?.confidence_score,
    hasExplanations: Array.isArray(result?.explanations),
    explanationsCount: (result?.explanations || []).length
  });
  // #endregion

  if (!result) {
    console.warn("⚠️ CampusShield: renderResult called with no result");
    return;
  }

  // Ensure DOM is ready before accessing elements
  if (document.readyState === 'loading') {
    console.log("[DEBUG] DOM not ready, queuing result");
    pendingResult = result;
    return;
  }

  // Safely access risk_level
  const riskEl = document.getElementById("cs-risk");
  if (riskEl) {
    riskEl.innerText = result.risk_level || "Unknown";
    // #region agent log
    console.log("[DEBUG] Updated risk element", { riskLevel: result.risk_level });
    // #endregion
  } else {
    console.warn("⚠️ CampusShield: Element #cs-risk not found");
    // #region agent log
    console.log("[DEBUG] Missing element cs-risk");
    // #endregion
  }

  // Safely access confidence_score
  const scoreEl = document.getElementById("cs-confidence");
  if (scoreEl) {
    const score = result.confidence_score != null ? Math.round(result.confidence_score * 100) : 0;
    scoreEl.innerText = score + "%";
    // #region agent log
    console.log("[DEBUG] Updated confidence element", { 
      confidenceScore: result.confidence_score, 
      displayScore: score 
    });
    // #endregion
  } else {
    console.warn("⚠️ CampusShield: Element #cs-confidence not found");
    // #region agent log
    console.log("[DEBUG] Missing element cs-confidence");
    // #endregion
  }

  // Safely access explanations
  const explainSection = document.getElementById("cs-explain");
  if (explainSection) {
    let list = explainSection.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      explainSection.appendChild(list);
    }
    list.innerHTML = "";
    (result.explanations || []).forEach(e => {
      const li = document.createElement("li");
      li.textContent = e;
      list.appendChild(li);
    });
    // #region agent log
    console.log("[DEBUG] Updated explanations list", { 
      explanationCount: (result.explanations || []).length 
    });
    // #endregion
  } else {
    console.warn("⚠️ CampusShield: Element #cs-explain not found");
    // #region agent log
    console.log("[DEBUG] Missing element cs-explain");
    // #endregion
  }
}

// Handle DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] DOMContentLoaded fired");
    if (pendingResult) {
      console.log("[DEBUG] Processing pending result");
      renderResult(pendingResult);
      pendingResult = null;
    }
  });
} else {
  // DOM already ready
  if (pendingResult) {
    renderResult(pendingResult);
    pendingResult = null;
  }
}

window.addEventListener("message", (event) => {
  // #region agent log
  console.log("[DEBUG] Message received", {
    hasEventData: !!event.data,
    eventType: event.data?.type,
    hasPayload: !!event.data?.payload,
    origin: event.origin
  });
  // #endregion

  if (event.data?.type !== "CS_SCAN_RESULT") {
    // #region agent log
    console.log("[DEBUG] Message type mismatch, ignoring", { 
      receivedType: event.data?.type,
      expectedType: "CS_SCAN_RESULT"
    });
    // #endregion
    return;
  }

  const result = event.data.payload;
  // #region agent log
  console.log("[DEBUG] Processing CS_SCAN_RESULT", { 
    hasPayload: !!result,
    payloadKeys: result ? Object.keys(result) : []
  });
  // #endregion
  renderResult(result);
});