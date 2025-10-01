import dotenv from "dotenv";

dotenv.config();

// Service email de développement (mock)
export const sendVerificationEmail = async (email, code) => {
  if (process.env.NODE_ENV === 'development') {
    // En mode développement, on simule l'envoi d'email
    console.log(`📧 [MOCK EMAIL] Envoi simulé à ${email}`);
    console.log(`🔑 [CODE VERIFICATION] ${code}`);
    console.log(`📝 [EMAIL CONTENT] Bienvenue sur PerkUP! Votre code: ${code}`);
    return Promise.resolve();
  }

  // En production, utiliser AWS SES
  const AWS = await import("aws-sdk");
  const ses = new AWS.SES({
    region: process.env.SES_REGION,
  });

  const params = {
    Source: process.env.EMAIL_SOURCE,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: { Data: "Vérification de votre compte PerkUP" },
      Body: {
        Html: {
          Data: `
            <h2>Bienvenue sur PerkUP 🎉</h2>
            <p>Voici votre code de vérification :</p>
            <h3>${code}</h3>
          `,
        },
      },
    },
  };

  try {
    await ses.sendEmail(params).promise();
    console.log(`📩 Email envoyé à ${email}`);
  } catch (err) {
    console.error("❌ Erreur envoi email:", err);
    throw new Error("Erreur lors de l'envoi de l'email");
  }
};
