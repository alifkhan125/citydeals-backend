import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface FirebasePushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function getServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) return JSON.parse(rawJson);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function getFirebaseMessaging() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(serviceAccount),
    });

  return getMessaging(app);
}

function stringifyData(data?: Record<string, unknown>) {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
  );
}

export function isApnsToken(token?: string | null): boolean {
  if (!token) return false;
  return /^[0-9a-fA-F]{64,}$/.test(token.trim());
}

export async function convertApnsToFcm(
  apnsToken: string,
  isSandbox: boolean = process.env.NODE_ENV !== 'production' || process.env.APNS_SANDBOX === 'true',
): Promise<string | null> {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  try {
    const cred = cert(serviceAccount);
    const tokenObj = await cred.getAccessToken();
    const accessToken = tokenObj?.access_token;
    if (!accessToken) return null;

    const res = await fetch('https://iid.googleapis.com/iid/v1:batchImport', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        access_token_auth: 'true',
      },
      body: JSON.stringify({
        application: process.env.APPLE_CLIENT_ID || 'ai.citydeals.app',
        sandbox: isSandbox,
        apns_tokens: [apnsToken.trim()],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[FCM] batchImport HTTP ${res.status} (sandbox=${isSandbox}): ${errBody}`);
      return null;
    }

    const data = (await res.json()) as any;
    const result = data?.results?.[0];
    if (result?.status === 'OK' && result?.registration_token) {
      console.log(`[FCM] Successfully converted APNs token to FCM (sandbox=${isSandbox}):`, result.registration_token.slice(0, 20) + '...');
      return result.registration_token;
    }

    console.warn(`[FCM] batchImport result status: ${result?.status} (sandbox=${isSandbox})`, JSON.stringify(data));
    return null;
  } catch (err) {
    console.warn('[FCM] APNs to FCM conversion error:', err);
    return null;
  }
}

export async function sendFirebasePushMessages(messages: FirebasePushMessage[]) {
  const messaging = getFirebaseMessaging();
  const validMessages = messages.filter((message) => message.token);
  if (!messaging || validMessages.length === 0) {
    return {
      sent: 0,
      skipped: messages.length,
      configured: Boolean(messaging),
      missingTokens: messages.length - validMessages.length,
      failures: [] as Array<{ index: number; message: string }>,
    };
  }

  // Pre-process messages: convert native iOS APNs tokens to FCM registration tokens
  const isDev = process.env.NODE_ENV !== 'production' || process.env.APNS_SANDBOX === 'true';
  const resolvedMessages = await Promise.all(
    validMessages.map(async (message) => {
      const trimmed = message.token.trim();
      if (isApnsToken(trimmed)) {
        const converted = await convertApnsToFcm(trimmed, isDev);
        if (converted) {
          return { ...message, token: converted, originalApnsToken: trimmed, triedSandbox: isDev };
        }
      }
      return { ...message, token: trimmed };
    }),
  );

  const responses = await Promise.allSettled(
    resolvedMessages.map(async (message: any) => {
      const payload = {
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: stringifyData(message.data),
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'deals',
            color: '#ea580c',
            sound: 'default',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: {
                title: message.title,
                body: message.body,
              },
              sound: 'default',
              badge: 0,
            },
          },
        },
      };

      try {
        return await messaging.send(payload);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        // If sending failed because APNs environment was mismatched, retry once with alternate sandbox setting
        if (message.originalApnsToken && message.triedSandbox !== undefined && errMsg.includes('APNs device token is invalid')) {
          const alternateSandbox = !message.triedSandbox;
          console.log(`[FCM] Retrying APNs send with alternate sandbox=${alternateSandbox}...`);
          const retryToken = await convertApnsToFcm(message.originalApnsToken, alternateSandbox);
          if (retryToken && retryToken !== message.token) {
            return await messaging.send({ ...payload, token: retryToken });
          }
        }
        throw err;
      }
    }),
  );

  const sent = responses.filter((response) => response.status === 'fulfilled').length;
  const failures = responses.flatMap((response, index) => {
    if (response.status === 'fulfilled') return [];
    const message = response.reason instanceof Error ? response.reason.message : String(response.reason);
    return [{ index, message }];
  });

  return {
    sent,
    skipped: messages.length - sent,
    configured: true,
    missingTokens: messages.length - validMessages.length,
    failures: failures.slice(0, 5),
  };
}
