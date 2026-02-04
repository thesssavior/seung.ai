import { NextRequest, NextResponse } from 'next/server'
import { getStripe, PREMIUM_STATUSES } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseClient'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('[Stripe] Checkout completed:', session.id)

        // Get user ID from metadata
        const userId = session.metadata?.user_id

        if (userId && session.subscription) {
          // Fetch the subscription to get status
          const subscription = await getStripe().subscriptions.retrieve(
            session.subscription as string
          )

          await updateUserSubscription(userId, subscription)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`[Stripe] Subscription ${event.type}:`, subscription.id)

        const userId = subscription.metadata?.user_id

        if (userId) {
          await updateUserSubscription(userId, subscription)
        } else {
          // Try to find user by customer ID
          const customerId = subscription.customer as string
          await updateUserByCustomerId(customerId, subscription)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log('[Stripe] Subscription deleted:', subscription.id)

        const userId = subscription.metadata?.user_id

        if (userId) {
          await supabaseAdmin
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              stripe_subscription_status: 'canceled',
            })
            .eq('id', userId)

          console.log(`[Stripe] User ${userId} downgraded to free plan`)
        } else {
          // Try by customer ID
          const customerId = subscription.customer as string
          await supabaseAdmin
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              stripe_subscription_status: 'canceled',
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log('[Stripe] Payment failed for invoice:', invoice.id)

        const customerId = invoice.customer as string

        // Mark as past_due but don't immediately downgrade
        await supabaseAdmin
          .from('profiles')
          .update({
            stripe_subscription_status: 'past_due',
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function updateUserSubscription(
  userId: string,
  subscription: Stripe.Subscription
) {
  const plan = PREMIUM_STATUSES.includes(subscription.status) ? 'premium' : 'free'

  // Get current period end from subscription (it's a unix timestamp)
  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000).toISOString()
    : null

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      plan,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_current_period_end: currentPeriodEnd,
    })
    .eq('id', userId)

  if (error) {
    console.error(`[Stripe] Failed to update user ${userId}:`, error)
  } else {
    console.log(`[Stripe] User ${userId} updated to plan: ${plan}`)
  }
}

async function updateUserByCustomerId(
  customerId: string,
  subscription: Stripe.Subscription
) {
  const plan = PREMIUM_STATUSES.includes(subscription.status) ? 'premium' : 'free'

  // Get current period end from subscription (it's a unix timestamp)
  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000).toISOString()
    : null

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      plan,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_current_period_end: currentPeriodEnd,
    })
    .eq('stripe_customer_id', customerId)
    .select('id')

  if (error) {
    console.error(`[Stripe] Failed to update by customer ${customerId}:`, error)
  } else if (data && data.length > 0) {
    console.log(`[Stripe] User ${data[0].id} updated to plan: ${plan}`)
  }
}
