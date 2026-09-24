const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const password = process.env.DEMO_PASSWORD || 'password123';
const sameOriginPostHeaders = {
  'content-type': 'application/x-www-form-urlencoded',
  origin: baseUrl,
  referer: `${baseUrl}/login`
};

const publicChecks = [
  { path: '/', includes: ['Learnova Suite'] },
  { path: '/?previewTheme=theme-1', includes: ['data-home-theme-id="theme-1"', 'data-home-theme-layout="modern-minimal"'] },
  { path: '/?previewTheme=theme-2', includes: ['data-home-theme-id="theme-2"', 'data-home-theme-layout="bold-vibrant"'] },
  { path: '/?previewTheme=theme-3', includes: ['data-home-theme-id="theme-3"', 'data-home-theme-layout="classic-academic"'] },
  { path: '/?previewTheme=theme-4', includes: ['data-home-theme-id="theme-4"', 'data-home-theme-layout="dark-tech"'] },
  { path: '/?previewTheme=theme-5', includes: ['data-home-theme-id="theme-5"', 'data-home-theme-layout="editorial-magazine"'] },
  { path: '/?previewTheme=theme-6', includes: ['data-home-theme-id="theme-6"', 'data-home-theme-layout="glass-pastel"'] },
  { path: '/?previewTheme=theme-7', includes: ['data-home-theme-id="theme-7"', 'data-home-theme-layout="learnova-default"'] },
  { path: '/courses', includes: ['Courses'] },
  { path: '/courses/nextjs-saas-masterclass', includes: ['Next.js SaaS Masterclass'] },
  { path: '/demo', includes: ['Reviewer path', 'Suggested QA journey', 'admin@demo.com'] },
  { path: '/documentation', includes: ['Public documentation', 'Included buyer documentation'] },
  { path: '/instructors', includes: ['Instructor'] },
  { path: '/live-sessions', includes: ['Live'] },
  { path: '/login', includes: ['/api/auth/login', 'name="email"', 'name="password"'] },
  { path: '/register', includes: ['/api/auth/register', 'name="email"', 'name="password"'] },
  { path: '/install-check', includes: ['Installation and launch readiness'] }
];

const roleChecks = [
  {
    email: 'admin@demo.com',
    dashboardRedirect: '/admin',
    checks: [
      { path: '/admin', includes: ['Admin'] },
      { path: '/admin/theme', includes: ['Theme 1 - Modern/Minimal', 'Activate', 'Customize', 'Reset all themes'] },
      { path: '/admin/theme/theme-1', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/theme-2', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/theme-3', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/theme-4', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/theme-5', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/theme-6', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/theme-7', includes: ['Theme visual controls', 'Upload hero image', 'Save Theme'] },
      { path: '/admin/theme/global', includes: ['Shared visual tokens', 'Save Global Tokens'] },
      { path: '/admin/settings', includes: ['Settings'] },
      { path: '/admin/marketplace-health', includes: ['Operational queues', 'Health Status'] },
      { path: '/admin/categories', includes: ['Catalog taxonomy', 'Taxonomy health'] },
      { path: '/admin/announcements', includes: ['Broadcast center', 'Delivery readiness'] },
      { path: '/admin/seo-meta', includes: ['Search appearance', 'Metadata readiness'] },
      { path: '/admin/support-tags', includes: ['Support taxonomy', 'Triage readiness'] },
      { path: '/admin/sla', includes: ['Support operations', 'Coverage readiness'] },
      { path: '/admin/vendors', includes: ['Partner network', 'Vendor readiness'] },
      { path: '/admin/tenants', includes: ['Enterprise workspaces', 'Workspace readiness'] },
      { path: '/admin/career-tracks', includes: ['Career navigation', 'Path readiness'] },
      { path: '/admin/cookie-categories', includes: ['Consent center', 'Consent coverage'] },
      { path: '/admin/product-updates', includes: ['Release notes', 'Changelog readiness'] },
      { path: '/admin/webhook-endpoints', includes: ['Integration delivery', 'Delivery readiness'] },
      { path: '/admin/data-retention', includes: ['Compliance operations', 'Retention coverage'] },
      { path: '/admin/feature-flags', includes: ['Release control', 'Flag readiness'] },
      { path: '/admin/tax-rates', includes: ['Checkout compliance', 'Tax coverage'] },
      { path: '/admin/seo-redirects', includes: ['Search migration', 'Redirect hygiene'] },
      { path: '/admin/vendor-contracts', includes: ['Partner agreements', 'Contract coverage'] },
      { path: '/admin/live-sessions', includes: ['Reviewer checks', 'Public live page'] },
      { path: '/admin/orders', includes: ['Revenue In View', 'Payment Exceptions'] },
      { path: '/admin/courses', includes: ['Course Review Queue', 'Reviewer QA Signals'] },
      { path: '/admin/instructors', includes: ['Instructor Review Desk', 'Approval Checklist'] },
      { path: '/admin/payment-methods', includes: ['Checkout Method Registry', 'Create Or Update Method'] },
      { path: '/admin/pages', includes: ['CMS Inventory', 'Create CMS Page'] },
      { path: '/admin/blog', includes: ['Editorial Calendar', 'Create Editorial Post'] },
      { path: '/admin/security', includes: ['Watermark logo URL', 'Upload watermark logo'] },
      { path: '/admin/languages', includes: ['Single active site language', 'Set as only active language'] },
      { path: '/admin/notifications', includes: ['Notification operations', 'Notification control center'] },
      { path: '/admin/messages', includes: ['Admin message operations', 'Conversation health'] },
      { path: '/admin/support', includes: ['Support command center', 'Support health'] },
      { path: '/admin/push-campaigns', includes: ['Push Campaigns', 'Send immediately and create live notifications'] }
    ]
  },
  {
    email: 'instructor@demo.com',
    dashboardRedirect: '/instructor',
    checks: [
      { path: '/instructor', includes: ['Instructor'] },
      { path: '/instructor/analytics', includes: ['Instructor Analytics', 'Course performance'] },
      { path: '/instructor/courses', includes: ['Course production pipeline', 'Course Catalog'] },
      { path: '/instructor/students', includes: ['Unique Students', 'Average Progress'] },
      { path: '/instructor/availability', includes: ['Availability'] },
      { path: '/instructor/mentor-programs', includes: ['Mentorship commerce', 'Offer readiness'] },
      { path: '/instructor/live-sessions', includes: ['Live Sessions'] },
      { path: '/instructor/notifications', includes: ['Notifications', 'Activity inbox'] }
    ]
  },
  {
    email: 'student@demo.com',
    dashboardRedirect: '/student',
    checks: [
      { path: '/student', includes: ['Student'] },
      { path: '/student/my-courses', includes: ['Courses'] },
      { path: '/student/recommendations', includes: ['Personalized catalog', 'Recommendations'] },
      { path: '/student/invoices', includes: ['Paid invoices', 'Total paid'] },
      { path: '/student/live-sessions', includes: ['Live Session Schedule', 'Available sessions'] },
      { path: '/notifications', includes: ['Notifications', 'Priority notification inbox'] },
      { path: '/messages', includes: ['Advanced message hub', 'Live priority inbox'] },
      { path: '/learn/nextjs-saas-masterclass', includes: ['Protected streaming is enabled', '/api/media/access?token='] }
    ]
  }
];

function fail(message) {
  throw new Error(message);
}

async function request(path, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual'
  });
  const text = await response.text();
  return { response, text };
}

function cookiePairFromSetCookie(setCookie, name) {
  return String(setCookie || '')
    .split(/,\s*(?=[^;,]+=)/)
    .map((value) => value.split(';')[0])
    .find((value) => value.startsWith(`${name}=`)) || '';
}

function mergeCookiePair(cookie, pair) {
  if (!pair) return cookie;
  const [name] = pair.split('=');
  const parts = String(cookie || '')
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith(`${name}=`));
  parts.push(pair);
  return parts.join('; ');
}

async function expectPage({ path, includes = [] }, cookie = '') {
  const { response, text } = await request(path, cookie);
  if (response.status < 200 || response.status >= 400) {
    fail(`${path} returned HTTP ${response.status}`);
  }
  for (const marker of includes) {
    if (!text.includes(marker)) fail(`${path} did not include "${marker}"`);
  }
  return { path, status: response.status, length: text.length };
}

async function expectRedirect(path, cookie, expectedLocation) {
  const { response, text } = await request(path, cookie);
  const location = response.headers.get('location') || '';
  const nextRedirectDigest = response.status === 200 && text.includes('NEXT_REDIRECT') && text.includes(expectedLocation);
  if (!nextRedirectDigest && (![303, 307, 308].includes(response.status) || !location.includes(expectedLocation))) {
    fail(`${path} did not redirect to ${expectedLocation}; got HTTP ${response.status} ${location}`);
  }
  return { path, status: response.status, redirect: location || expectedLocation };
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: sameOriginPostHeaders,
    body: new URLSearchParams({ email, password }),
    redirect: 'manual'
  });
  const setCookie = response.headers.get('set-cookie') || '';
  const cookie = cookiePairFromSetCookie(setCookie, 'learnova_token');
  if (response.status !== 303 || !cookie) fail(`Login failed for ${email} with HTTP ${response.status}`);
  return cookie;
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) fail(`/api/health returned HTTP ${response.status}`);
  const data = await response.json();
  if (!data?.success || data?.data?.database !== 'connected') fail('/api/health did not report a connected database');
  return { path: '/api/health', status: response.status, database: data.data.database };
}

async function checkRegistrationPost() {
  const email = 'smoke-demo@example.test';
  const existing = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: sameOriginPostHeaders,
    body: new URLSearchParams({ email, password }),
    redirect: 'manual'
  });
  if (existing.status === 303) return { path: '/api/auth/register', status: 200, detail: 'existing smoke user' };

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      ...sameOriginPostHeaders,
      referer: `${baseUrl}/register`
    },
    body: new URLSearchParams({ name: 'Smoke Tester', email, password, role: 'STUDENT' }),
    redirect: 'manual'
  });
  if (response.status !== 303) fail(`/api/auth/register returned HTTP ${response.status}`);
  const location = response.headers.get('location') || '';
  if (!location.includes('/account?registered=1')) fail(`/api/auth/register redirected to unexpected location: ${location}`);
  return { path: '/api/auth/register', status: response.status };
}

async function checkAssistantChat() {
  const response = await fetch(`${baseUrl}/api/ai/assistant-chat`, {
    method: 'POST',
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

  if (!response.ok) fail(`/api/ai/assistant-chat returned HTTP ${response.status}`);

  const data = await response.json();
  const answer = String(data?.data?.answer || '');
  if (!data?.success || !/\/courses|checkout|cart/i.test(answer)) {
    fail('/api/ai/assistant-chat did not return a practical course/checkout answer');
  }

  return { path: '/api/ai/assistant-chat', status: response.status, detail: 'site-aware assistant answered' };
}

async function checkCartFlow(cookie) {
  const coursePath = '/courses/nextjs-saas-masterclass';
  const firstCourseResponse = await request(coursePath, cookie);
  const csrfCookie = cookiePairFromSetCookie(firstCourseResponse.response.headers.get('set-cookie'), 'csrf_token');
  const csrfCookieHeader = mergeCookiePair(cookie, csrfCookie);
  const { text } = await request(coursePath, csrfCookieHeader);
  const courseId = text.match(/name="courseId" value="([^"]+)"/)?.[1];
  const addCsrfToken = text.match(/name="csrfToken" value="([^"]*)"/)?.[1] || '';
  if (!courseId) fail(`${coursePath} did not expose a cart courseId`);
  if (!addCsrfToken) fail(`${coursePath} did not expose a CSRF token`);

  const response = await fetch(`${baseUrl}/api/cart/add`, {
    method: 'POST',
    headers: {
      ...sameOriginPostHeaders,
      referer: `${baseUrl}${coursePath}`,
      cookie: csrfCookieHeader,
    },
    body: new URLSearchParams({ courseId, csrfToken: addCsrfToken }),
    redirect: 'manual'
  });
  const location = response.headers.get('location') || '';
  if (response.status !== 303 || !location.includes('/cart')) fail(`/api/cart/add returned HTTP ${response.status} ${location}`);

  const cart = await expectPage({ path: '/cart', includes: ['Next.js SaaS Masterclass', 'Checkout'] }, csrfCookieHeader);
  const checkout = await expectPage({ path: '/checkout', includes: ['Cart'] }, csrfCookieHeader);
  const cartResponse = await request('/cart', csrfCookieHeader);
  const csrfToken = cartResponse.text.match(/name="csrfToken" value="([^"]*)"/)?.[1] || '';
  const checkoutResponse = await fetch(`${baseUrl}/api/cart/checkout`, {
    method: 'POST',
    headers: {
      ...sameOriginPostHeaders,
      referer: `${baseUrl}/cart`,
      cookie: csrfCookieHeader,
    },
    body: new URLSearchParams({ gateway: 'stripe', csrfToken }),
    redirect: 'manual'
  });
  const checkoutLocation = checkoutResponse.headers.get('location') || '';
  if (checkoutResponse.status !== 303 || !checkoutLocation.includes('/checkout/mock-gateway/stripe')) {
    fail(`/api/cart/checkout returned HTTP ${checkoutResponse.status} ${checkoutLocation}`);
  }

  const mockUrl = new URL(checkoutLocation, baseUrl);
  const mockPath = `${mockUrl.pathname}${mockUrl.search}`;
  const mockPage = await expectPage({ path: mockPath, includes: ['Secure test checkout', 'Confirm Test Payment'] }, csrfCookieHeader);
  const orderId = mockUrl.searchParams.get('orderId') || '';
  const reference = mockUrl.searchParams.get('reference') || '';
  if (!orderId || !reference) fail('Mock checkout redirect did not include orderId and reference');

  const successResponse = await fetch(`${baseUrl}/api/payments/mock/success`, {
    method: 'POST',
    headers: {
      ...sameOriginPostHeaders,
      referer: `${baseUrl}${mockPath}`,
      cookie: csrfCookieHeader,
    },
    body: new URLSearchParams({ orderId, gateway: 'stripe', reference, csrfToken }),
    redirect: 'manual'
  });
  const successLocation = successResponse.headers.get('location') || '';
  if (successResponse.status !== 303 || !successLocation.includes('/payment/success')) {
    fail(`/api/payments/mock/success returned HTTP ${successResponse.status} ${successLocation}`);
  }
  const successUrl = new URL(successLocation, baseUrl);
  const success = await expectPage({ path: `${successUrl.pathname}${successUrl.search}`, includes: ['Payment confirmed', 'Open invoice'] }, csrfCookieHeader);

  return [
    { path: '/api/cart/add', status: response.status, detail: 'course added to cart' },
    cart,
    checkout,
    { path: '/api/cart/checkout', status: checkoutResponse.status, detail: 'mock checkout created' },
    mockPage,
    { path: '/api/payments/mock/success', status: successResponse.status, detail: 'mock payment confirmed' },
    success
  ];
}

async function main() {
  const results = [];
  results.push(await checkHealth());
  for (const check of publicChecks) results.push(await expectPage(check));
  results.push(await checkAssistantChat());
  results.push(await checkRegistrationPost());

  for (const role of roleChecks) {
    const cookie = await login(role.email);
    results.push({ email: role.email, ...(await expectRedirect('/dashboard', cookie, role.dashboardRedirect)) });
    if (role.email === 'student@demo.com') {
      for (const result of await checkCartFlow(cookie)) results.push({ email: role.email, ...result });
    }
    for (const check of role.checks) {
      results.push({ email: role.email, ...(await expectPage(check, cookie)) });
    }
  }

  console.log(`Smoke test passed for ${baseUrl}`);
  for (const result of results) {
    const owner = result.email ? `${result.email} ` : '';
    console.log(`OK ${owner}${result.path} ${result.status}`);
  }
}

main().catch((error) => {
  console.error(`Smoke test failed for ${baseUrl}`);
  console.error(error.message);
  process.exit(1);
});
