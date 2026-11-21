const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("mangakaDesktop", {
  platform: "windows",
  version: "1.0.0",
});
