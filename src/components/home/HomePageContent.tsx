'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from "react";
import { VideoInputForm } from '@/components/youtube/VideoInputForm';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';

function AnimatedCounter({ value }: { value: number }) {
  const hasPlayed = typeof window !== 'undefined' && localStorage.getItem('counterAnimated') === 'true';
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(hasPlayed ? value : 0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [current, setCurrent] = useState(hasPlayed ? value : 0);

  useEffect(() => {
    if (isInView && !hasPlayed) {
      spring.set(value);
    }
  }, [isInView, spring, value, hasPlayed]);

  useEffect(() => {
    return display.on('change', (v) => {
      setCurrent(v);
      if (v === value && !hasPlayed) {
        localStorage.setItem('counterAnimated', 'true');
      }
    });
  }, [display, value, hasPlayed]);

  return (
    <motion.span
      ref={ref}
      className="inline-block font-semibold tabular-nums"
      initial={{ scale: 1 }}
      animate={!hasPlayed && current === value ? { scale: [1.15, 1] } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      {current}
    </motion.span>
  );
}

function AnimatedTitle({ title }: { title: string }) {
  const idx = title.indexOf('100');
  if (idx === -1) return <>{title}</>;

  const before = title.slice(0, idx);
  const after = title.slice(idx + 3);

  return (
    <>
      {before}
      <AnimatedCounter value={100} />
      {after}
    </>
  );
}

export default function HomePageContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params.locale as string || 'ko'; // Get locale from client-side params
  const isDevMode = searchParams.get('dev') === 'true';
  const t = useTranslations();
  // if (isDevMode) {
  //   // Render the original page content for developers
    return (
        <div className="container mx-auto px-4 max-w-3xl mt-24 space-y-12">
          <h1 className="text-4xl font-normal text-center mb-2">
            <AnimatedTitle title={t('title')} />
          </h1>
          {/* <p className="text-muted-foreground text-center mb-12">
            {t('subtitle')}
          </p> */}
          <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <VideoInputForm />
          </Suspense>
          {/* Pass videoIdFromUrl to FullTranscriptViewer */}
        </div>
    );
  // } else {
  //   // Render the maintenance message for regular users
  //   return (
  //     <div className="text-center px-4">
  //       <h1 className="text-3xl font-bold mb-4">서버 점검 중</h1>
  //       <p className="text-xl text-gray-600">죄송합니다 서둘러 고치겠습니다ㅠㅠ</p>
  //       <p className="text-xl text-gray-600">lilys.ai 와 다른 웹사이트도 유튜브 요약 가능합니다</p>
  //       <p className="text-xl text-gray-600">https://lilys.ai</p>
  //     </div>
  //   );
  // }
}
