import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { enUS } from "@clerk/localizations";
import TestSocket from "@/components/TestSocket";
import { MediasoupProvider } from "@/contexts/MediasoupContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KANI MEET",
  description: "Video Calling App",
  icons: {
    icon: "/icons/KANILOGO-no-bg.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <ClerkProvider
        appearance={{
          layout: {
            socialButtonsVariant: "iconButton",
            logoImageUrl: "/icons/KANILOGO-no-bg.png",
          },
          variables: {
            /* Text */
            colorText: "#FFFFFF",

            /* Primary action (buttons, focus, links highlight) */
            colorPrimary: "#C9A24D", // KANI Gold

            /* Backgrounds */
            colorBackground: "#0B0B0B", // main background
            colorInputBackground: "#1A1A1A", // inputs / fields
            colorModalBackdrop: "rgba(0,0,0,0.8)",

            /* Inputs */
            colorInputText: "#FFFFFF",

            /* Muted / secondary text */
            colorTextSecondary: "#BDBDBD",

            /* Danger */
            colorDanger: "#E74C3C",
          },
        }}
        localization={{
          ...enUS,
          signIn: {
            ...enUS.signIn,
            start: {
              ...(enUS.signIn?.start ?? {}),
              title: "KANI MEET",
            },
          },
          signUp: {
            ...enUS.signUp,
            start: {
              ...(enUS.signUp?.start ?? {}),
              title: "KANI MEET",
            },
          },
        }}
      >
        <body className={`${inter.className} bg-dark-2`}>
          <MediasoupProvider>
            <TestSocket />
            {children}
            <Toaster />
          </MediasoupProvider>
        </body>
      </ClerkProvider>
    </html>
  );
}
