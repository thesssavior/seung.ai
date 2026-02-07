'use client'

import React, { useState, useTransition, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Crown, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useFolder } from '@/components/home/SidebarLayout';
import { LanguageSwitcher } from '@/components/home/LanguageSwitcher';
import posthog from 'posthog-js';

const SettingsPage = () => {
  const t = useTranslations('SettingsPage');
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('free');
  const { openSubscriptionModal } = useFolder();
  const { theme, setTheme } = useTheme();

  // Fetch user plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (user) {
        try {
          const res = await fetch('/api/home/user/plan');
          if (!res.ok) { setUserPlan('free'); return; }
          const data = await res.json();
          setUserPlan(data.plan || 'free');
        } catch {
          setUserPlan('free');
        }
      }
    };
    fetchPlan();
  }, [user]);

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    posthog.capture('subscription_portal_opened');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Portal error:', data.error);
      }
    } catch (error) {
      console.error('Portal exception:', error);
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleLanguageChange = (newLocale: string) => {
    localStorage.setItem('uiLanguage', newLocale);
    posthog.capture('language_changed', {
      language: newLocale,
      previous_language: locale,
    });
    startTransition(() => {
      router.replace(`/${newLocale}/settings`);
    });
  };

  const handleThemeChange = (newTheme: string) => {
    posthog.capture('theme_changed', {
      theme: newTheme,
      previous_theme: theme,
    });
    setTheme(newTheme);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    if (window.confirm(t('confirmDeleteAccount'))) {
      setIsDeleting(true);
      try {
        const response = await fetch('/api/home/user/delete', { method: 'DELETE' });
        if (response.ok) {
          await signOut();
          router.push('/');
        } else {
          const errorData = await response.json();
          alert(t('deleteAccountError', { error: errorData.error || 'Unknown error' }));
        }
      } catch (error) {
        console.error("Delete account error:", error);
        alert(t('deleteAccountError', { error: 'Client-side error' }));
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="text-center py-10">
        <p>{t('mustBeLoggedIn')}</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
    <div className="space-y-8 max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-semibold mb-6">{t('title')}</h1>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('accountSection.title')}</CardTitle>
          <CardDescription>{t('accountSection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('accountSection.nameLabel')}</label>
            <p className="text-foreground break-all">{user.user_metadata?.full_name || user.user_metadata?.name || t('accountSection.noName')}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('accountSection.emailLabel')}</label>
            <p className="text-foreground break-all">{user.email || t('accountSection.noEmail')}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-row gap-2">
          <Button onClick={handleSignOut} variant="outline">
            {t('accountSection.signOutButton')}
          </Button>
          {/* <Button
            onClick={handleDeleteAccount}
            variant="destructive"
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('accountSection.deleteAccountButton')}
          </Button> */}
        </CardFooter>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('preferencesSection.title')}</CardTitle>
          <CardDescription>{t('preferencesSection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language Preference for UI */}
          <div>
            <label htmlFor="language-select" className="text-sm font-medium text-muted-foreground">
              {t('preferencesSection.languageLabel')}
            </label>
            <Select value={locale} onValueChange={handleLanguageChange} disabled={isPending}>
              <SelectTrigger id="language-select" className="w-full sm:w-[180px] mt-1">
                <SelectValue placeholder={t('preferencesSection.selectLanguagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('preferencesSection.english')}</SelectItem>
                <SelectItem value="ko">{t('preferencesSection.korean')}</SelectItem>
                <SelectItem value="es">{t('preferencesSection.spanish')}</SelectItem>
              </SelectContent>
            </Select>
            {isPending && <Loader2 className="mt-2 h-4 w-4 animate-spin" />}
          </div>

          {/* Language Preference for Content */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              {t('preferencesSection.contentLanguageLabel')}
            </div>
            <LanguageSwitcher />
            {isPending && <Loader2 className="mt-2 h-4 w-4 animate-spin" />}
          </div>

          {/* Theme Preference */}
          <div>
            <label htmlFor="theme-select" className="text-sm font-medium text-muted-foreground">
              {t('preferencesSection.themeLabel', { defaultValue: 'Theme' })}
            </label>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger id="theme-select" className="w-full sm:w-[180px] mt-1">
                <SelectValue placeholder={t('preferencesSection.selectThemePlaceholder', { defaultValue: 'Select theme' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    {t('preferencesSection.lightTheme', { defaultValue: 'Light' })}
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    {t('preferencesSection.darkTheme', { defaultValue: 'Dark' })}
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    {t('preferencesSection.systemTheme', { defaultValue: 'System' })}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1 p-2">
              {t('preferencesSection.themeDescription', { defaultValue: 'Choose your preferred theme or sync with your system settings.' })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manage Subscription Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscriptionSection.title', { defaultValue: 'Manage Subscription' })}</CardTitle>
          <CardDescription>{t('subscriptionSection.description', { defaultValue: 'View and manage your subscription details.' })}</CardDescription>
        </CardHeader>
        <CardContent>
          {userPlan === 'premium' ? (
            <Button onClick={handleManageSubscription} disabled={isManagingSubscription}>
              {isManagingSubscription ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('subscriptionSection.manageButton', { defaultValue: 'Manage Subscription' })}
            </Button>
          ) : (
            <Button onClick={openSubscriptionModal}>
              <Crown className="mr-2 h-4 w-4" />
              {t('subscriptionSection.upgradeButton', { defaultValue: 'Upgrade to Premium' })}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
    </Suspense>
  );
};

export default SettingsPage;
