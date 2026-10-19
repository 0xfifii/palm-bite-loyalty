"use client";

import { useEffect, useRef, useState } from "react";

export type CameraStatus = "starting" | "scanning" | "denied" | "unavailable" | "error";

type Props = {
  /** Called once per decoded value. Return true to stop the camera. */
  onDecode: (text: string) => boolean | void;
  onStatus?: (status: CameraStatus) => void;
  className?: string;
};

/**
 * Live camera preview with continuous QR decoding (ZXing). Uses the rear
 * camera when available. Never decides anything itself: decoded text is
 * passed up and verified by the server.
 */
export function QrCamera({ onDecode, onStatus, className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const onStatusRef = useRef(onStatus);
  const [status, setStatus] = useState<CameraStatus>("starting");

  useEffect(() => {
    onDecodeRef.current = onDecode;
    onStatusRef.current = onStatus;
  });

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;
    const report = (s: CameraStatus) => {
      if (stopped) return;
      setStatus(s);
      onStatusRef.current?.(s);
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        report("unavailable");
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 800 });
        if (stopped || !videoRef.current) return;
        let last = "";
        controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result || stopped) return;
            const text = result.getText();
            if (text === last) return;
            last = text;
            const stop = onDecodeRef.current(text);
            if (stop) {
              stopped = true;
              controls?.stop();
            }
          },
        );
        if (stopped) {
          controls.stop();
          return;
        }
        report("scanning");
      } catch (e) {
        const name = (e as { name?: string })?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") report("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") report("unavailable");
        else report("error");
      }
    }

    start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden bg-olive-night ${className}`}>
      <video
        ref={videoRef}
        className={`h-full w-full object-cover transition-opacity duration-300 ${status === "scanning" ? "opacity-100" : "opacity-0"}`}
        muted
        playsInline
        aria-label="Camera preview"
      />
    </div>
  );
}
