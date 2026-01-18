import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import React, { ReactNode } from "react";


export const metadata: Metadata = {
  title: "KANI MEET",
  description: "Video Calling App",
  icons: {
    icon: '/icons/KANILOGO-no-bg.png'
  }
};

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative">
      {/* Navbar */}
      <Navbar/>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar/>

        {/* Page Content */}
        <section className="flex min-h-screen flex-1 flex-col px-6 pb-6 pt-0 md:pt-28 max-md:pb-14 sm:px-14">
        <div className='w-full'>
        {children}
        </div>
          
        </section>
      </div>
    </main>
  );
}
