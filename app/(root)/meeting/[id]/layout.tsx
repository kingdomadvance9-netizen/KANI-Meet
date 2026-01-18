// app/root/meeting/[id]/layout.tsx
import type { Metadata } from "next";
import React, { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "KANI MEET",
  description: "Video Calling App",
  icons: {
    icon: "/icons/KANILOGO-no-bg.png",
  },
};

const MeetingLayout = ({ children }: { children: ReactNode }) => {
  return (
    <main>
      {children}
      <Toaster />
    </main>
  );
};

export default MeetingLayout;