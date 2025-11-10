import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';

export const updateVendorProfileHandler = async (event) => {
  const userId = event.context.user.id;
  const { input } = event.args;

  if (!input || Object.keys(input).length === 0) {
    throw new Error('Aucune donnée fournie pour la mise à jour');
  }

  const {
    firstname,
    lastname,
    email,
    currentPassword,
    newPassword,
    confirmNewPassword
  } = input;

  const user = await User.findById(userId);
  if (!user || user.role !== 'vendor') {
    throw new Error('Utilisateur vendeur introuvable');
  }

  const updates = {};
  const trimmedFirstname = firstname?.trim();
  const trimmedLastname = lastname?.trim();
  const trimmedEmail = email?.trim()?.toLowerCase();

  if (trimmedFirstname && trimmedFirstname !== user.firstname) {
    updates.firstname = trimmedFirstname;
  }

  if (trimmedLastname && trimmedLastname !== user.lastname) {
    updates.lastname = trimmedLastname;
  }

  const wantsPasswordChange = Boolean(newPassword || confirmNewPassword);

  const verifyCurrentPassword = async () => {
    if (!currentPassword) {
      throw new Error('Le mot de passe actuel est requis pour cette opération');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Mot de passe actuel incorrect');
    }
  };

  if (trimmedEmail && trimmedEmail !== user.email) {
    await verifyCurrentPassword();

    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser && existingUser._id.toString() !== userId) {
      throw new Error('Cet email est déjà utilisé par un autre compte');
    }

    updates.email = trimmedEmail;
  }

  if (wantsPasswordChange) {
    await verifyCurrentPassword();

    if (!newPassword || !confirmNewPassword) {
      throw new Error('Le nouveau mot de passe et sa confirmation sont requis');
    }

    if (newPassword !== confirmNewPassword) {
      throw new Error('Les nouveaux mots de passe ne correspondent pas');
    }

    if (newPassword.length < 8) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères');
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      throw new Error('Le nouveau mot de passe doit être différent de l\'actuel');
    }

    updates.password = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Aucune modification détectée');
  }

  const previousEmail = user.email;

  Object.assign(user, updates, { updatedAt: new Date() });
  await user.save();
  await UserCache.invalidateAllUserCache(userId, previousEmail);

  return {
    message: 'Profil mis à jour avec succès',
    user: {
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    }
  };
};

export default updateVendorProfileHandler;
