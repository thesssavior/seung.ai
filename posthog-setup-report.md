# PostHog post-wizard report

The wizard has completed a deep integration of your Next.js project with PostHog analytics. The integration includes:

- **Client-side initialization** via `instrumentation-client.ts` for automatic pageview tracking, session recording, and exception capture
- **Server-side PostHog client** for capturing events from API routes
- **Reverse proxy configuration** via Next.js rewrites for improved tracking reliability
- **User identification** that syncs user data with PostHog upon authentication
- **15 custom events** tracking user authentication, feature usage, subscription lifecycle, and settings changes

## Events Integrated

| Event Name | Description | File |
|------------|-------------|------|
| `user_signed_in` | Track when a user signs in via Google OAuth | `src/contexts/AuthContext.tsx` |
| `user_signed_out` | Track when a user signs out | `src/contexts/AuthContext.tsx` |
| `checkout_initiated` | Track when a user initiates the checkout flow | `src/app/[locale]/pricing/page.tsx` |
| `billing_cycle_changed` | Track when a user changes the billing cycle option | `src/app/[locale]/pricing/page.tsx` |
| `subscription_completed` | Track when a subscription checkout is completed (server-side) | `src/app/api/webhooks/stripe/route.ts` |
| `subscription_canceled` | Track when a subscription is canceled (server-side) | `src/app/api/webhooks/stripe/route.ts` |
| `payment_failed` | Track when a payment fails (server-side) | `src/app/api/webhooks/stripe/route.ts` |
| `summary_generated` | Track when a video summary is generated | `src/app/api/files/summarize/route.ts` |
| `quiz_generated` | Track when a quiz is generated | `src/app/api/files/quiz/route.ts` |
| `mindmap_generated` | Track when a mindmap is generated | `src/app/api/files/mindmap/route.ts` |
| `chat_message_sent` | Track when a user sends a chat message | `src/app/api/files/chat/route.ts` |
| `account_deleted` | Track when a user deletes their account | `src/app/api/home/user/delete/route.ts` |
| `theme_changed` | Track when a user changes their theme preference | `src/app/[locale]/settings/page.tsx` |
| `language_changed` | Track when a user changes their language preference | `src/app/[locale]/settings/page.tsx` |
| `subscription_portal_opened` | Track when a user opens the subscription management portal | `src/app/[locale]/settings/page.tsx` |

## Files Created/Modified

### New Files
- `instrumentation-client.ts` - PostHog client-side initialization
- `src/lib/posthog-server.ts` - PostHog server-side client

### Modified Files
- `next.config.js` - Added reverse proxy rewrites for PostHog
- `src/contexts/AuthContext.tsx` - Added user identification and auth events
- `src/app/[locale]/pricing/page.tsx` - Added checkout and billing events
- `src/app/api/webhooks/stripe/route.ts` - Added subscription lifecycle events
- `src/app/api/files/summarize/route.ts` - Added summary generation event
- `src/app/api/files/quiz/route.ts` - Added quiz generation event
- `src/app/api/files/mindmap/route.ts` - Added mindmap generation event
- `src/app/api/files/chat/route.ts` - Added chat message event
- `src/app/api/home/user/delete/route.ts` - Added account deletion event
- `src/app/[locale]/settings/page.tsx` - Added settings change events

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/296707/dashboard/1258215)

### Insights
- [User Authentication Activity](https://us.posthog.com/project/296707/insights/WFbIDRdI) - Daily sign-ins and sign-outs over time
- [Subscription Conversion Funnel](https://us.posthog.com/project/296707/insights/EujjTW9f) - Tracks conversion from checkout to subscription
- [Feature Usage Trends](https://us.posthog.com/project/296707/insights/pRbnSe38) - Weekly breakdown of AI feature usage
- [Subscription Health](https://us.posthog.com/project/296707/insights/3iAfoSHk) - Tracks subscription completions, cancellations, and failed payments
- [Churn Indicator - Account Deletions](https://us.posthog.com/project/296707/insights/S9qSlWOA) - Tracks account deletions as a measure of churn

### Environment Variables

Make sure you have the following environment variables set in your `.env.local` file:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_YpnbgS57YH8ta7ntbS2oSRsAdV4zjVj99jZXFl895zo
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
