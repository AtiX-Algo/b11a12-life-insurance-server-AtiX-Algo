const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentSchema = new Schema({
    email: { type: String, required: true },
    price: { type: Number, required: true },
    transactionId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;