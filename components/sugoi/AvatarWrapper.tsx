"use client";

import dynamic from "next/dynamic";

const Avatar3D = dynamic(
  () => import("@/components/sugoi/Avatar3D").then((mod) => mod.Avatar3D),
  { ssr: false }
);

export function AvatarWrapper() {
  return <Avatar3D />;
}
