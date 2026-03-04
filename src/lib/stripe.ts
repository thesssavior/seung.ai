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

// Regional pricing for Indonesia
export const STRIPE_PRICES_ID = {
  weekly: 'price_1T7COFRNKLUBo7MiuY78s6Hx',
  monthly: 'price_1T7COTRNKLUBo7Mib5i4GaYw',
  yearly: 'price_1T7COhRNKLUBo7MiIex29hNa',
}

// Subscription statuses that grant premium access
export const PREMIUM_STATUSES = ['active', 'trialing', 'past_due']
