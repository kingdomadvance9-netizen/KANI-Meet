import type { Metadata } from "next";
import React, { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { MediasoupProvider } from "@/providers/MediasoupProvider";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KANI MEET",
  description: "Video Calling App",
  icons: {
    icon: "/icons/KANILOGO-no-bg.png",
  },
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-dark-2`}>
        <MediasoupProvider>
          <main>
            {children}
            <Toaster />
          </main>
        </MediasoupProvider>
      </body>
    </html>
  );
};

export default RootLayout;
