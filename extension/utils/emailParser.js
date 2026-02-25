function extractEmailData() {
  return {
    sender: document.querySelector(".sender")?.innerText || "",
    subject: document.querySelector(".subject")?.innerText || "",
    body: document.querySelector(".body")?.innerText || "",
    links: Array.from(document.querySelectorAll("a"))
      .map(a => a.href)
      .filter(h => h.startsWith("http"))
  };
}