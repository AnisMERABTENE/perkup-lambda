import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema({
  name: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  address: String,
  city: String,
  zipCode: String,
  country: String,
});

const Partner = mongoose.models.Partner || mongoose.model("Partner", partnerSchema);

export default Partner;
