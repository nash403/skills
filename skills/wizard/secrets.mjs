#!/usr/bin/env node
// Key pair and decryption for the secret fields of a UI wizard (template.html).
// The page encrypts each secret with the public key (RSA-OAEP-256 wrapping an
// AES-256-GCM key), so only the holder of the private key can read it.
//
//   node secrets.mjs keygen <private-key-path>
//     Writes the private key (mode 600) and prints the public key to paste
//     into the wizard config's `publicKey`.
//   node secrets.mjs decrypt <private-key-path> <value | answers.json>
//     Prints the plaintext of one encrypted value, or the exported answers
//     JSON with every encrypted value decrypted.

import {
  constants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PREFIX = "wizard-enc:v1:";
const [command, keyPath, input] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (command === "keygen") {
  if (!keyPath) fail("usage: node secrets.mjs keygen <private-key-path>");
  if (existsSync(keyPath)) fail(`${keyPath} already exists, refusing to overwrite it.`);
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  writeFileSync(keyPath, privateKey, { mode: 0o600 });
  console.log(publicKey.toString("base64"));
} else if (command === "decrypt") {
  if (!keyPath || !input) {
    fail("usage: node secrets.mjs decrypt <private-key-path> <value | answers.json>");
  }
  const key = readFileSync(keyPath, "utf8");

  const decrypt = (value) => {
    const [wrapped, iv, sealed] = value.slice(PREFIX.length).split(".").map((part) => Buffer.from(part, "base64"));
    const aesKey = privateDecrypt(
      { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      wrapped,
    );
    // WebCrypto appends the 16-byte GCM tag to the ciphertext.
    const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
    decipher.setAuthTag(sealed.subarray(-16));
    return Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]).toString("utf8");
  };

  const decryptDeep = (value) => {
    if (typeof value === "string") return value.startsWith(PREFIX) ? decrypt(value) : value;
    if (Array.isArray(value)) return value.map(decryptDeep);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decryptDeep(v)]));
    }
    return value;
  };

  if (input.startsWith(PREFIX)) console.log(decrypt(input));
  else console.log(JSON.stringify(decryptDeep(JSON.parse(readFileSync(input, "utf8"))), null, 2));
} else {
  fail("usage: node secrets.mjs <keygen | decrypt> ...");
}
