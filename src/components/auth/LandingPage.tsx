import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Box,
  CheckCircle2,
  Cloud,
  Download,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Monitor,
  PenTool,
  Scissors,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Upload,
  X,
} from "lucide-react";

export interface LandingPageProps {
  firebaseConfigured: boolean;
  authBusy: boolean;
  authError: string | null;
  authInfo: string | null;
  onSignInWithGoogle: () => Promise<void>;
  onSignInWithEmail: (email: string, password: string) => Promise<void>;
  onRegisterWithEmail: (email: string, password: string) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  onClearAuthMessages: () => void;
}

interface GalleryShot {
  id: string;
  label: string;
  title: string;
  caption: string;
  src: string;
  alt: string;
  badge: string;
}

const GALLERY_SHOTS: GalleryShot[] = [
  {
    id: "panels",
    label: "Manga Panels & FX",
    title: "Dynamic Panels, Speech Balloons, Screentones & SFX",
    caption:
      "Build classic B5/A4 pages or high-energy diagonal shonen layouts. Carve panels with Knife Cut, drag shared gutters, layer procedural manga scenery, add curved/dual speech tails, custom SFX stamps, and manga right-to-left reading numbers.",
    src: "/landing/hero-manga-panels.png",
    alt: "MangakaDesk workspace showing slanted manga panels, speech balloons, SFX stamps, speed lines, and panel inspector",
    badge: "Primary Studio",
  },
  {
    id: "importer",
    label: "Grid Layout Importer",
    title: "Turn Any Clean Grid Image Into Editable Panels",
    caption:
      "Upload a layout template image and MangakaDesk automatically detects every rectangle and diagonal cut, numbers panels in manga right-to-left order, and lets you apply to the current page, start a new page, or save to Custom Templates.",
    src: "/landing/feature-grid-importer.png",
    alt: "MangakaDesk grid layout importer detecting diagonal manga panels automatically",
    badge: "Auto-Detect",
  },
  {
    id: "webtoon",
    label: "Webtoon & 9:16 Reader",
    title: "Switch Between Print Pages & Vertical Webtoon Scroll",
    caption:
      "One click toggles between traditional Print Page spreads and infinite vertical Webtoon Scroll—complete with a live 9:16 mobile phone reader preview right beside your canvas.",
    src: "/landing/feature-webtoon-reader.png",
    alt: "MangakaDesk in Webtoon Scroll mode with the live 9:16 mobile phone reader preview",
    badge: "Dual Format",
  },
  {
    id: "export",
    label: "Chapter & PDF Export",
    title: "Organize Full Series & Export Ready for Print or Web",
    caption:
      "Keep all your manga series, chapters, and pages structured in one library. Export individual high-resolution PNG/JPEG pages, multi-page PDF chapters up to 300 DPI print scale, or sliced Webtoon strips.",
    src: "/landing/feature-export-pdf.png",
    alt: "MangakaDesk Export Chapter dialog showing Print PNG, JPEG, PDF, and scale options",
    badge: "Print & Web Ready",
  },
];

const FEATURE_CARDS = [
  {
    icon: Scissors,
    title: "Knife Cut, Slants & Gutter Control",
    desc: "Slice panels at any angle (-90° to +90°), drag shared dividers without gaps, reshape corners freely, create floating inset frames, or draw new panels anywhere on the page.",
  },
  {
    icon: Upload,
    title: "Upload Your Own Grid Templates",
    desc: "Drop in clean black-and-white template sheets and convert them into real editable manga panels in seconds—complete with right-to-left reading numbering and reusable saving.",
  },
  {
    icon: Layers,
    title: "Balloons, SFX, Tones & Photo Inking",
    desc: "14 balloon styles with curved/dual tails, katakana & custom SFX stamps, emotion marks, speed lines, procedural manga backgrounds, screentones, and a Photo-to-Manga filter.",
  },
  {
    icon: BookOpen,
    title: "Print Manga + Infinite Webtoon Mode",
    desc: "Compose print-format chapters (Manga B5, A4, US Comic, 4-Koma) or flip straight into vertical Webtoon Scroll with a real-time 9:16 phone reader preview.",
  },
  {
    icon: PenTool,
    title: "Straight-Line Pen & Layer Control",
    desc: "Draw crisp panel framing accents or cross-page ink rules (solid, dashed, dotted, double, arrows) that automatically lock to panel bounds and scale when panels move.",
  },
  {
    icon: Cloud,
    title: "Series Library, Cloud Sync & Backup",
    desc: "Save multiple manga series and chapters offline-first in your browser, sync safely across signed-in devices, and download full `.json` account backups anytime.",
  },
] as const;

const PLATFORM_CARDS = [
  {
    icon: Sparkles,
    name: "Web Studio",
    status: "Private Beta · Live Now",
    statusTone: "bg-emerald-600 text-white",
    desc: "Use MangakaDesk directly in modern desktop, tablet, and mobile browsers with invite-only creator sign-in.",
  },
  {
    icon: Smartphone,
    name: "iPhone & iPad",
    status: "Apple App Store · Coming Soon",
    statusTone: "bg-foreground text-background",
    desc: "Native iOS & iPadOS experience engineered for Apple Pencil touch layout, portable lettering, and cloud-synced chapters.",
  },
  {
    icon: Tablet,
    name: "Android Devices",
    status: "Google Play · Coming Soon",
    statusTone: "bg-foreground text-background",
    desc: "Storyboard chapters, test custom grids, and preview 9:16 webtoons smoothly across Android phones and tablets.",
  },
  {
    icon: Monitor,
    name: "Windows Desktop",
    status: "Windows App · Coming Soon",
    statusTone: "bg-foreground text-background",
    desc: "Dedicated Windows desktop release built for multi-chapter production, keyboard power shortcuts, and local-first speed.",
  },
] as const;

export function LandingPage({
  firebaseConfigured,
  authBusy,
  authError,
  authInfo,
  onSignInWithGoogle,
  onSignInWithEmail,
  onRegisterWithEmail,
  onSendPasswordReset,
  onClearAuthMessages,
}: LandingPageProps) {
  const [activeShotId, setActiveShotId] = useState<string>(GALLERY_SHOTS[0].id);
  const [signInOpen, setSignInOpen] = useState<boolean>(Boolean(authError || authInfo));
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  useEffect(() => {
    if (authError || authInfo) {
      setSignInOpen(true);
    }
  }, [authError, authInfo]);

  const activeShot = GALLERY_SHOTS.find((s) => s.id === activeShotId) ?? GALLERY_SHOTS[0];

  const openSignIn = () => {
    onClearAuthMessages();
    setSignInOpen(true);
  };

  return (
    <div className="min-h-dvh w-full bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-foreground bg-card/95 backdrop-blur-xs safe-pt">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-display text-lg sm:text-xl tracking-wide truncate">
              MANGAKA<span className="text-primary">DESK</span>
            </h1>
            <span className="hidden xs:inline-block rounded-xs border border-foreground bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
              PRIVATE BETA
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <a href="#gallery" className="hover:text-foreground transition-colors">
              Screenshots
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#upcoming-3d" className="hover:text-foreground transition-colors">
              In Development
            </a>
            <a href="#platforms" className="hover:text-foreground transition-colors">
              Platforms
            </a>
          </nav>

          <button
            type="button"
            data-testid="landing-signin-btn"
            onClick={openSignIn}
            className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5 shrink-0"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Creator Sign In</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b-2 border-foreground bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_1.15fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-xs border-2 border-foreground bg-background px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-ink">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>MANGA &amp; WEBTOON PAGE CREATION STUDIO</span>
            </div>

            <h2 className="font-display text-3xl leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.75rem]">
              CRAFT ENTIRE MANGA &amp; WEBTOON CHAPTERS AT{" "}
              <span className="text-primary underline decoration-4 underline-offset-4">
                ONE DESK.
              </span>
            </h2>

            <p className="max-w-xl text-sm sm:text-base leading-relaxed text-muted-foreground">
              <strong className="text-foreground">MangakaDesk</strong> is built from the ground up
              for comic creators—sketch diagonal panel grids, convert your own layout images into
              editable manga frames, letter speech balloons &amp; SFX, apply halftone screentones,
              and preview mobile Webtoon scroll side-by-side.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={openSignIn}
                className="flex items-center gap-2 rounded-sm border-2 border-foreground bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5"
              >
                <span>Creator Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#gallery"
                className="flex items-center gap-2 rounded-sm border-2 border-foreground bg-background px-4 py-2.5 text-sm font-bold hover:bg-accent transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-primary" />
                <span>Explore Live Screenshots</span>
              </a>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                Currently invite-only while in private development. Planned public releases on{" "}
                <strong className="text-foreground">Google Play</strong>,{" "}
                <strong className="text-foreground">iPhone / iPad</strong>, and{" "}
                <strong className="text-foreground">Windows</strong>.
              </span>
            </p>
          </div>

          {/* Real Hero Screenshot Card */}
          <div className="rounded-sm border-2 border-foreground bg-background p-2 sm:p-3 shadow-ink">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-foreground bg-primary" />
                <span className="h-2.5 w-2.5 rounded-full border border-foreground bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full border border-foreground bg-emerald-500" />
                <span className="ml-1 font-mono font-semibold text-muted-foreground">
                  MangakaDesk — Live Workspace
                </span>
              </div>
              <span className="rounded-xs bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
                NO MOCKUPS · ACTUAL UI
              </span>
            </div>
            <img
              src="/landing/hero-manga-panels.png"
              alt="MangakaDesk Manga Panels Workspace"
              className="w-full rounded-xs border border-border object-cover"
            />
          </div>
        </div>
      </section>

      {/* Interactive App Screenshot Gallery */}
      <section id="gallery" className="border-b-2 border-foreground py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Inside MangakaDesk
              </span>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl tracking-wide">
                REAL SCREENSHOTS FROM THE STUDIO
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {GALLERY_SHOTS.map((shot) => {
                const active = shot.id === activeShot.id;
                return (
                  <button
                    key={shot.id}
                    type="button"
                    data-testid={`gallery-tab-${shot.id}`}
                    onClick={() => setActiveShotId(shot.id)}
                    className={`rounded-sm border-2 px-3 py-1.5 text-xs font-bold transition-all ${
                      active
                        ? "border-foreground bg-foreground text-background shadow-ink"
                        : "border-border bg-card text-foreground hover:border-foreground"
                    }`}
                  >
                    {shot.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 rounded-sm border-2 border-foreground bg-card p-3 sm:p-5 shadow-ink lg:grid-cols-[1.5fr_0.9fr] lg:items-center">
            <div className="overflow-hidden rounded-xs border-2 border-foreground bg-muted">
              <img
                src={activeShot.src}
                alt={activeShot.alt}
                className="w-full object-contain"
              />
            </div>

            <div className="space-y-4 p-1 sm:p-2">
              <span className="inline-block rounded-xs border border-foreground bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {activeShot.badge}
              </span>
              <h3 className="font-display text-xl sm:text-2xl leading-snug">
                {activeShot.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                {activeShot.caption}
              </p>

              <ul className="space-y-2 border-t border-border pt-3 text-xs">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>Manga right-to-left &amp; comic left-to-right workflows supported</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>Non-destructive panel moves scale artwork, balloons &amp; SFX together</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>Works smoothly on Desktop, Tablet, and Mobile viewports</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Complete Feature Bento */}
      <section id="features" className="border-b-2 border-foreground bg-muted/30 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Full Creator Toolkit
            </span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl tracking-wide">
              EVERYTHING YOU NEED FROM THUMBNAIL TO FINISHED CHAPTER
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="flex flex-col gap-2.5 rounded-sm border-2 border-foreground bg-card p-5 shadow-ink"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-sm border-2 border-foreground bg-primary/15 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="font-display text-base tracking-wide">{card.title}</h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    {card.desc}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* In Development Feature Callout: 3D Character & Pose Studio (NO IMAGES per owner instruction) */}
      <section id="upcoming-3d" className="border-b-2 border-foreground py-12 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-sm border-2 border-foreground bg-card p-6 sm:p-8 shadow-ink">
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-xs border-2 border-foreground bg-amber-300 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-black">
                <Box className="h-3.5 w-3.5" />
                Coming Soon · Actively Working On It
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Future Studio Expansion
              </span>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.4fr_0.9fr] md:items-center">
              <div className="space-y-3">
                <h2 className="font-display text-2xl sm:text-3xl tracking-wide">
                  INTEGRATED 3D CHARACTER CREATOR &amp; POSE STUDIO
                </h2>
                <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  Right alongside our 2D Manga Panel Studio, we are hard at work building a built-in
                  3D Character &amp; Pose engine so creators can customize characters, set expressive
                  action poses and camera perspectives, stage multi-character scenes, and snap
                  cel-shaded references straight into any panel—without leaving MangakaDesk.
                </p>
                <p className="text-xs font-medium text-foreground/90">
                  This feature is currently in early hands-on development and being refined before
                  we showcase it publicly.
                </p>
              </div>

              <div className="rounded-sm border-2 border-dashed border-foreground/60 bg-muted/40 p-4 space-y-2 text-xs">
                <div className="font-bold uppercase tracking-wide text-primary">
                  What We&apos;re Building Next
                </div>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li>• Custom character body, wardrobe &amp; facial expression setup</li>
                  <li>• Interactive limb posing, hand presets &amp; multi-actor staging</li>
                  <li>• Cel-shaded ink rendering &amp; angle presets ready for panels</li>
                  <li>• One-click re-posing directly from an existing manga frame</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms Roadmap: Web Beta Now + Coming Soon to App Store, Google Play & Windows */}
      <section id="platforms" className="border-b-2 border-foreground bg-muted/30 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Cross-Platform Vision
              </span>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl tracking-wide">
                BUILT FOR WEB FIRST — COMING TO MOBILE &amp; DESKTOP STORES
              </h2>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              Full cloud account sync and offline-safe local editing are already engineered so your
              series can travel seamlessly between devices once store releases launch.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_CARDS.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.name}
                  className="flex flex-col justify-between gap-3 rounded-sm border-2 border-foreground bg-card p-4 shadow-ink"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <span
                        className={`rounded-xs px-2 py-0.5 text-[10px] font-bold uppercase ${p.statusTone}`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <h3 className="font-display text-base">{p.name}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="bg-card py-10 safe-pb">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="space-y-1">
            <div className="font-display text-lg tracking-wide">
              MANGAKA<span className="text-primary">DESK</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Private Invite Beta — Sign in with an authorized creator account to open the studio.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="#gallery"
              className="rounded-sm border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-foreground"
            >
              View Screenshots
            </a>
            <button
              type="button"
              onClick={openSignIn}
              className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-ink hover:-translate-y-0.5 transition-transform"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Creator Sign In</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Sign-In Modal Overlay (Gate for Invited Users) */}
      {signInOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !authBusy) {
              setSignInOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to MangakaDesk"
            data-testid="signin-modal"
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-sm border-2 border-foreground bg-card p-6 shadow-2xl"
          >
            <button
              type="button"
              disabled={authBusy}
              onClick={() => setSignInOpen(false)}
              aria-label="Close sign-in modal"
              className="absolute right-3 top-3 rounded-sm border border-border p-1 hover:border-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 text-center">
              <h2 className="font-display text-xl sm:text-2xl tracking-wide">
                MANGAKA<span className="text-primary">DESK</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Invite-Only Studio Sign In
              </p>
            </div>

            {!firebaseConfigured ? (
              <div
                data-testid="firebase-unconfigured-notice"
                className="rounded-sm border-2 border-amber-600/70 bg-amber-50 p-3.5 text-xs text-amber-950"
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>Account login pending Firebase project config</span>
                </div>
                <p className="mt-1 leading-relaxed text-amber-900/90">
                  Link a Firebase project (`VITE_FIREBASE_*`) with Google Sign-In, Email/Password auth, Firestore, and Security Rules to enable private account access.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="google-signin-btn"
                  disabled={authBusy}
                  onClick={() => void onSignInWithGoogle()}
                  className="flex w-full items-center justify-center gap-2.5 rounded-sm border-2 border-foreground bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {authBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>{authBusy ? "Connecting…" : "Continue with Google"}</span>
                </button>

                <div className="my-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>or sign in with email &amp; password</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="mb-3 grid grid-cols-2 rounded-sm border border-border bg-muted/40 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode("signin");
                      onClearAuthMessages();
                    }}
                    className={`rounded-xs py-1.5 transition-colors ${
                      emailMode === "signin"
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode("signup");
                      onClearAuthMessages();
                    }}
                    className={`rounded-xs py-1.5 transition-colors ${
                      emailMode === "signup"
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground"
                    }`}
                  >
                    Create Password
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (emailMode === "signin") {
                      void onSignInWithEmail(emailInput, passwordInput);
                    } else {
                      void onRegisterWithEmail(emailInput, passwordInput);
                    }
                  }}
                  className="space-y-2.5 text-xs"
                >
                  <label className="block">
                    <span className="mb-1 block font-semibold">Email Address</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full rounded-sm border border-input bg-background px-2.5 py-2 text-xs"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block font-semibold">Password</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete={emailMode === "signin" ? "current-password" : "new-password"}
                      placeholder="At least 6 characters"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full rounded-sm border border-input bg-background px-2.5 py-2 text-xs"
                    />
                  </label>

                  <button
                    type="submit"
                    data-testid="email-auth-submit-btn"
                    disabled={authBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-foreground bg-card px-4 py-2 font-bold hover:bg-accent disabled:opacity-60"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>
                      {emailMode === "signin" ? "Sign In with Email" : "Create Account with Email"}
                    </span>
                  </button>

                  {emailMode === "signin" && (
                    <div className="text-right">
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={() => void onSendPasswordReset(emailInput)}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}

            {authInfo && (
              <div className="mt-3 rounded-sm border border-emerald-600/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                {authInfo}
              </div>
            )}

            {authError && (
              <div
                role="alert"
                className="mt-3 rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {authError}
              </div>
            )}

            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Only invited allowlisted accounts can unlock the workspace.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
