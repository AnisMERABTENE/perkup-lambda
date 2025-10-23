// 🔐 VALIDATION DES FORMULAIRES D'AUTHENTIFICATION

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// 📧 Validation email
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email.trim()) {
    errors.push('L\'email est requis');
  } else if (!emailRegex.test(email)) {
    errors.push('Format d\'email invalide');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🔒 Validation mot de passe sécurisé
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Le mot de passe est requis');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Minimum 8 caractères');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Au moins une majuscule');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Au moins une minuscule');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Au moins un chiffre');
  }
  
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    errors.push('Au moins un caractère spécial');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 👤 Validation nom/prénom
export const validateName = (name: string, fieldName: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!name.trim()) {
    errors.push(`${fieldName} est requis`);
  } else if (name.trim().length < 2) {
    errors.push(`${fieldName} trop court (min. 2 caractères)`);
  } else if (name.trim().length > 50) {
    errors.push(`${fieldName} trop long (max. 50 caractères)`);
  } else if (!/^[a-zA-ZÀ-ÿ\s-']+$/.test(name)) {
    errors.push(`${fieldName} contient des caractères invalides`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ✅ Validation confirmation mot de passe
export const validatePasswordConfirmation = (
  password: string, 
  confirmPassword: string
): ValidationResult => {
  const errors: string[] = [];
  
  if (!confirmPassword) {
    errors.push('Confirmation requise');
  } else if (password !== confirmPassword) {
    errors.push('Les mots de passe ne correspondent pas');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🔢 Validation code de vérification
export const validateVerificationCode = (code: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!code.trim()) {
    errors.push('Code de vérification requis');
  } else if (!/^\d{6}$/.test(code.trim())) {
    errors.push('Le code doit contenir exactement 6 chiffres');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 📋 Validation complète formulaire d'inscription
export const validateRegisterForm = (data: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
}): ValidationResult => {
  const allErrors: string[] = [];
  
  // Valider tous les champs
  const firstnameResult = validateName(data.firstname, 'Le prénom');
  const lastnameResult = validateName(data.lastname, 'Le nom');
  const emailResult = validateEmail(data.email);
  const passwordResult = validatePassword(data.password);
  const confirmResult = validatePasswordConfirmation(data.password, data.confirmPassword);
  
  // Collecter toutes les erreurs
  allErrors.push(...firstnameResult.errors);
  allErrors.push(...lastnameResult.errors);
  allErrors.push(...emailResult.errors);
  allErrors.push(...passwordResult.errors);
  allErrors.push(...confirmResult.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
};

// 🔐 Validation formulaire de connexion
export const validateLoginForm = (data: {
  email: string;
  password: string;
}): ValidationResult => {
  const allErrors: string[] = [];
  
  const emailResult = validateEmail(data.email);
  if (!data.password.trim()) {
    allErrors.push('Le mot de passe est requis');
  }
  
  allErrors.push(...emailResult.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
};

// 🎨 Helper pour afficher les erreurs de façon user-friendly
export const formatValidationErrors = (errors: string[]): string => {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  
  return errors.map((error, index) => `• ${error}`).join('\n');
};

// 🔒 Force du mot de passe (pour indicateur visuel)
export const getPasswordStrength = (password: string): {
  score: number; // 0-4
  label: string;
  color: string;
} => {
  if (!password) return { score: 0, label: '', color: '#EF4444' };
  
  let score = 0;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*(),.?\":{}|<>]/.test(password)
  ];
  
  score = checks.filter(Boolean).length;
  
  const labels = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
  const colors = ['#EF4444', '#EF4444', '#F59E0B', '#F59E0B', '#10B981', '#10B981'];
  
  return {
    score,
    label: labels[score] || '',
    color: colors[score] || '#EF4444'
  };
};
