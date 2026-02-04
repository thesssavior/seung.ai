'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from 'next-intl';

export default function SignIn() {
  const t = useTranslations();
  const { signInWithGoogle, isLoading } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card text-card-foreground p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t('signIn')}</h1>
          <p className="mt-2 text-muted-foreground">{t('signInDescription')}</p>
        </div>

        <Button
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="w-full bg-black hover:bg-zinc-800 text-white"
        >
          {isLoading ? 'Loading...' : t('signInWithGoogle')}
        </Button>
      </div>
    </div>
  );
}
