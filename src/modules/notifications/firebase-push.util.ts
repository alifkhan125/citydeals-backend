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
  return /^[0-9a-fA-F]{64,128}$/.test(token.trim());
}

export async function convertApnsToFcm(apnsToken: string, isSandbox = false): Promise<string | null> {
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
      if (!isSandbox) {
        return convertApnsToFcm(apnsToken, true);
      }
      return null;
    }

    const data = (await res.json()) as any;
    const result = data?.results?.[0];
    if (result?.status === 'OK' && result?.registration_token) {
      console.log(`[FCM] Successfully converted APNs token to FCM (sandbox=${isSandbox}):`, result.registration_token.slice(0, 20) + '...');
      return result.registration_token;
    }

    console.warn(`[FCM] batchImport result status: ${result?.status} (sandbox=${isSandbox})`, JSON.stringify(data));
    if (!isSandbox) {
      return convertApnsToFcm(apnsToken, true);
    }
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
  const resolvedMessages = await Promise.all(
    validMessages.map(async (message) => {
      let token = message.token.trim();
      if (isApnsToken(token)) {
        const converted = await convertApnsToFcm(token);
        if (converted) token = converted;
      }
      return { ...message, token };
    }),
  );

  const responses = await Promise.allSettled(
    resolvedMessages.map((message) =>
      messaging.send({
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: stringifyData(message.data),
        android: {
          priority: 'high',
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
      }),
    ),
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
