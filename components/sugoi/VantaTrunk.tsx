"use client";

import { useEffect, useRef, useState } from "react";

interface VantaTrunkProps {
  theme: "light" | "dark";
  accentColor: string; // e.g. "#d4a017"
  className?: string;
}

export function VantaTrunk({ theme, accentColor, className }: VantaTrunkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vantaRef = useRef<any>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  // Convert hex color (e.g. "#d4a017") to numeric hex (e.g. 0xd4a017)
  const parseHexColor = (colorStr: string): number => {
    try {
      const cleanHex = colorStr.replace("#", "");
      return parseInt(cleanHex, 16);
    } catch (e) {
      return 0xd4a017; // fallback honey-gold
    }
  };

  // 1. Dynamic Script Loader
  useEffect(() => {
    if (typeof window === "undefined") return;

    let p5Script: HTMLScriptElement | null = null;
    let vantaScript: HTMLScriptElement | null = null;

    const loadScripts = async () => {
      // Check if p5 is already loaded
      if (!(window as any).p5) {
        p5Script = document.createElement("script");
        p5Script.src = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";
        p5Script.async = true;
        p5Script.id = "p5-cdn-script";
        document.body.appendChild(p5Script);
        await new Promise((resolve) => {
          if (p5Script) p5Script.onload = resolve;
        });
      }

      // Check if VANTA TRUNK is already loaded
      if (!(window as any).VANTA || !(window as any).VANTA.TRUNK) {
        vantaScript = document.createElement("script");
        vantaScript.src = "https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.trunk.min.js";
        vantaScript.async = true;
        vantaScript.id = "vanta-trunk-cdn-script";
        document.body.appendChild(vantaScript);
        await new Promise((resolve) => {
          if (vantaScript) vantaScript.onload = resolve;
        });
      }

      setScriptsLoaded(true);
    };

    loadScripts();

    return () => {
      // We don't clean up script tags on unmount to keep them cached for re-mounts
    };
  }, []);

  // 2. Initialize and Update Vanta.Trunk
  useEffect(() => {
    if (!scriptsLoaded || !containerRef.current) return;
    if (typeof window === "undefined") return;

    const VANTA = (window as any).VANTA;
    if (!VANTA || !VANTA.TRUNK) return;

    const p5 = (window as any).p5;
    if (p5 && p5.prototype && !p5.prototype.background.isOverridden) {
      p5.prototype.background = function (this: any) {
        this.clear();
      };
      p5.prototype.background.isOverridden = true;
    }

    // Destroy existing instance
    if (vantaRef.current) {
      vantaRef.current.destroy();
      vantaRef.current = null;
    }

    const bgHex = theme === "dark" ? 0x09090b : 0xfdfbf7;
    const lineHex = parseHexColor(accentColor);

    try {
      vantaRef.current = VANTA.TRUNK({
        el: containerRef.current,
        p5: (window as any).p5,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 110.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: lineHex,
        backgroundColor: bgHex,
        backgroundAlpha: 0.0,
        spacing: 1.5,
        chaos: 2.0,
      });

      // Clear any background style Vanta or p5 set on the container to ensure absolute transparency
      if (containerRef.current) {
        containerRef.current.style.background = "transparent";
        containerRef.current.style.backgroundColor = "transparent";
        const canvas = containerRef.current.querySelector("canvas");
        if (canvas) {
          canvas.style.background = "transparent";
          canvas.style.backgroundColor = "transparent";
        }
      }
    } catch (err) {
      console.error("Vanta.Trunk initialization error:", err);
    }

    return () => {
      if (vantaRef.current) {
        vantaRef.current.destroy();
        vantaRef.current = null;
      }
    };
  }, [scriptsLoaded, theme, accentColor]);

  return (
    <div
      ref={containerRef}
      className={`vanta-trunk-container overflow-hidden ${className || "w-full h-full rounded-2xl shadow-inner border border-taupe/15 dark:border-taupe/30"}`}
      style={{
        minHeight: "110px"
      }}
    />
  );
}

