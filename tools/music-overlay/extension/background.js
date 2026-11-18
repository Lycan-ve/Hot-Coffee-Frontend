chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "HOT_COFFEE_MUSIC_STATE" || !message.payload) return;
  const senderUrl = sender.url || "";
  if (!senderUrl.startsWith("https://www.youtube.com/") &&
      !senderUrl.startsWith("https://music.youtube.com/")) return;

  void chrome.storage.local.get(["musicBridgeToken"]).then(({ musicBridgeToken }) => {
    if (!musicBridgeToken) return;

    return fetch("http://127.0.0.1:4317/api/now-playing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + musicBridgeToken
      },
      body: JSON.stringify(message.payload),
      cache: "no-store"
    });
  }).catch(() => {
    // El puente local puede estar apagado; no interrumpimos YouTube.
  });
});
