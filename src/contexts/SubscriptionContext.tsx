/**
 * Horalix Halo - Subscription Context
 *
 * Manages user subscription state, feature access, and usage limits.
 * Provides centralized subscription data to all components.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { PlanId, PlanConfig } from "../../shared/plans"
import { PLANS } from "../../shared/plans"
import { useAuth } from "./AuthContext"
import { api } from "@/lib/api"
import { createLogger } from "@/lib/logger"

const logger = createLogger('SubscriptionContext')

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionState {
  // Subscription info
  planId: PlanId
  planConfig: PlanConfig
  subscriptionStatus: "active" | "cancelled" | "expired" | "trial"

  // Usage tracking
  minutesUsedThisPeriod: number
  minutesLimit: number
  maxMinutesPerMeeting: number

  // Metadata
  renewsAt?: number
  trialEndsAt?: number

  // State
  isLoading: boolean
  error: string | null
}

export interface SubscriptionContextType extends SubscriptionState {
  // Actions
  refresh: () => Promise<void>
  canUseFeature: (featureKey: keyof PlanConfig["features"]) => boolean
  canStartMeeting: () => { allowed: boolean; reason?: string }
  getRemainingMinutes: () => number

  // Upgrade flow
  startCheckout: (targetPlan: PlanId, interval: "month" | "year") => Promise<void>
}

interface SubscriptionApiResponse {
  planId: PlanId
  status: "active" | "cancelled" | "expired" | "trial"
  minutesUsedThisPeriod: number
  minutesLimit: number
  renewsAt?: number
  trialEndsAt?: number
}

interface CheckoutApiResponse {
  checkoutUrl: string
}

// ============================================================================
// CONTEXT
// ============================================================================

const SubscriptionContext = createContext<SubscriptionContextType | null>(null)

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_FREE_STATE: SubscriptionState = {
  planId: "free",
  planConfig: PLANS.free,
  subscriptionStatus: "trial",
  minutesUsedThisPeriod: 0,
  minutesLimit: 20,
  maxMinutesPerMeeting: 20,
  isLoading: false,
  error: null,
}

// ============================================================================
// PROVIDER
// ============================================================================

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token } = useAuth()

  const [state, setState] = useState<SubscriptionState>({
    ...DEFAULT_FREE_STATE,
    isLoading: true,
  })

  // ============================================================================
  // FETCH SUBSCRIPTION DATA
  // ============================================================================

  const fetchSubscription = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      logger.debug('Fetching subscription data')

      const data = await api.get<SubscriptionApiResponse>(
        '/api/subscription/me',
        token
      )

      const planConfig = PLANS[data.planId]

      setState({
        planId: data.planId,
        planConfig,
        subscriptionStatus: data.status || "active",
        minutesUsedThisPeriod: data.minutesUsedThisPeriod || 0,
        minutesLimit: data.minutesLimit || planConfig.features.maxMinutesPerMeeting,
        maxMinutesPerMeeting: planConfig.features.maxMinutesPerMeeting,
        renewsAt: data.renewsAt,
        trialEndsAt: data.trialEndsAt,
        isLoading: false,
        error: null,
      })

      logger.info('Subscription data loaded', {
        planId: data.planId,
        status: data.status,
        minutesUsed: data.minutesUsedThisPeriod,
      })
    } catch (error: any) {
      // If 401 Unauthorized, user not authenticated - default to free tier
      if (error.status === 401) {
        logger.debug('User not authenticated, defaulting to free tier')
        setState(DEFAULT_FREE_STATE)
        return
      }

      logger.error('Failed to fetch subscription', error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load subscription",
      }))
    }
  }, [token])

  // Fetch on mount
  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSubscription()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchSubscription])

  // ============================================================================
  // FEATURE GATING HELPERS
  // ============================================================================

  const canUseFeature = useCallback(
    (featureKey: keyof PlanConfig["features"]): boolean => {
      const feature = state.planConfig.features[featureKey]

      // Boolean features
      if (typeof feature === "boolean") {
        return feature
      }

      // Numeric limits (like maxMeetingsPerWeek)
      if (typeof feature === "number") {
        return feature > 0
      }

      return false
    },
    [state.planConfig]
  )

  const canStartMeeting = useCallback((): { allowed: boolean; reason?: string } => {
    // Check if transcription is enabled
    if (!state.planConfig.features.realtimeTranscription) {
      return {
        allowed: false,
        reason: "Real-time transcription not available on your plan",
      }
    }

    // Check monthly minutes limit
    const remainingMinutes = getRemainingMinutes()
    if (remainingMinutes <= 0) {
      return {
        allowed: false,
        reason: `You've used all ${state.minutesLimit} minutes this month. Upgrade to continue.`,
      }
    }

    return { allowed: true }
  }, [state.planConfig, state.minutesLimit, state.minutesUsedThisPeriod])

  const getRemainingMinutes = useCallback((): number => {
    return Math.max(0, state.minutesLimit - state.minutesUsedThisPeriod)
  }, [state.minutesLimit, state.minutesUsedThisPeriod])

  // ============================================================================
  // UPGRADE FLOW
  // ============================================================================

  const startCheckout = useCallback(
    async (targetPlan: PlanId, interval: "month" | "year") => {
      try {
        logger.info('Starting checkout', { targetPlan, interval })

        const data = await api.post<CheckoutApiResponse>(
          '/api/subscription/start-checkout',
          { planId: targetPlan, interval },
          token
        )

        if (data.checkoutUrl) {
          // Open checkout URL in external browser
          if (window.electronAPI?.invoke) {
            await window.electronAPI.invoke("shell:openExternal", data.checkoutUrl)
          } else {
            // Fallback for web
            window.open(data.checkoutUrl, "_blank")
          }

          logger.success('Checkout initiated', { targetPlan, interval })

          // Refresh subscription after a delay (user will complete checkout)
          setTimeout(() => {
            fetchSubscription()
          }, 3000)
        }
      } catch (error) {
        logger.error('Checkout failed', error, { targetPlan, interval })
        throw error
      }
    },
    [token, fetchSubscription]
  )

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: SubscriptionContextType = {
    ...state,
    refresh: fetchSubscription,
    canUseFeature,
    canStartMeeting,
    getRemainingMinutes,
    startCheckout,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider")
  }
  return context
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook to check if a specific feature is available
 */
export const useFeature = (featureKey: keyof PlanConfig["features"]): boolean => {
  const { canUseFeature } = useSubscription()
  return canUseFeature(featureKey)
}

/**
 * Hook to get plan information
 */
export const usePlan = () => {
  const { planId, planConfig, subscriptionStatus } = useSubscription()
  return { planId, planConfig, subscriptionStatus }
}

/**
 * Hook to check if user can start a meeting
 */
export const useCanStartMeeting = () => {
  const { canStartMeeting } = useSubscription()
  return canStartMeeting()
}

/**
 * Hook for usage stats
 */
export const useUsageStats = () => {
  const { minutesUsedThisPeriod, minutesLimit, getRemainingMinutes } = useSubscription()
  return {
    used: minutesUsedThisPeriod,
    limit: minutesLimit,
    remaining: getRemainingMinutes(),
    percentUsed: minutesLimit > 0 ? (minutesUsedThisPeriod / minutesLimit) * 100 : 0,
  }
}
