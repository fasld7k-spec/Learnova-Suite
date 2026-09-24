import { NextRequest,NextResponse } from 'next/server';
import { authCookieName, clearCookieOptions, twoFactorChallengeCookieName } from '@/lib/auth';
import { requestRedirectUrl } from '@/lib/redirect-url';
import { verifyCsrf } from '@/lib/csrf';
import { fail } from '@/lib/api';
export async function POST(req:NextRequest){const form=await req.formData().catch(()=>new FormData());if(!(await verifyCsrf(String(form.get('csrfToken')||''))))return fail('Invalid CSRF token.',403);const res=NextResponse.redirect(requestRedirectUrl(req,'/login?status=signed-out'), 303);res.cookies.set(authCookieName,'',clearCookieOptions());res.cookies.set(twoFactorChallengeCookieName,'',clearCookieOptions());return res}
