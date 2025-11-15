/**
 * Horalix Halo - Custom Title Bar
 *
 * Modern transparent title bar with custom window controls
 */

import React from 'react'
import { motion } from 'framer-motion'

export function TitleBar() {
  const handleMinimize = () => {
    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke('window:minimize')
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke('window:maximize')
    }
  }

  const handleClose = () => {
    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke('window:close')
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 h-12 z-[9999] flex items-center justify-between px-4 bg-black/20 backdrop-blur-md border-b border-white/10"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs">
          🎯
        </div>
        <span className="text-sm font-semibold text-white">Horalix Halo</span>
      </div>

      {/* Window Controls */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Minimize */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleMinimize}
          className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all group"
          title="Minimize"
        >
          <svg className="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </motion.button>

        {/* Maximize */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleMaximize}
          className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all group"
          title="Maximize"
        >
          <svg className="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </motion.button>

        {/* Close */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClose}
          className="w-10 h-10 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center transition-all group"
          title="Close"
        >
          <svg className="w-4 h-4 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}
