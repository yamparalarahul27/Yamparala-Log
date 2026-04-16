/**
 * Normalize a URL for duplicate detection.
 *
 * Strips tracking params, www prefix, trailing slashes, fragments,
 * normalizes protocol to https, and maps host aliases (twitter→x).
 */

const TRACKING_PARAMS = new Set([
  // UTM
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  // Click IDs
  "fbclid", "gclid", "msclkid", "igshid", "twclid",
  // Share / ref
  "ref", "ref_src", "ref_url",
  // X/Twitter
  "s", "si", "t",
  // Mailchimp
  "mc_cid", "mc_eid",
  // Other
  "source", "feature",
]);

const HOST_ALIASES: Record<string, string> = {
  "twitter.com": "x.com",
  "m.facebook.com": "facebook.com",
  "mobile.twitter.com": "x.com",
};

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);

    // Force https
    u.protocol = "https:";

    // Lowercase and strip www
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");

    // Map host aliases
    if (HOST_ALIASES[u.hostname]) {
      u.hostname = HOST_ALIASES[u.hostname];
    }

    // Handle youtu.be → youtube.com
    if (u.hostname === "youtu.be") {
      const videoId = u.pathname.slice(1);
      u.hostname = "youtube.com";
      u.pathname = "/watch";
      u.searchParams.set("v", videoId);
    }

    // Strip tracking query params
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }

    // Sort remaining params for consistent order
    u.searchParams.sort();

    // Strip fragment
    u.hash = "";

    // Remove trailing slash from path (keep root "/")
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    // If URL parsing fails, return as-is lowercase trimmed
    return raw.trim().toLowerCase();
  }
}
