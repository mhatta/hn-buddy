import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const { env: cloudflareEnv } = locals.runtime;
  const LISTMONK_API_URL = cloudflareEnv.ASTRO_LISTMONK_API_URL;
  const LISTMONK_API_CREDENTIALS = cloudflareEnv.ASTRO_LISTMONK_API_KEY;

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

  try {
    const data = await request.formData();
    const email = data.get('email');
    const name = data.get('name') || ''; // Optional name field

    if (!email || typeof email !== 'string' || !validateEmail(email)) {
      return new Response(
        JSON.stringify({ message: 'Invalid email address provided.', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subscriberData = {
      email: email,
      name: name,
      status: 'enabled', // Or 'confirmed' if you have double opt-in emails set up in Listmonk
      lists: [1], // Subscribe to list ID 1
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
        // If parsing JSON fails, use the response text as a fallback
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

    // const responseData = await response.json(); // Contains subscriber details
    return new Response(
      JSON.stringify({
        message: "Successfully subscribed!",
        success: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing subscription:', error);
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