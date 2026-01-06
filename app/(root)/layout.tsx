import type { Metadata } from "next";
import React, { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { MediasoupProvider } from "@/providers/MediasoupProvider";
import "../globals.css"; 

export const metadata: Metadata = {
  title: "Grace Meet",
  description: "Video Calling App",
  icons: {
    icon: "/icons/white-logo.png",
  },
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en">
      <body className="bg-dark-2">
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