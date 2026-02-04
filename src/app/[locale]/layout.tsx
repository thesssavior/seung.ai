import { notFound } from 'next/navigation';
import '../globals.css';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

// Add react-pdf CSS imports
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ClientLayoutWrapper } from '@/components/ClientLayoutWrapper';

export function generateStaticParams() {
  return [
    { locale: 'ko' },
    { locale: 'en' }
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const { locale = 'ko' } = resolvedParams;

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <ClientLayoutWrapper locale={locale} messages={messages}>
        {children}
      </ClientLayoutWrapper>
    </Suspense>
  );
}