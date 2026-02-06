"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { HelpCircle, LogIn, User } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useParams } from "next/navigation";

export function Navbar() {
  const t = useTranslations();
  const { user, signInWithGoogle } = useAuth();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <>
      <nav className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 sm:px-12">
          <Link href={`/${locale}`} className="flex items-center space-x-2 ml-12 sm:ml-6">
            <Logo width={92} height={92} small={true} />
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-6">
            <Link href={`/${locale}/community`}>
              <Button
                variant="ghost"
                title={t('helpAndCommunity')}
              >
                <span className="sm:hidden"><HelpCircle className="h-5 w-5" /></span>
                <span className="hidden sm:flex items-center space-x-2 gap-x-1">
                  <HelpCircle className="h-5 w-5" />
                </span>
              </Button>
            </Link>

            {user ? (
              <div className="flex items-center space-x-4">
                <Link href={`/${locale}/settings`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata?.avatar_url ?? undefined} alt={user.user_metadata?.full_name ?? 'User'} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                </Link>
              </div>
            ) : (
              <Button
                onClick={signInWithGoogle}
                className="bg-foreground hover:opacity-90 text-background"
                title={t('signIn')}
              >
                <span className="sm:hidden"><LogIn className="h-5 w-5" /></span>
                <span className="hidden sm:flex items-center space-x-2 gap-x-1">
                  {t('signIn')}
                  <LogIn className="h-5 w-5" />
                </span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
