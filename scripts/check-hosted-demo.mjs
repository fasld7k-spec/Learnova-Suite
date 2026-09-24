const baseUrl = (process.argv[2] || process.env.BASE_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('Usage: node scripts/check-hosted-demo.mjs <VERIFIED_HTTPS_LIVE_PREVIEW_URL>');
  process.exit(1);
}

const blockedProductTerms = [
  ['Edu', 'Market'].join(''),
  ['edu', 'market'].join(''),
  ['Learnova', 'Pro'].join('-'),
  ['X', 'Twitter'].join('/'),
  ['Dark', 'LMS'].join(' '),
];
const blockedProductPattern = new RegExp(`${blockedProductTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|\\bEM\\b`);
const requiredPattern = /Learnova Suite/;
const frameworkErrorPattern = /Application error|Internal Server Error|This page could not be found|NEXT_HTTP_ERROR_FALLBACK|Unhandled Runtime Error/i;
const routeChecks = [
  { route: '/', includes: [/Learnova Suite/] },
  { route: '/demo', includes: [/demo/i] },
  { route: '/documentation', includes: [/Public documentation|Included buyer documentation/] },
  { route: '/courses', includes: [/course/i] },
  { route: '/courses/nextjs-saas-masterclass', includes: [/Next\.js|Masterclass|course/i] },
  { route: '/live-sessions', includes: [/live/i] },
  { route: '/checkout', includes: [/Checkout|cart/i] },
  { route: '/checkout/mock-gateway/stripe?orderId=hosted-demo-smoke&reference=hosted-demo-smoke', includes: [/Secure test checkout/, /Order not found|Confirm Test Payment/] },
  { route: '/payment/success?orderId=hosted-demo-smoke&gateway=stripe&reference=hosted-demo-smoke', includes: [/Sign in|Payment|status|order/i] },
  { route: '/api/version', includes: [/Learnova Suite/] },
];
const failures = [];

async function checkRoute({ route, includes = [] }) {
  const url = `${baseUrl}${route}`;
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();

  if (!response.ok) {
    failures.push(`${route} returned HTTP ${response.status}`);
    return;
  }

  if (blockedProductPattern.test(text)) {
    failures.push(`${route} contains an old product marker`);
  }

  if (frameworkErrorPattern.test(text)) {
    failures.push(`${route} contains a framework/runtime error marker`);
  }

  for (const pattern of includes) {
    if (!pattern.test(text)) {
      failures.push(`${route} is missing expected marker: ${pattern}`);
    }
  }

  if (route === '/api/version' && !requiredPattern.test(text)) {
    failures.push(`${route} does not report Learnova Suite`);
  }
}

async function checkAssistantChat() {
  const route = '/api/ai/assistant-chat';
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: baseUrl,
      referer: `${baseUrl}/`,
    },
    body: JSON.stringify({
      message: 'How do I buy a course?',
      history: [],
    }),
  });

  if (!response.ok) {
    failures.push(`${route} returned HTTP ${response.status}`);
    return;
  }

  const data = await response.json().catch(() => null);
  const answer = String(data?.data?.answer || '');
  if (!data?.success || !/\/courses|checkout|cart/i.test(answer)) {
    failures.push(`${route} did not return a practical course/checkout answer`);
  }
}

for (const routeCheck of routeChecks) {
  try {
    await checkRoute(routeCheck);
  } catch (error) {
    failures.push(`${routeCheck.route} failed: ${error.message}`);
  }
}

try {
  await checkAssistantChat();
} catch (error) {
  failures.push(`/api/ai/assistant-chat failed: ${error.message}`);
}

if (failures.length) {
  console.error('Hosted demo check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Hosted demo check passed for ${baseUrl}`);
