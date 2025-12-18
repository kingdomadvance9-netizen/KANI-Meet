"use client"

import { useEffect } from "react"
import { getSocket } from "@/lib/socket"

const ROOM_ID = "test-room"

export default function TestSocket() {
  useEffect(() => {
    const socket = getSocket()
    socket.connect()

    socket.on("connect", () => {
      console.log("✅ socket connected:", socket.id)
      socket.emit("join-room", ROOM_ID)

     
    })

    socket.on("receive-message", data => {
      console.log("📨 received message:", data)
    })

    return () => {
      socket.emit("leave-room", ROOM_ID)
      socket.disconnect()
    }
  }, [])

  return null
}
