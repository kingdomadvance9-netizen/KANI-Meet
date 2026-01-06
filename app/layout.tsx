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
  title: "Grace Meet",
  description: "Video Calling App",
  icons: {
    icon: "/icons/white-logo.png",
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
            logoImageUrl: "/icons/Gm-White-logo.png",
          },
          variables: {
            colorText: "#fff",
            colorPrimary: "#b93140",
            colorBackground: "#1C1F2E",
            colorInputBackground: "#252A41",
            colorInputText: "#fff",
          },
        }}
        localization={{
          ...enUS,
          signIn: {
            ...enUS.signIn,
            start: {
              ...(enUS.signIn?.start ?? {}),
              title: "Grace Meet",
            },
          },
          signUp: {
            ...enUS.signUp,
            start: {
              ...(enUS.signUp?.start ?? {}),
              title: "Grace Meet",
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
