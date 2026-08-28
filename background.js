browser.runtime.onMessage.addListener((message) => {
  if (message.type !== "download") {
    return;
  }

  return browser.downloads.download({
    url: message.url,
    filename: message.filename,
    saveAs: true
  });
});
