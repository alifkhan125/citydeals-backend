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

  const responses = await Promise.allSettled(
    validMessages.map((message) =>
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
          payload: {
            aps: {
              sound: 'default',
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
