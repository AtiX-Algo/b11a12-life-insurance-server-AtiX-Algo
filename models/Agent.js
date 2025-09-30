const mongoose = require('mongoose');
const { Schema } = mongoose;

const agentSchema = new Schema({
  name: { type: String, required: true },
  experience: { type: String, required: true },
  specialties: [String],
  photoUrl: { type: String, required: true }
});

const Agent = mongoose.model('Agent', agentSchema);

module.exports = Agent;