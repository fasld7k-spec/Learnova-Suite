import QRCode from 'qrcode';
import { NextRequest } from 'next/server';
import { certificateLookupCandidates, getCertificateAddon } from '@/lib/certificates';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const addon = await getCertificateAddon();
  if (!addon.active || !addon.showQrCode) return new Response('QR add-on is disabled', { status: 404 });

  const { code: codeParam } = await params;
  const codes = certificateLookupCandidates(decodeURIComponent(codeParam), addon.prefix);
  const cert = await prisma.certificate.findFirst({ where: { code: { in: codes } }, select: { code: true } });
  if (!cert) return new Response('Certificate not found', { status: 404 });

  const verifyUrl = `${req.nextUrl.origin}/certificates/verify?code=${encodeURIComponent(cert.code)}`;
  const svg = await QRCode.toString(verifyUrl, {
    type: 'svg',
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
