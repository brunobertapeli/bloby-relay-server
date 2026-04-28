import { Mppx, tempo } from 'mppx/server';

const TEMPO_USDC = '0x20c000000000000000000000b9537d11c60e8b50';

let _mppx;

/**
 * Lazy-init the MPP server handler. Reads:
 *   - TREASURY_WALLET_ADDRESS — recipient for all USDC charges
 *   - MPP_SECRET_KEY          — auto-detected by Mppx.create() for HMAC-bound challenges
 */
export function getMppx() {
  if (_mppx) return _mppx;

  const recipient = process.env.TREASURY_WALLET_ADDRESS;
  if (!recipient) throw new Error('[mpp] TREASURY_WALLET_ADDRESS not set');
  if (!process.env.MPP_SECRET_KEY) throw new Error('[mpp] MPP_SECRET_KEY not set');

  _mppx = Mppx.create({
    methods: [
      tempo({
        currency: TEMPO_USDC,
        recipient,
      }),
    ],
  });
  return _mppx;
}
