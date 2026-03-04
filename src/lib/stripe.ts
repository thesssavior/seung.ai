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
  weekly: 'price_1T7C2sRNKLUBo7MiHthy4ctq',
  monthly: 'price_1T7C38RNKLUBo7MiW2JTjANo',
  yearly: 'price_1T7C44RNKLUBo7MiDVczcjZN',
}

// Subscription statuses that grant premium access
export const PREMIUM_STATUSES = ['active', 'trialing', 'past_due']
