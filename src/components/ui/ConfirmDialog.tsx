/**
 * Horalix Halo - Modern Confirmation Dialog
 *
 * Beautiful styled confirmation dialog to replace browser alerts
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'info' | 'warning' | 'danger' | 'success'
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info',
}: ConfirmDialogProps) {
  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          bg: 'from-red-500/20 to-red-600/20',
          border: 'border-red-500/30',
          button: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
        }
      case 'warning':
        return {
          bg: 'from-yellow-500/20 to-orange-600/20',
          border: 'border-yellow-500/30',
          button: 'from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700',
        }
      case 'success':
        return {
          bg: 'from-green-500/20 to-emerald-600/20',
          border: 'border-green-500/30',
          button: 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
        }
      default:
        return {
          bg: 'from-purple-500/20 to-pink-600/20',
          border: 'border-purple-500/30',
          button: 'from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700',
        }
    }
  }

  const colors = getColors()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            <div className={`p-6 bg-gradient-to-br ${colors.bg} backdrop-blur-xl border ${colors.border} rounded-2xl shadow-2xl`}>
              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-3">{title}</h3>

              {/* Message */}
              <p className="text-gray-300 mb-6 whitespace-pre-line">{message}</p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-4 py-2.5 bg-gradient-to-r ${colors.button} text-white rounded-lg font-medium transition-all shadow-lg`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
