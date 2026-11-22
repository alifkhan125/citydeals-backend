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
    const escapeHtml = (value?: string | null) =>
      (value || '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
      })[char] || char);

    const safeSlug = encodeURIComponent(shareSlug);
    const deepLink = `citydeals://c/${safeSlug}`;
    const title = escapeHtml(coupon.title);
    const description = escapeHtml(coupon.description);
    const merchantName = escapeHtml(coupon.merchant?.name || 'Local Business');
    const merchantLogo = coupon.merchant?.logoUrl ? escapeHtml(coupon.merchant.logoUrl) : null;
    const areaName = escapeHtml(coupon.area?.name || coupon.area?.city || 'Local Area');
    const categoryName = escapeHtml(coupon.category?.name || 'Special Offer');
    const terms = escapeHtml(coupon.terms || '');
    const discussion = escapeHtml(coupon.discussion || '');
    const expiresFormatted = coupon.expiresAt
      ? new Date(coupon.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    const imageUrl = coupon.imageUrl ? escapeHtml(coupon.imageUrl) : '';
    const ogImageMeta = imageUrl ? `<meta property="og:image" content="${imageUrl}">\n<meta name="twitter:image" content="${imageUrl}">` : '';

    const playStoreUrl = JSON.stringify(stores.playStoreUrl || 'https://play.google.com').replace(/</g, '\\u003c');
    const appStoreUrl = JSON.stringify(stores.appStoreUrl || 'https://apps.apple.com').replace(/</g, '\\u003c');
    const baseUrl = JSON.stringify(stores.baseUrl || 'https://citydeals.app').replace(/</g, '\\u003c');
    const deepLinkJson = JSON.stringify(deepLink).replace(/</g, '\\u003c');

    response.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>${title} | ${merchantName} - CityDeals</title>
  <meta name="description" content="${description}">
  <meta property="og:site_name" content="CityDeals">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title} • ${merchantName}">
  <meta property="og:description" content="${description}">
  ${ogImageMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} • ${merchantName}">
  <meta name="twitter:description" content="${description}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 12px 32px;
    }
    .header-bar {
      width: 100%;
      max-width: 440px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 4px 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      font-weight: 800;
      color: #ea580c;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .brand-badge {
      background: #ea580c;
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      border: 1px solid #e2e8f0;
    }
    .banner-container {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 5;
      background: #000;
      overflow: hidden;
    }
    .banner-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .banner-overlay {
      position: absolute;
      top: 14px;
      left: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 10;
      max-width: 80%;
    }
    .merchant-logo {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: white;
      border: 2px solid white;
      object-fit: contain;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      flex-shrink: 0;
    }
    .merchant-info {
      text-shadow: 0 1px 4px rgba(0,0,0,0.85);
    }
    .merchant-name {
      color: #ffffff;
      font-weight: 800;
      font-size: 15px;
      line-height: 1.2;
    }
    .merchant-sub {
      color: #f1f5f9;
      font-size: 12px;
      font-weight: 600;
      margin-top: 2px;
    }
    .details {
      padding: 20px;
    }
    .category-tag {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      color: #ea580c;
      background: #fff7ed;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 14px;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .terms-box {
      background: #f8fafc;
      border-radius: 12px;
      padding: 12px;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 20px;
      border: 1px solid #f1f5f9;
      line-height: 1.4;
    }
    .claim-banner {
      background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
      color: white;
      border-radius: 18px;
      padding: 16px;
      text-align: center;
      margin-bottom: 16px;
    }
    .claim-banner h3 {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .claim-banner p {
      font-size: 13px;
      opacity: 0.95;
      line-height: 1.4;
    }
    .btn-claim {
      display: block;
      width: 100%;
      text-align: center;
      background: #ea580c;
      color: white;
      font-size: 16px;
      font-weight: 800;
      padding: 14px 20px;
      border-radius: 16px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
      border: none;
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .btn-claim:active {
      transform: scale(0.98);
    }
    .store-buttons {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    .store-btn {
      flex: 1;
      text-align: center;
      background: #0f172a;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 12px 10px;
      border-radius: 12px;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .footer-note {
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <a href="#" class="brand">CityDeals</a>
    <span class="brand-badge">Exclusive Offer</span>
  </div>

  <main class="card">
    <div class="banner-container">
      ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="banner-img">` : `<div style="width:100%;height:100%;background:#fed7aa;display:flex;align-items:center;justify-content:center;color:#ea580c;font-weight:800;font-size:24px;">CityDeals</div>`}
      <div class="banner-overlay">
        ${merchantLogo ? `<img src="${merchantLogo}" alt="${merchantName}" class="merchant-logo">` : ''}
        <div class="merchant-info">
          <div class="merchant-name">${merchantName}</div>
          <div class="merchant-sub">${categoryName} • ${areaName}</div>
        </div>
      </div>
    </div>

    <div class="details">
      <span class="category-tag">${categoryName}</span>
      <h1>${title}</h1>
      <p class="desc">${description}</p>

      ${terms || expiresFormatted || discussion ? `
        <div class="terms-box">
          ${expiresFormatted ? `<div><strong>Expires:</strong> ${expiresFormatted}</div>` : ''}
          ${discussion ? `<div>${discussion}</div>` : ''}
          ${terms ? `<div><strong>Terms:</strong> ${terms}</div>` : ''}
        </div>
      ` : ''}

      <div class="claim-banner">
        <h3>Claim This Deal In-Store</h3>
        <p>Show your phone to the cashier and redeem directly in the CityDeals app.</p>
      </div>

      <button id="claimBtn" class="btn-claim" type="button">Open & Redeem Deal</button>

      <div class="store-buttons">
        <a id="appStoreBtn" class="store-btn" href="#">App Store</a>
        <a id="playStoreBtn" class="store-btn" href="#">Google Play</a>
      </div>

      <p class="footer-note">Guest view • Download CityDeals to subscribe and claim unlimited local savings.</p>
    </div>
  </main>

  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isIOS = /iPad|iPhone|iPod/.test(ua);
      var isAndroid = /Android/.test(ua);
      var appStore = ${appStoreUrl};
      var playStore = ${playStoreUrl};
      var fallbackUrl = isIOS ? appStore : (isAndroid ? playStore : ${baseUrl});
      var deepLink = ${deepLinkJson};
      var safeSlug = ${JSON.stringify(safeSlug)};

      var claimBtn = document.getElementById('claimBtn');
      var appStoreBtn = document.getElementById('appStoreBtn');
      var playStoreBtn = document.getElementById('playStoreBtn');

      appStoreBtn.href = appStore;
      playStoreBtn.href = playStore;

      var androidIntent = "intent://c/" + safeSlug + "#Intent;scheme=citydeals;package=ai.citydeals.app;S.browser_fallback_url=" + encodeURIComponent(playStore) + ";end";

      function openDeal() {
        if (isAndroid) {
          window.location.href = androidIntent;
        } else if (isIOS) {
          var start = Date.now();
          window.location.href = deepLink;
          setTimeout(function() {
            if (!document.hidden && Date.now() - start < 3000) {
              window.location.replace(appStore);
            }
          }, 1200);
        } else {
          window.location.href = fallbackUrl;
        }
      }

      claimBtn.addEventListener('click', openDeal);

      // On mobile devices, automatically open app if installed, or redirect to Store if not installed
      if (isAndroid) {
        window.location.replace(androidIntent);
      } else if (isIOS) {
        var start = Date.now();
        window.location.href = deepLink;
        setTimeout(function() {
          if (!document.hidden && Date.now() - start < 3000) {
            window.location.replace(appStore);
          }
        }, 1200);
      }
    })();
  </script>
</body>
</html>`);
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
