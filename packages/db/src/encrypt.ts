const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

let cachedKey: CryptoKey | undefined;

async function getKey(): Promise<CryptoKey> {
    if (cachedKey) return cachedKey;

    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY env var is required");

    const keyBytes =
        raw.length === 64
            ? hexToBytes(raw)
            : Buffer.from(raw, "base64");

    if (keyBytes.length !== 32) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)");
    }

    cachedKey = await crypto.subtle.importKey(
        "raw",
        keyBytes instanceof Buffer ? keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer : keyBytes.buffer as ArrayBuffer,
        ALGORITHM,
        false,
        ["encrypt", "decrypt"]
    );
    return cachedKey;
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

export async function encrypt(plaintext: string): Promise<string> {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextWithTag = await crypto.subtle.encrypt(
        {name: ALGORITHM, iv, tagLength: TAG_LENGTH},
        key,
        encoded
    );

    const combined = new Uint8Array(IV_LENGTH + ciphertextWithTag.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertextWithTag), IV_LENGTH);

    return Buffer.from(combined).toString("base64url");
}

export async function decrypt(stored: string): Promise<string> {
    const key = await getKey();
    const combined = Buffer.from(stored, "base64url");
    const iv = combined.subarray(0, IV_LENGTH);
    const ciphertextWithTag = combined.subarray(IV_LENGTH);

    const plaintext = await crypto.subtle.decrypt(
        {name: ALGORITHM, iv, tagLength: TAG_LENGTH},
        key,
        ciphertextWithTag
    );

    return new TextDecoder().decode(plaintext);
}
