const mongoose = require('mongoose');
const { Schema } = mongoose;

const blogSchema = new Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String, required: true },
    authorName: { type: String, required: true },
    authorEmail: { type: String, required: true },
    publishDate: { type: Date, default: Date.now },
    visitCount: { type: Number, default: 0 }
});

const Blog = mongoose.model('Blog', blogSchema);
module.exports = Blog;