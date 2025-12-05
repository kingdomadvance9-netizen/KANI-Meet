// app/root/layout.tsx
import type { Metadata } from "next";
import StreamVideoProvider from '@/providers/StreamClientProvider'
import MeetingRoomWrapper from "@/components/MeetingRoomWrapper"; // component above that uses useWakeLock + audio element
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
    <MeetingRoomWrapper>
    {children}
    <Toaster />
    </MeetingRoomWrapper>
    </StreamVideoProvider>
    </main>
  )
}

export default RootLayout