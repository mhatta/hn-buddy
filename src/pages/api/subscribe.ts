import type { APIRoute } from 'astro';

// Interface for the Turnstile verification response
interface TurnstileVerificationResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string; 
  hostname?: string;
  action?: string;
  cdata?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const { env: cloudflareEnv } = locals.runtime;
  const LISTMONK_API_URL = cloudflareEnv.ASTRO_LISTMONK_API_URL;
  const LISTMONK_API_CREDENTIALS = cloudflareEnv.ASTRO_LISTMONK_API_KEY;
  const turnstileSecretKeyFromEnv = cloudflareEnv.ASTRO_TURNSTILE_SECRET_KEY;

  if (!LISTMONK_API_URL || !LISTMONK_API_CREDENTIALS) {
    console.error("Listmonk API URL or Credentials not set for subscription.");
    return new Response(
      JSON.stringify({
        message: "Subscription service is not configured correctly.",
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate Turnstile Secret Key
  let validatedTurnstileSecretKey: string;
  if (typeof turnstileSecretKeyFromEnv === 'string' && turnstileSecretKeyFromEnv.trim() !== '') {
    validatedTurnstileSecretKey = turnstileSecretKeyFromEnv;
  } else {
    console.error("Turnstile secret key (ASTRO_TURNSTILE_SECRET_KEY) is not configured or is not a valid non-empty string.");
    return new Response(
      JSON.stringify({ message: 'Security check configuration error.', success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let formData;
  let turnstileTokenValue: string;

  try {
    formData = await request.formData();
    const rawTurnstileToken = formData.get('cf-turnstile-response');

    if (typeof rawTurnstileToken !== 'string' || rawTurnstileToken.trim() === '') {
      return new Response(
        JSON.stringify({ message: 'Invalid or missing security token. Please try again.', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    turnstileTokenValue = rawTurnstileToken;

    const verificationURL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const verificationBody = new URLSearchParams();
    verificationBody.append('secret', validatedTurnstileSecretKey);
    verificationBody.append('response', turnstileTokenValue);
    const clientIP = request.headers.get('CF-Connecting-IP');
    if (clientIP) {
      verificationBody.append('remoteip', clientIP);
    }

    const verificationResponse = await fetch(verificationURL, {
      method: 'POST',
      body: verificationBody,
    });

    const verificationResult = await verificationResponse.json() as TurnstileVerificationResponse;

    if (!verificationResult.success) {
      console.warn('Turnstile verification failed:', verificationResult['error-codes']);
      return new Response(
        JSON.stringify({ 
          message: 'Security check failed. Please try again.',
          success: false, 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    console.error("Error during Turnstile verification or form data parsing:", e);
    return new Response(
      JSON.stringify({ message: 'Error processing security check.', success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const emailValue = formData.get('email');
    const nameValue = formData.get('name');
    
    const email = typeof emailValue === 'string' ? emailValue : '';
    const name = typeof nameValue === 'string' ? nameValue : '';

    if (!email || !validateEmail(email)) {
      return new Response(
        JSON.stringify({ message: 'Invalid email address provided.', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subscriberData = {
      email: email,
      name: name,
      status: 'enabled', 
      lists: [1], 
    };

    const encodedCredentials = btoa(LISTMONK_API_CREDENTIALS);
    const subscribeUrl = `${LISTMONK_API_URL}/api/subscribers`;

    const response = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedCredentials}`,
      },
      body: JSON.stringify(subscriberData),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        const textResponse = await response.text();
        errorData = { message: textResponse || `Subscription failed with status ${response.status}.` };
      }
      console.error(`Listmonk subscription failed (Status ${response.status}):`, errorData);
      const errorMessage = (typeof errorData === 'object' && errorData !== null && 'message' in errorData) 
                            ? String(errorData.message) 
                            : `Subscription failed with status ${response.status}.`;
      return new Response(
        JSON.stringify({ message: errorMessage, success: false, errorDetail: errorData }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "登録に成功しました! HN 日々のまとめを毎日 8:00 AM UTC にメールでお送りします。",
        success: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing subscription after Turnstile check:', error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(
      JSON.stringify({ message: `Error processing subscription: ${errorMessage}`, success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function validateEmail(email: string): boolean {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
} 