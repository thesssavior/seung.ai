'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Loader2, Clock, Zap, Star, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/logo';

interface SubscriptionPlansProps {
  isOpen: boolean;
  onCloseAction: () => void;
}

// Pricing configuration - update these values as needed
const PRICING = {
  weekly: {
    price: 4,
    priceFormatted: '$4',
  },
  monthly: {
    price: 9,
    priceFormatted: '$9',
  },
  yearly: {
    price: 49,
    priceFormatted: '$49',
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

      const data = await res.json();

      if (res.ok && data.url) {
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

  const currentPricing = PRICING[billingCycle];
  const planFeatures = t.raw('features');

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="text-center">{t('title')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {/* Social Proof Bar */}
        {/* <div className="flex items-center justify-center gap-4 py-3 px-4 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="text-muted-foreground">{t('socialProof.timeSaved')}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="text-muted-foreground ml-1">{t('socialProof.rating')}</span>
          </div>
        </div> */}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center my-4">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
            <button
              onClick={() => setBillingCycle('weekly')}
              className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${
                billingCycle === 'weekly'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('weekly')}
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('monthly')}
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('yearly', { defaultValue: 'Yearly' })}
            </button>
          </div>
        </div>

        <div className="py-4">
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
                  {billingCycle === 'weekly' ? '/ week' : billingCycle === 'monthly' ? '/ month' : '/ year'}
                </span>
              </p>
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
                    {t('subscribeButton')}
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
