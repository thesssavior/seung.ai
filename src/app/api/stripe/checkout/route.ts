import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { getUser } from '@/lib/supabase/auth'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, billingCycle, locale } = await req.json()

    // Validate price ID
    let validPriceId = priceId
    if (!validPriceId) {
      if (billingCycle === 'yearly') validPriceId = STRIPE_PRICES.yearly
      else if (billingCycle === 'monthly') validPriceId = STRIPE_PRICES.monthly
      else validPriceId = STRIPE_PRICES.weekly
    }

    if (!validPriceId) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email!,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to profile
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: validPriceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/${locale || 'en'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale || 'en'}`,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
        ...(billingCycle === 'yearly' && { trial_period_days: 7 }),
      },
      ...(billingCycle === 'yearly' && { payment_method_collection: 'always' as const }),
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
