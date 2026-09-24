/**
 * Strips <script> tags and HTML event-handler attributes from a string.
 * This is a lightweight, regex-based sanitizer for defence-in-depth.
 * For rich user-generated HTML, consider a dedicated library like DOMPurify
 * on the client or sanitize-html on the server.
 */

// Matches <script ...>...</script> blocks (case-insensitive, dotAll)
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;

// Matches inline event-handler attributes: onclick=, onerror=, onload=, etc.
const EVENT_HANDLER_ATTR_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

// Matches javascript: URIs in href/src/action attributes
const JAVASCRIPT_URI_RE = /\b(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi;

/**
 * Sanitizes an HTML string by removing <script> tags and event-handler
 * attributes (onclick, onerror, onload, etc.) and javascript: URIs.
 *
 * @param input - Raw HTML or user-supplied string
 * @returns Sanitized string safe for rendering
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(SCRIPT_TAG_RE, '')
    .replace(EVENT_HANDLER_ATTR_RE, '')
    .replace(JAVASCRIPT_URI_RE, (_, attr) => `${attr}="#"`);
}
