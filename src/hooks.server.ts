import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);

    // Prevent the app from being embedded in iframes on other domains
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    // Stop browsers from sniffing the MIME type of responses
    response.headers.set('X-Content-Type-Options', 'nosniff');
    // Only send the origin (no path) in the Referer header when navigating away
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Disable access to hardware APIs this app doesn't use
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return response;
};
