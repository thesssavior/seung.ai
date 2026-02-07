'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Check, Clock, Zap, BookOpen, Star, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import posthog from 'posthog-js';

const PRICING = {
  weekly: { price: 4, priceFormatted: '$4' },
  monthly: { price: 9, priceFormatted: '$9' },
  yearly: { price: 59, priceFormatted: '$59' },
};

export default function PricingPage() {
  const t = useTranslations('PricingPage');
  const locale = useLocale();
  const [checkingOut, setCheckingOut] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const { user } = useAuth();

  const handleCheckout = async () => {
    if (!user) {
      window.location.href = `/${locale}/auth/signin`;
      return;
    }

    // Track checkout initiation
    posthog.capture('checkout_initiated', {
      billing_cycle: billingCycle,
      price: PRICING[billingCycle].price,
      currency: 'USD',
    });

    setCheckingOut(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingCycle, locale }),
      });
      if (!res.ok) { setCheckingOut(false); return; }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckingOut(false);
      }
    } catch (error) {
      posthog.captureException(error);
      setCheckingOut(false);
    }
  };

  const currentPricing = PRICING[billingCycle];
  const testimonials = t.raw('testimonials') as Array<{ name: string; role: string; quote: string }>;
  const stats = t.raw('stats') as Array<{ value: string; label: string }>;
  const freeFeatures = t.raw('freeFeatures') as string[];
  const premiumFeatures = t.raw('premiumFeatures') as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            {t('badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {t('heroTitle')}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>

          {/* Value Props */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-5 h-5 text-green-500" />
              <span>{t('valueProp1')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span>{t('valueProp2')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span>{t('valueProp3')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">{t('pricingTitle')}</h2>
          <p className="text-center text-muted-foreground mb-8">{t('pricingSubtitle')}</p>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-muted p-1 rounded-full">
              {(['weekly', 'monthly', 'yearly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => {
                    setBillingCycle(cycle);
                    posthog.capture('billing_cycle_changed', {
                      billing_cycle: cycle,
                      price: PRICING[cycle].price,
                    });
                  }}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    billingCycle === cycle
                      ? 'bg-foreground text-background shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`billing.${cycle}`)}
                  {cycle === 'yearly' && (
                    <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                      {t('billing.save')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Plan */}
            <div className="border border-border rounded-2xl p-8 bg-card">
              <h3 className="text-xl font-semibold mb-2">{t('freePlan.title')}</h3>
              <p className="text-muted-foreground text-sm mb-6">{t('freePlan.description')}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/{t('billing.month')}</span>
              </div>
              <Link
                href={`/${locale}/auth/signin`}
                className="block w-full text-center py-3 px-4 rounded-lg border border-border hover:bg-muted transition-colors font-medium"
              >
                {t('freePlan.cta')}
              </Link>
              <ul className="mt-8 space-y-3">
                {freeFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium Plan */}
            <div className="border-2 border-foreground rounded-2xl p-8 bg-card relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-1 rounded-full text-sm font-medium">
                {t('premiumPlan.badge')}
              </div>
              <div className="flex items-center gap-3 mb-2">
                <Logo width={24} height={24} className="rounded" />
                <h3 className="text-xl font-semibold">{t('premiumPlan.title')}</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-6">{t('premiumPlan.description')}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{currentPricing.priceFormatted}</span>
                <span className="text-muted-foreground">
                  /{billingCycle === 'weekly' ? t('billing.week') : billingCycle === 'monthly' ? t('billing.month') : t('billing.year')}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full py-3 px-4 rounded-lg bg-foreground text-background hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {checkingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t('premiumPlan.cta')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <ul className="mt-8 space-y-3">
                {premiumFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">{t('testimonialsTitle')}</h2>
          <p className="text-center text-muted-foreground mb-12">{t('testimonialsSubtitle')}</p>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <div className="font-medium text-sm">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t('ctaTitle')}</h2>
          <p className="text-muted-foreground mb-8">{t('ctaSubtitle')}</p>
          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="inline-flex items-center gap-2 py-4 px-8 rounded-lg bg-foreground text-background hover:opacity-90 transition-colors font-medium text-lg disabled:opacity-50"
          >
            {checkingOut ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t('ctaButton')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          <p className="text-sm text-muted-foreground mt-4">{t('ctaNote')}</p>
        </div>
      </section>
    </div>
  );
}
