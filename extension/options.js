const portalEl = document.getElementById("portalUrl");
const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(["portalUrl", "token"], (cfg) => {
  portalEl.value = cfg.portalUrl || "";
  tokenEl.value = cfg.token || "";
});

document.getElementById("save").addEventListener("click", () => {
  const portalUrl = portalEl.value.trim().replace(/\/+$/, "");
  const token = tokenEl.value.trim();
  chrome.storage.sync.set({ portalUrl, token }, () => {
    statusEl.hidden = false;
    setTimeout(() => (statusEl.hidden = true), 2000);
  });
});
