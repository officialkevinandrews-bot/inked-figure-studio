export type AppPlatformId = "android" | "windows";

export interface AppDownloadEntry {
  id: AppPlatformId;
  name: string;
  subtitle: string;
  version: string;
  fileName: string;
  fileSizeLabel: string;
  sizeBytes: number;
  sha256: string;
  downloadUrl: string;
  requirements: string;
  installSteps: readonly string[];
  notes?: string;
}

export const APP_RELEASE_VERSION = "1.0.0";
export const APP_RELEASE_TAG = "v1.0.0";
export const APP_RELEASE_PAGE_URL =
  "https://github.com/officialkevinandrews-bot/inked-figure-studio/releases/tag/v1.0.0";

export const APP_DOWNLOADS: readonly AppDownloadEntry[] = [
  {
    id: "android",
    name: "Android App (.apk)",
    subtitle: "Signed Trusted Web Activity package for Android phones & tablets",
    version: APP_RELEASE_VERSION,
    fileName: "MangakaDesk-v1.0.0.apk",
    fileSizeLabel: "178 KB",
    sizeBytes: 182778,
    sha256: "51A5F54F371E1D4B36B92E1E0C349881AF7D82F09E92A47A71762A9EB9AE1649",
    downloadUrl:
      "https://github.com/officialkevinandrews-bot/inked-figure-studio/releases/download/v1.0.0/MangakaDesk-v1.0.0.apk",
    requirements: "Android 7.0 (API 24) or newer · Chrome installed",
    installSteps: [
      "Download MangakaDesk-v1.0.0.apk onto your Android phone or tablet.",
      "Tap the APK file and allow 'Install unknown apps' for your browser or file manager.",
      "Launch MangakaDesk and sign in with your invited Google or email account.",
    ],
  },
  {
    id: "windows",
    name: "Windows Desktop (.zip)",
    subtitle: "Portable desktop application for Windows 10 & Windows 11",
    version: APP_RELEASE_VERSION,
    fileName: "MangakaDesk-Windows-v1.0.0.zip",
    fileSizeLabel: "111.5 MB",
    sizeBytes: 116912443,
    sha256: "8ADA7503B5DB23ABA83E18059D93BBB59A40A463514245BCF2F26664A865AECC",
    downloadUrl:
      "https://github.com/officialkevinandrews-bot/inked-figure-studio/releases/download/v1.0.0/MangakaDesk-Windows-v1.0.0.zip",
    requirements: "Windows 10 / 11 (64-bit)",
    installSteps: [
      "Download MangakaDesk-Windows-v1.0.0.zip to your PC.",
      "Right-click the ZIP archive, choose Extract All…, and pick a destination folder.",
      "Double-click MangakaDesk.exe inside the extracted folder to launch the studio.",
    ],
    notes:
      "Packaged as a portable ZIP so Windows 11 Smart App Control lets the extracted desktop app run without an Authenticode installer warning.",
  },
] as const;

export interface MangakaDesktopBridge {
  platform?: string;
  version?: string;
}

export function getDesktopBridge(): MangakaDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { mangakaDesktop?: unknown }).mangakaDesktop;
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  return {
    platform: typeof record.platform === "string" ? record.platform : undefined,
    version: typeof record.version === "string" ? record.version : undefined,
  };
}

export function isWindowsDesktopApp(): boolean {
  return getDesktopBridge()?.platform === "windows";
}
