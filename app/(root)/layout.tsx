import type { Metadata } from "next";
import StreamVideoProvider from '@/providers/StreamClientProvider'
import React, { ReactNode } from 'react'
import { Toaster } from "@/components/ui/sonner";


export const metadata: Metadata = {
  title: "Grace Meet",
  description: "Video Calling App",
  icons: {
    icon: '/icons/white-logo.png'
  }
};

const RootLayout = ({children}: {children: ReactNode}) => {
  return (
    <main>
    <StreamVideoProvider>
    {children}
    <Toaster />
    </StreamVideoProvider>
    </main>
  )
}

export default RootLayout