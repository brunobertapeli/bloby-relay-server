import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';
import { authGoogleLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/auth/google', authGoogleLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
    );
    const tokenInfo = await tokenRes.json();

    if (tokenInfo.error_description || tokenInfo.error) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && tokenInfo.aud !== clientId) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfo = await userInfoRes.json();

    if (!userInfo.sub) {
      return res.status(401).json({ error: 'Failed to get user info' });
    }

    const db = getDb();
    const accounts = db.collection('accounts');

    let account = await accounts.findOne({ googleId: userInfo.sub });

    if (!account) {
      const result = await accounts.insertOne({
        googleId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });
      account = { _id: result.insertedId, ...userInfo };
    } else {
      await accounts.updateOne(
        { googleId: userInfo.sub },
        { $set: { lastLoginAt: new Date(), name: userInfo.name, picture: userInfo.picture } },
      );
    }

    const token = jwt.sign(
      {
        id: account._id.toString(),
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      user: { name: userInfo.name, email: userInfo.email, picture: userInfo.picture },
    });
  } catch (error) {
    console.error('[auth/google]', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/auth/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    res.json({
      user: { name: decoded.name, email: decoded.email, picture: decoded.picture },
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
