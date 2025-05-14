/// <reference types="astro/client" />

// Define Env for your Cloudflare environment variables and bindings
interface CloudflareEnv {
  ASTRO_LISTMONK_API_URL: string;
  ASTRO_LISTMONK_API_KEY: string;
  // Add other Cloudflare bindings (like KV, D1, etc.) or environment variables here as needed
  // EXAMPLE_KV_NAMESPACE: KVNamespace;
  // EXAMPLE_DO: DurableObjectNamespace;
  // EXAMPLE_R2_BUCKET: R2Bucket;
  // ANOTHER_ENV_VAR: string;
}

// Get the Runtime type from the Cloudflare adapter, using your defined CloudflareEnv
type Runtime = import('@astrojs/cloudflare').Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends Runtime {
    // If you have other custom properties on Astro.locals, define them here too.
    // For example:
    // session?: Session;
    // someOtherValue: string;
  }
} 