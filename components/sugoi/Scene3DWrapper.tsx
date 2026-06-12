"use client";

import dynamic from "next/dynamic";

const Scene3DBackground = dynamic(
  () => import("@/components/sugoi/Scene3DBackground").then((mod) => mod.Scene3DBackground),
  { ssr: false }
);

export function Scene3DWrapper() {
  return <Scene3DBackground />;
}
