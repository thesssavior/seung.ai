import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_KEY!,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0
      }
    );
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

export async function isFeatureEnabled(
  flagName: string,
  distinctId: string
): Promise<boolean> {
  const client = getPostHogClient();
  const result = await client.isFeatureEnabled(flagName, distinctId);
  return result ?? false;
}

export async function getFeatureFlag(
  flagName: string,
  distinctId: string
): Promise<string | boolean | undefined> {
  const client = getPostHogClient();
  return await client.getFeatureFlag(flagName, distinctId);
}

export async function getFeatureFlagPayload(
  flagName: string,
  distinctId: string
): Promise<unknown> {
  const client = getPostHogClient();
  return await client.getFeatureFlagPayload(flagName, distinctId);
}
