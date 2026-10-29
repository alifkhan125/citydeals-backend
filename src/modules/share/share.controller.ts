import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ShareService } from './share.service.js';

@ApiTags('Share')
@Controller('c')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get(':shareSlug/open')
  async openCoupon(@Param('shareSlug') shareSlug: string, @Res() response: Response) {
    const { coupon, stores } = await this.shareService.getCouponOpenPage(shareSlug);
    const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[char] || char);
    const safeSlug = encodeURIComponent(shareSlug);
    const deepLink = `citydeals://c/${safeSlug}`;
    const title = escapeHtml(coupon.title);
    const description = escapeHtml(coupon.description);
    const image = coupon.imageUrl ? `<meta property="og:image" content="${escapeHtml(coupon.imageUrl)}">` : '';
    const playStoreUrl = JSON.stringify(stores.playStoreUrl).replace(/</g, '\\u003c');
    const appStoreUrl = JSON.stringify(stores.appStoreUrl).replace(/</g, '\\u003c');
    const deepLinkJson = JSON.stringify(deepLink).replace(/</g, '\\u003c');

    response.type('html').send(`<!doctype html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${title} | CityDeals</title><meta name="description" content="${description}">
      <meta property="og:title" content="${title}"><meta property="og:description" content="${description}">${image}
      <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}.card{text-align:center;padding:32px;max-width:420px}a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#f97316;color:white;text-decoration:none}</style>
      </head><body><main class="card"><h1>${title}</h1><p>Opening this coupon in CityDeals…</p><a id="store">Get the CityDeals app</a></main>
      <script>(function(){var ua=navigator.userAgent||'';var ios=/iPad|iPhone|iPod/.test(ua);var store=ios?${appStoreUrl}:${playStoreUrl};var link=${deepLinkJson};document.getElementById('store').href=store;var started=Date.now();window.location.href=link;setTimeout(function(){if(!document.hidden&&Date.now()-started<2500)window.location.replace(store)},1800)})()</script>
      </body></html>`);
  }

  @Get(':shareSlug')
  getCouponShareData(@Param('shareSlug') shareSlug: string) {
    return this.shareService.getCouponShareData(shareSlug);
  }

  @Post(':shareSlug/track')
  trackCouponShare(
    @Param('shareSlug') shareSlug: string,
    @Body() body: { channel?: string; eventType?: 'SHARE' | 'OPEN' },
  ) {
    return this.shareService.trackCouponShare(shareSlug, body);
  }
}
