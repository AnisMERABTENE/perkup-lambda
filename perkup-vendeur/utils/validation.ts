// 📝 Validation des formulaires pour l'app vendeur

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// 📧 Validation email
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// 🔐 Validation mot de passe
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 📱 Validation téléphone français
export const validatePhoneNumber = (phone: string): boolean => {
  // Format français: 01 02 03 04 05 ou +33 1 02 03 04 05
  const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[.\-\s]?[0-9]{2}){4})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// 📮 Validation code postal français
export const validateZipCode = (zipCode: string): boolean => {
  const zipRegex = /^[0-9]{5}$/;
  return zipRegex.test(zipCode);
};

// 📝 Validation formulaire d'inscription vendeur
export const validateRegisterForm = (data: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
}): ValidationResult => {
  const errors: string[] = [];
  
  // Vérifications de base
  if (!data.firstname.trim()) {
    errors.push('Le prénom est obligatoire');
  } else if (data.firstname.trim().length < 2) {
    errors.push('Le prénom doit contenir au moins 2 caractères');
  }
  
  if (!data.lastname.trim()) {
    errors.push('Le nom est obligatoire');
  } else if (data.lastname.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }
  
  if (!data.email.trim()) {
    errors.push('L\'email est obligatoire');
  } else if (!validateEmail(data.email)) {
    errors.push('L\'email n\'est pas valide');
  }
  
  if (!data.password) {
    errors.push('Le mot de passe est obligatoire');
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }
  
  if (!data.confirmPassword) {
    errors.push('La confirmation du mot de passe est obligatoire');
  } else if (data.password !== data.confirmPassword) {
    errors.push('Les mots de passe ne correspondent pas');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🔐 Validation formulaire de connexion
export const validateLoginForm = (data: {
  email: string;
  password: string;
}): ValidationResult => {
  const errors: string[] = [];
  
  if (!data.email.trim()) {
    errors.push('L\'email est obligatoire');
  } else if (!validateEmail(data.email)) {
    errors.push('L\'email n\'est pas valide');
  }
  
  if (!data.password) {
    errors.push('Le mot de passe est obligatoire');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🏪 Validation formulaire de création de boutique
export const validateStoreForm = (data: {
  name: string;
  category: string;
  address: string;
  phone: string;
  discount: number;
  description?: string;
}): ValidationResult => {
  const errors: string[] = [];
  
  // Nom de la boutique
  if (!data.name.trim()) {
    errors.push('Le nom de la boutique est obligatoire');
  } else if (data.name.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  } else if (data.name.trim().length > 100) {
    errors.push('Le nom ne peut pas dépasser 100 caractères');
  }
  
  // Catégorie
  if (!data.category) {
    errors.push('La catégorie est obligatoire');
  }
  
  // Adresse
  if (!data.address.trim()) {
    errors.push('L\'adresse est obligatoire');
  } else if (data.address.trim().length < 10) {
    errors.push('L\'adresse doit être plus détaillée');
  }
  
  // Téléphone
  if (!data.phone.trim()) {
    errors.push('Le numéro de téléphone est obligatoire');
  } else if (!validatePhoneNumber(data.phone)) {
    errors.push('Le numéro de téléphone n\'est pas valide');
  }
  
  // Pourcentage de réduction
  if (data.discount < 3) {
    errors.push('Le pourcentage de réduction minimum est de 3%');
  } else if (data.discount > 100) {
    errors.push('Le pourcentage de réduction ne peut pas dépasser 100%');
  }
  
  // Description (optionnelle)
  if (data.description && data.description.length > 500) {
    errors.push('La description ne peut pas dépasser 500 caractères');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🌍 Validation coordonnées GPS
export const validateCoordinates = (latitude: number, longitude: number): boolean => {
  return (
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
};

// 🖼️ Validation URL d'image
export const validateImageUrl = (url: string): boolean => {
  if (!url) return true; // Optionnel
  const urlRegex = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
  return urlRegex.test(url);
};

// 📊 Utilitaires de formatage
export const formatPhoneNumber = (phone: string): string => {
  // Format: 01 02 03 04 05
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  return phone;
};

export const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`;
};

export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};