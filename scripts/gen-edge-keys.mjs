// Generate an Ed25519 keypair for carrier tickets.
//   node scripts/gen-edge-keys.mjs
// Prints:
//   EDGE_TICKET_SK  — base64 PKCS8 DER  → set as a Railway backend env var (SECRET)
//   EDGE_TICKET_PK  — base64url raw 32B → set as the edge worker var EDGE_TICKET_PK
import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const skDer = privateKey.export({ format: 'der', type: 'pkcs8' });
const jwk = publicKey.export({ format: 'jwk' }); // { kty:'OKP', crv:'Ed25519', x:'<b64url raw>' }

console.log('EDGE_TICKET_SK=' + Buffer.from(skDer).toString('base64'));
console.log('EDGE_TICKET_PK=' + jwk.x); // base64url raw 32-byte public key
