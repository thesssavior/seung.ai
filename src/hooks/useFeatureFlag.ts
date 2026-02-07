'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

/**
 * Returns whether a boolean feature flag is enabled.
 * undefined = flags still loading.
 */
export function useFeatureFlag(flagName: string): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(() =>
    posthog.isFeatureEnabled(flagName)
  )

  useEffect(() => {
    return posthog.onFeatureFlags(() => {
      setEnabled(posthog.isFeatureEnabled(flagName))
    })
  }, [flagName])

  return enabled
}

/**
 * Returns the variant key for a multivariate flag (string),
 * true/false for boolean flags, or undefined while loading.
 */
export function useFeatureFlagVariant(flagName: string): string | boolean | undefined {
  const [variant, setVariant] = useState<string | boolean | undefined>(() =>
    posthog.getFeatureFlag(flagName)
  )

  useEffect(() => {
    return posthog.onFeatureFlags(() => {
      setVariant(posthog.getFeatureFlag(flagName))
    })
  }, [flagName])

  return variant
}

/**
 * Returns the JSON payload attached to a feature flag, or undefined while loading.
 */
export function useFeatureFlagPayload(flagName: string): unknown {
  const [payload, setPayload] = useState<unknown>(() =>
    posthog.getFeatureFlagPayload(flagName)
  )

  useEffect(() => {
    return posthog.onFeatureFlags(() => {
      setPayload(posthog.getFeatureFlagPayload(flagName))
    })
  }, [flagName])

  return payload
}
