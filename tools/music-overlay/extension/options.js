const form = document.getElementById("settings-form");
const tokenInput = document.getElementById("bridge-token");
const status = document.getElementById("status");

chrome.storage.local.get(["musicBridgeToken"]).then(({ musicBridgeToken }) => {
  tokenInput.value = musicBridgeToken || "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) {
    status.textContent = "Introduce el token que mostró el servidor local.";
    return;
  }
  await chrome.storage.local.set({ musicBridgeToken: token });
  status.textContent = "Conexión guardada. Ya puedes reproducir música en YouTube.";
});
