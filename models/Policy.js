const mongoose = require('mongoose');
const { Schema } = mongoose;

const policySchema = new Schema({
    title: { type: String, required: true },
    category: { type: String, required: true }, // e.g., "Term Life", "Senior Plan"
    details: { type: String, required: true },
    image: { type: String, required: true },
    coverage: { type: String, required: true }, // e.g., "Up to $500,000"
    term: { type: String, required: true }, // e.g., "20 Years"
    purchaseCount: { type: Number, default: 0 }
});

const Policy = mongoose.model('Policy', policySchema);
module.exports = Policy;