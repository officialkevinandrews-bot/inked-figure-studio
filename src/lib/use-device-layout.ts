import { useEffect, useState } from "react";

export type DeviceTier =
  | "desktop"
  | "tablet-landscape"
  | "tablet-portrait"
  | "phone-landscape"
  | "phone-portrait";

export interface DeviceLayoutInfo {
  width: number;
  height: number;
  tier: DeviceTier;
  orientation: "landscape" | "portrait";
  isTouch: boolean;
  isCompact: boolean;
  isPhone: boolean;
  isTablet: boolean;
  useBottomSheet: boolean;
  pinLeftByDefault: boolean;
  pinRightByDefault: boolean;
  showPagesBarPinned: boolean;
}

/** Pure viewport classifier shared across components and unit tests. */
export function classifyViewport(
  width: number,
  height: number,
  isTouch = false,
): DeviceLayoutInfo {
  const orientation: "landscape" | "portrait" = width >= height ? "landscape" : "portrait";
  let tier: DeviceTier;

  if (width >= 1200 && height >= 580) {
    tier = "desktop";
  } else if (orientation === "landscape" && height < 520) {
    tier = "phone-landscape";
  } else if (width < 700) {
    tier = orientation === "landscape" ? "phone-landscape" : "phone-portrait";
  } else if (orientation === "landscape" && width >= 900) {
    tier = "tablet-landscape";
  } else {
    tier = "tablet-portrait";
  }

  const isPhone = tier === "phone-portrait" || tier === "phone-landscape";
  const isTablet = tier === "tablet-portrait" || tier === "tablet-landscape";
  const isCompact = tier !== "desktop";

  return {
    width,
    height,
    tier,
    orientation,
    isTouch,
    isCompact,
    isPhone,
    isTablet,
    useBottomSheet: tier === "phone-portrait",
    pinLeftByDefault: tier === "desktop" || tier === "tablet-landscape",
    pinRightByDefault: tier === "desktop",
    showPagesBarPinned: tier === "desktop" || tier === "tablet-landscape",
  };
}

function readWindowLayout(): DeviceLayoutInfo {
  if (typeof window === "undefined") {
    return classifyViewport(1280, 800, false);
  }
  const coarse =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const isTouch = coarse || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
  return classifyViewport(window.innerWidth, window.innerHeight, isTouch);
}

/** Tracks viewport tier, orientation flips, and coarse-pointer state in real time. */
export function useDeviceLayout(): DeviceLayoutInfo {
  const [info, setInfo] = useState<DeviceLayoutInfo>(() => readWindowLayout());

  useEffect(() => {
    const update = () => {
      const next = readWindowLayout();
      setInfo((cur) =>
        cur.width === next.width &&
        cur.height === next.height &&
        cur.tier === next.tier &&
        cur.isTouch === next.isTouch
          ? cur
          : next,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return info;
}
