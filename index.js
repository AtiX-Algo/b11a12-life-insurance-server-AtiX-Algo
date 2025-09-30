const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import your Mongoose models
const User = require('./models/User');
const Agent = require('./models/Agent');
// Initialize the app
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---

const mongoURI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wknmybf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

mongoose.connect(mongoURI)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch(err => console.error('MongoDB connection error:', err));


// --- API Endpoints ---

// 1. Root endpoint to check if the server is running
app.get('/', (req, res) => {
  res.send('Aegis Life server is running!');
});

// 2. JWT Generation Endpoint
// Creates a token when a user logs in
app.post('/jwt', (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
})

// 3. Users Endpoint
// Saves a new user's information to the database
app.post('/users', async (req, res) => {
    const user = req.body;
    
    // Check if the user already exists in the database
    const query = { email: user.email }
    const existingUser = await User.findOne(query);

    if (existingUser) {
        // If user exists, don't save again, just send a confirmation message
        return res.send({ message: 'user already exists' });
    }
    
    // If user is new, create a new document and save it
    const newUser = new User(user);
    try {
        const result = await newUser.save();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: 'Failed to save user', error });
    }
});


// Fetches all agents from the database
app.get('/agents', async (req, res) => {
  try {
    const agents = await Agent.find({});
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching agents', error });
  }
});



// Start the server
app.listen(port, () => {
  console.log(`Aegis Life server is listening on port: ${port}`);
});