'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Loader2, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/logo';

interface SubscriptionPlansProps {
  isOpen: boolean;
  onCloseAction: () => void;
}

// Pricing configuration - update these values as needed
const PRICING = {
  weekly: {
    price: 3,
    priceFormatted: '$3',
  },
  monthly: {
    price: 7,
    priceFormatted: '$7',
  },
  yearly: {
    price: 47,
    priceFormatted: '$47',
  },
};

// Regional pricing for Indonesia
const PRICING_ID = {
  weekly: {
    price: 2,
    priceFormatted: '$2',
  },
  monthly: {
    price: 5,
    priceFormatted: '$5',
  },
  yearly: {
    price: 35,
    priceFormatted: '$35',
  },
};

export default function SubscriptionPlans({ isOpen, onCloseAction }: SubscriptionPlansProps) {
  const t = useTranslations('SubscriptionPlans');
  const locale = useLocale();
  const [checkingOut, setCheckingOut] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const { user } = useAuth();
  const handleCheckout = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setCheckingOut(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCycle,
          locale,
        }),
      });

      if (!res.ok) {
        console.error('Checkout error: non-OK response');
        setCheckingOut(false);
        return;
      }
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout error:', data.error);
        setCheckingOut(false);
      }
    } catch (err) {
      console.error('Checkout exception:', err);
      setCheckingOut(false);
    }
  };

  const currentPricing = (locale === 'id' ? PRICING_ID : PRICING)[billingCycle];
  const planFeatures = t.raw('features');

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader className="mb-8">
          <DialogTitle className="text-2xl font-bold text-center">{t('title')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('description')} <br />
            {t('description2')}
          </DialogDescription>
        </DialogHeader>

        {/* Billing Cycle Toggle */}
        <div className="flex gap-2 justify-center">
          <div className="flex gap-2">
            {(['weekly', 'monthly', 'yearly'] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className="relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
              >
                {billingCycle === cycle && (
                  <motion.span
                    layoutId="billingToggle"
                    className="absolute inset-0 bg-foreground rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
                  billingCycle === cycle ? 'text-background' : 'text-muted-foreground'
                }`}>
                  {t(cycle)}
                  {cycle === 'yearly' && (
                    <span className="text-[10px] font-semibold bg-green-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                      {t('save', { percentage: 44 })}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="border border-border p-6 rounded-lg shadow-sm bg-card text-card-foreground flex flex-col md:flex-row gap-6">
            {/* Left Column */}
            <div className="flex flex-col w-full md:w-1/3">
              <div className="flex items-center mb-4">
                <Logo
                  width={24}
                  height={24}
                  className="mr-3 rounded-md"
                />
                <div>
                  <h3 className="font-semibold text-xl">Premium</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 flex-grow">
                {t('valueProposition')}
              </p>
              <p className="text-3xl font-bold mb-1">
                {currentPricing.priceFormatted}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {billingCycle === 'weekly' ? t('pricePerWeek') : billingCycle === 'monthly' ? t('pricePerMonth') : t('pricePerYear')}
                </span>
              </p>
              {billingCycle === 'yearly' && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                  {t('freeTrial')}
                </p>
              )}
              <button
                onClick={handleCheckout}
                disabled={checkingOut || !user}
                className="w-full bg-foreground text-background font-bold py-2 px-4 rounded hover:opacity-90 transition-colors duration-200 text-center mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {/* {t('loading')} */}
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    {billingCycle === 'yearly' ? t('freeTrialCta') : t('subscribeButton')}
                    {/* <span aria-hidden="true">→</span> */}
                  </>
                )}
              </button>
            </div>

            {/* Right Column (Feature List) */}
            <div className="w-full md:w-2/3">
              <h4 className="font-medium mb-3">{t('featureListTitle')}</h4>
              <ul className="space-y-2">
                {Array.isArray(planFeatures) ? (
                  planFeatures.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))
                ) : (
                  <li className="text-red-500">Error: Features not loaded correctly.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
