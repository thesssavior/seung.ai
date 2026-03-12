'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsLayoutIdContext = React.createContext<string>('tabs');

let tabsListCounter = 0;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const layoutId = React.useMemo(() => `tabs-${++tabsListCounter}`, []);
  return (
    <TabsLayoutIdContext.Provider value={layoutId}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          'inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground',
          className
        )}
        {...props}
      />
    </TabsLayoutIdContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const layoutId = React.useContext(TabsLayoutIdContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
        className
      )}
      {...props}
    >
      <TabsTriggerInner layoutId={layoutId}>
        {children}
      </TabsTriggerInner>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

function TabsTriggerInner({
  layoutId,
  children,
}: {
  layoutId: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    const trigger = ref.current?.closest('[role="tab"]');
    if (!trigger) return;

    const observer = new MutationObserver(() => {
      setIsActive(trigger.getAttribute('data-state') === 'active');
    });
    setIsActive(trigger.getAttribute('data-state') === 'active');
    observer.observe(trigger, { attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {isActive && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 bg-background rounded-full shadow-sm"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <span ref={ref} className="relative z-10">{children}</span>
    </>
  );
}

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
