import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripeInstance
}

// Convenience export that creates instance lazily
export const stripe = {
  get instance() {
    return getStripe()
  },
}

// Price IDs from your Stripe dashboard
export const STRIPE_PRICES = {
  weekly: process.env.STRIPE_PRICE_WEEKLY,
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly: process.env.STRIPE_PRICE_YEARLY,
}

// Subscription statuses that grant premium access
export const PREMIUM_STATUSES = ['active', 'trialing', 'past_due']
