"use client"

import { useEffect } from "react"
import { getSocket } from "@/lib/socket"

export default function TestSocket() {
  useEffect(() => {
    const socket = getSocket()

    socket.connect()

    socket.on("connect", () => {
      console.log("✅ socket connected:", socket.id)
    })

    socket.on("disconnect", () => {
      console.log("❌ socket disconnected")
    })

    return () => {
      socket.off("connect")
      socket.off("disconnect")
      socket.disconnect()
    }
  }, [])

  return null
}
