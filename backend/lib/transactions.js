import { getDb } from '../db.js';

/**
 * Record a transaction for a skill download or service usage.
 *
 * Skills:  upsert once (usageCount stays 1).
 * Services: upsert and increment usageCount on each call.
 *
 * @param {object} opts
 * @param {string} opts.productId     - e.g. "whatsapp", "test"
 * @param {"skill"|"service"} opts.productType
 * @param {string} opts.productName   - human-readable name
 * @param {string} opts.botUsername    - the bot that acquired/used it
 * @param {string|null} opts.accountId - owner account (null if unclaimed)
 * @param {number} opts.unitPrice     - price per use (0 for free)
 */
export async function recordTransaction({
  productId,
  productType,
  productName,
  botUsername,
  accountId = null,
  unitPrice = 0,
}) {
  const col = getDb().collection('transactions');
  const now = new Date();

  // Normalize accountId to string for consistent querying (dashboard JWT uses strings)
  const normalizedAccountId = accountId ? accountId.toString() : null;

  if (productType === 'skill') {
    // Skills: insert once, ignore if already exists
    await col.updateOne(
      { botUsername, productId },
      {
        $setOnInsert: {
          productType,
          productName,
          botUsername,
          accountId: normalizedAccountId,
          unitPrice,
          totalSpent: unitPrice,
          usageCount: 1,
          firstAt: now,
          lastAt: now,
        },
      },
      { upsert: true },
    );
  } else {
    // Services: upsert + increment
    await col.updateOne(
      { botUsername, productId },
      {
        $setOnInsert: {
          productType,
          productName,
          botUsername,
          accountId: normalizedAccountId,
          unitPrice,
          firstAt: now,
        },
        $inc: { usageCount: 1, totalSpent: unitPrice },
        $set: { lastAt: now },
      },
      { upsert: true },
    );
  }
}
