import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGO_URI);

    isConnected = true;
    console.log("✅ MongoDB connecté (Lambda)");
  } catch (err) {
    console.error("❌ Erreur connexion MongoDB:", err);
    throw new Error("Erreur de connexion DB");
  }
};
