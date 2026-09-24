import { getCsrfToken } from '@/lib/csrf';
export async function CsrfInput(){const token=await getCsrfToken();return <input type="hidden" name="csrfToken" value={token}/>}
