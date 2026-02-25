console.log("✅ CampusShield panel loaded");

window.addEventListener("message", (event) => {
  if (event.data?.type !== "CS_SCAN_RESULT") return;

  const r = event.data.payload;

  document.getElementById("risk").innerText = r.risk_level;
  document.getElementById("score").innerText =
    Math.round(r.confidence_score * 100) + "%";

  const list = document.getElementById("reasons");
  list.innerHTML = "";
  (r.explanations || []).forEach(e => {
    const li = document.createElement("li");
    li.textContent = e;
    list.appendChild(li);
  });
});