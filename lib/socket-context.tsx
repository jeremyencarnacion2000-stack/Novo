'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { data: session } = useSession()

  // Temporarily disabled socket initialization until server is deployed
  // useEffect(() => {
  //   const socketInstance = io(window.location.origin, {
  //     transports: ['polling']
  //   })

  //   socketInstance.on('connect', () => {
  //     console.log('Socket connected')
  //     setIsConnected(true)
  //     if (session?.user?.id) {
  //       socketInstance.emit('authenticate', session.user.id)
  //     }
  //   })

  //   socketInstance.on('connect_error', (error) => {
  //     console.error('Socket connection error:', error)
  //   })

  //   socketInstance.on('disconnect', () => {
  //     console.log('Socket disconnected')
  //     setIsConnected(false)
  //   })

  //   setSocket(socketInstance)

  //   return () => {
  //     socketInstance.disconnect()
  //   }
  // }, [session?.user?.id])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}