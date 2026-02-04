'use client';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PaymentSuccess() {
  const t = useTranslations('PaymentSuccess');
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (user?.email) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/home/user/plan?email=${user.email}`);
          if (!res.ok) {
            console.error("Failed to fetch plan status:", res.status);
            return;
          }
          const { plan: latestPlan } = await res.json();
          if (latestPlan && latestPlan !== 'free') {
            setPlan(latestPlan);
            clearInterval(interval);
            setLoading(false);
          }
        } catch (error) {
          console.error("Error polling for plan status:", error);
        }
      }, 3000);
    } else {
      setLoading(false);
    }
    return () => clearInterval(interval);
  }, [user]);

  const isPremium = plan && plan !== 'free';
  const isLoadingPlan = loading && !isPremium;

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Success Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-8 h-8 text-white stroke-[3]" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('statusLabel')}{' '}
            <span className="text-gray-900 dark:text-white font-medium">Premium</span>
          </p>
        </div>

        {/* Status */}
        <div className="flex justify-center mb-10">
          {isLoadingPlan ? (
            <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('statusUpdating')}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {t('statusActive')}
            </div>
          )}
        </div>

        {/* Button */}
        <button
          onClick={() => router.push("/")}
          className="w-full py-3 px-4 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {t('newSummaryButton')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
