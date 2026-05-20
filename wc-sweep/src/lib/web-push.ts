import crypto from "crypto";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification using the Web Push protocol via fetch.
 * Uses VAPID for authentication.
 */
export async function sendPushNotification(
  subscriptionJson: string,
  title: string,
  body: string,
  url?: string
): Promise<{ success: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[WebPush] VAPID keys not configured, skipping");
    return { success: false, error: "VAPID keys not configured" };
  }

  let subscription: PushSubscription;
  try {
    subscription = JSON.parse(subscriptionJson);
  } catch {
    return { success: false, error: "Invalid subscription JSON" };
  }

  if (!subscription.endpoint) {
    return { success: false, error: "Missing endpoint in subscription" };
  }

  const payload = JSON.stringify({ title, body, url: url ?? "/" });

  try {
    // Build VAPID JWT
    const audience = new URL(subscription.endpoint).origin;
    const vapidHeaders = await generateVapidHeaders(audience);

    // Encrypt payload using subscription keys
    const encrypted = await encryptPayload(
      payload,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidHeaders.authorization,
        "Crypto-Key": vapidHeaders.cryptoKey,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "normal",
      },
      body: encrypted,
    });

    if (res.status === 201 || res.status === 200) {
      return { success: true };
    }

    const text = await res.text().catch(() => "");
    console.error(`[WebPush] Push failed: ${res.status} ${text}`);
    return {
      success: false,
      error: `Push endpoint returned ${res.status}`,
    };
  } catch (err) {
    console.error("[WebPush] Error:", err);
    return { success: false, error: String(err) };
  }
}

async function generateVapidHeaders(audience: string) {
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const jwtPayload = Buffer.from(
    JSON.stringify({
      aud: audience,
      exp: now + 12 * 3600,
      sub: "mailto:noreply@wc-sweep.vercel.app",
    })
  ).toString("base64url");

  const unsignedToken = `${jwtHeader}.${jwtPayload}`;

  // Import VAPID private key for signing
  const privateKeyBuffer = Buffer.from(VAPID_PRIVATE_KEY, "base64url");
  const sign = crypto.createSign("SHA256");
  sign.update(unsignedToken);

  // Build the EC private key in PKCS8 DER format
  const ecPrivateKey = buildEcPrivateKey(privateKeyBuffer);
  const signature = sign.sign(
    { key: ecPrivateKey, dsaEncoding: "ieee-p1363" },
  );

  const jwt = `${unsignedToken}.${Buffer.from(signature).toString("base64url")}`;

  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    cryptoKey: `p256ecdsa=${VAPID_PUBLIC_KEY}`,
  };
}

function buildEcPrivateKey(privateKeyRaw: Buffer): crypto.KeyObject {
  // P-256 private key in SEC1 format, wrapped in PKCS8
  const ecOid = Buffer.from("06082a8648ce3d030107", "hex"); // OID for P-256
  const ecAlgOid = Buffer.from("06072a8648ce3d0201", "hex"); // OID for EC

  const sec1Key = Buffer.concat([
    Buffer.from("3041020101042020", "hex").subarray(0, 7),
    Buffer.from([privateKeyRaw.length]),
    privateKeyRaw,
    Buffer.from("a00a", "hex"),
    ecOid,
  ]);

  // Wrap in PKCS8
  const algId = Buffer.concat([
    Buffer.from("3013", "hex"),
    ecAlgOid,
    ecOid,
  ]);

  const innerKey = Buffer.concat([
    Buffer.from("0420", "hex"),
    privateKeyRaw,
  ]);

  // Use crypto.createPrivateKey with JWK for simplicity
  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: privateKeyRaw.toString("base64url"),
      // Derive public key X,Y from private key is complex,
      // so we use the VAPID_PUBLIC_KEY
      x: Buffer.from(VAPID_PUBLIC_KEY, "base64url").subarray(1, 33).toString("base64url"),
      y: Buffer.from(VAPID_PUBLIC_KEY, "base64url").subarray(33, 65).toString("base64url"),
    },
    format: "jwk",
  });
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authKey: string
): Promise<Buffer> {
  const userPublicKey = Buffer.from(p256dhKey, "base64url");
  const userAuth = Buffer.from(authKey, "base64url");

  // Generate local ECDH keys
  const localKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const localPublicKey = localKeys.publicKey.export({ type: "spki", format: "der" });
  // Extract uncompressed point (last 65 bytes of SPKI)
  const localPublicRaw = localPublicKey.subarray(localPublicKey.length - 65);

  // ECDH shared secret
  const sharedSecret = crypto.diffieHellman({
    publicKey: crypto.createPublicKey({
      key: Buffer.concat([
        // SPKI prefix for P-256 uncompressed point
        Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex"),
        userPublicKey,
      ]),
      format: "der",
      type: "spki",
    }),
    privateKey: localKeys.privateKey,
  });

  // Generate salt
  const salt = crypto.randomBytes(16);

  // HKDF-based key derivation (RFC 8291)
  const ikm = hkdf(
    userAuth,
    sharedSecret,
    Buffer.concat([
      Buffer.from("WebPush: info\0"),
      userPublicKey,
      localPublicRaw,
    ]),
    32
  );

  const prk = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Encrypt with AES-128-GCM
  const payloadBuffer = Buffer.from(payload, "utf-8");
  const paddedPayload = Buffer.concat([payloadBuffer, Buffer.from([2])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", prk, nonce);
  const encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final()]);
  const tag = cipher.getAuthTag();

  // aes128gcm content coding header
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(encrypted.length + tag.length + 1 + 16 + 4 + 1 + 65, 0);

  const header = Buffer.concat([
    salt,                              // 16 bytes
    recordSize,                        // 4 bytes
    Buffer.from([localPublicRaw.length]), // 1 byte key length
    localPublicRaw,                    // 65 bytes
  ]);

  return Buffer.concat([header, encrypted, tag]);
}

function hkdf(
  salt: Buffer,
  ikm: Buffer,
  info: Buffer,
  length: number
): Buffer {
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const infoWithCounter = Buffer.concat([info, Buffer.from([1])]);
  const okm = crypto.createHmac("sha256", prk).update(infoWithCounter).digest();
  return okm.subarray(0, length);
}
