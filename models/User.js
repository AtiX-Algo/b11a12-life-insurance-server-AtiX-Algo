const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, default: 'customer' },
  photoURL: { type: String }, 
  experience: { type: String, default: 'N/A' },
  specialties: { type: [String], default: [] } 
});

const User = mongoose.model('User', userSchema);

module.exports = User;