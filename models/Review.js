const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema({
    userName: { type: String, required: true },
    userImage: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, required: true },
    reviewDate: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;