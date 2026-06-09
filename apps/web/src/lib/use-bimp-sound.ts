"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Synthesized "bimp" chime via Web Audio — two quick high-pitched sine pings
 * with a short envelope. Used by the task-alert watcher so we don't have to
 * bundle/ship an audio asset.
 *
 * Browsers block AudioContext until a user gesture, so we lazily create the
 * context on the first call and resume it if it's suspended. If audio is
 * blocked or unavailable the call is a silent no-op — never throws.
 */
export function useBimpSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => undefined);
      }
      ctxRef.current = null;
    };
  }, []);

  return useCallback(async (repeats = 2) => {
    if (typeof window === "undefined") return;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => undefined);
      }

      const start = ctx.currentTime + 0.02;
      const pingDur = 0.14;
      const gap = 0.12;
      const cycle = pingDur + gap;
      const safeRepeats = Math.max(1, Math.min(repeats, 6));

      for (let i = 0; i < safeRepeats; i++) {
        const t0 = start + i * cycle;
        // Two-tone "bimp": quick high note then a touch lower.
        playPing(ctx, t0, 1320, pingDur * 0.55);
        playPing(ctx, t0 + pingDur * 0.45, 880, pingDur * 0.55);
      }
    } catch {
      // best-effort — never break the UI for a missed chime
    }
  }, []);
}

function playPing(ctx: AudioContext, t0: number, freq: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);

  // Short ASR envelope to avoid clicks.
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.18, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
