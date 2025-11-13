import crypto from 'crypto';
import secureLogger from './secureLogger.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

const looksLikePlainSecret = (value = '') => /^[0-9a-fA-F]{40,}$/.test(value);

const getEncryptionKey = () => {
  const rawKey = process.env.CARD_SECRET_KEY;
  if (!rawKey) {
    throw new Error('CARD_SECRET_KEY non défini (clé symétrique base64 de 32 octets requise)');
  }
  const keyBuffer = Buffer.from(rawKey, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('CARD_SECRET_KEY doit être une clé 256 bits encodée en base64');
  }
  return keyBuffer;
};

export const encryptSecret = (plaintext) => {
  if (!plaintext) {
    throw new Error('Impossible de chiffrer un secret vide');
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    encrypted.toString('base64'),
    authTag.toString('base64')
  ].join(':');
};

export const decryptSecret = (ciphertext) => {
  if (!ciphertext || !ciphertext.startsWith(`${VERSION}:`)) {
    return null;
  }

  try {
    const [_version, ivB64, payloadB64, tagB64] = ciphertext.split(':');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadB64, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    secureLogger.error('❌ Impossible de déchiffrer le secret de carte digitale', error.message);
    return null;
  }
};

export const getDigitalCardSecret = async (digitalCard) => {
  if (!digitalCard) {
    throw new Error('DigitalCard introuvable');
  }

  const decrypted = decryptSecret(digitalCard.secret);
  if (decrypted) {
    return decrypted;
  }

  if (looksLikePlainSecret(digitalCard.secret)) {
    // Secret legacy non chiffré : le chiffrer puis le retourner
    const plaintext = digitalCard.secret;
    digitalCard.secret = encryptSecret(plaintext);
    try {
      await digitalCard.save();
      secureLogger.info('🔐 Secret de carte digitale migré vers stockage chiffré', {
        cardId: digitalCard._id?.toString?.()
      });
    } catch (error) {
      secureLogger.error('❌ Impossible de sauvegarder le secret chiffré', error.message);
    }
    return plaintext;
  }

  throw new Error('Secret de carte digitale illisible');
};

export default {
  encryptSecret,
  decryptSecret,
  getDigitalCardSecret
};
