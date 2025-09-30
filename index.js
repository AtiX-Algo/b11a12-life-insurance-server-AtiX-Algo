const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import your Mongoose models
const User = require('./models/User');
const Agent = require('./models/Agent');
const Policy = require('./models/Policy'); 
const Blog = require('./models/Blog');
const Review = require('./models/Review');
const Subscriber = require('./models/Subscriber');

const verifyToken = require('./middleware/verifyToken');     
const verifyAdmin = require('./middleware/verifyAdmin');
const Application = require('./models/Application');

// Initialize the app
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---

const mongoURI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wknmybf.mongodb.net/aegisLifeDB?retryWrites=true&w=majority&appName=Cluster0`;

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

app.get('/policies', async (req, res) => {
    try {
        const category = req.query.category;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;

        const query = {};
        if (category) {
            query.category = category;
        }

        const policies = await Policy.find(query).skip(skip).limit(limit);
        const total = await Policy.countDocuments(query);
        
        res.json({
            policies,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching policies', error });
    }
});


app.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find({}).sort({ publishDate: -1 }); // Show newest first
        res.json(blogs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blogs', error });
    }
});

// GET all users (Admin only)
app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({});
        res.send(users);
    } catch (error) {
        res.status(500).send({ message: "Error fetching users", error });
    }
});


// GET endpoint to check if a user is an admin
app.get('/users/admin/:email', verifyToken, async (req, res) => {
    const email = req.params.email;

    // Check if the decoded email from the token matches the requested email
    if (req.decoded.email !== email) {
        return res.send({ admin: false });
    }

    const user = await User.findOne({ email: email });
    const result = { admin: user?.role === 'admin' };
    res.send(result);
});


// CREATE a new policy (Admin only)
app.post('/policies', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const newPolicy = new Policy(req.body);
        const result = await newPolicy.save();
        res.status(201).send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to create policy', error });
    }
});

// UPDATE a policy (Admin only)
app.patch('/policies/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedPolicy = await Policy.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!updatedPolicy) {
            return res.status(404).send({ message: 'Policy not found' });
        }
        res.send(updatedPolicy);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update policy', error });
    }
});

// DELETE a policy (Admin only)
app.delete('/policies/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPolicy = await Policy.findByIdAndDelete(id);
        if (!deletedPolicy) {
            return res.status(404).send({ message: 'Policy not found' });
        }
        res.send({ message: 'Policy deleted successfully', deletedPolicy });
    } catch (error) {
        res.status(500).send({ message: 'Failed to delete policy', error });
    }
});



// CREATE a new blog post (Admin only)
app.post('/blogs', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const newBlog = new Blog(req.body);
        const result = await newBlog.save();
        res.status(201).send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to create blog post', error });
    }
});

// UPDATE a blog post (Admin only)
app.patch('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedBlog = await Blog.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!updatedBlog) {
            return res.status(404).send({ message: 'Blog post not found' });
        }
        res.send(updatedBlog);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update blog post', error });
    }
});

// DELETE a blog post (Admin only)
app.delete('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBlog = await Blog.findByIdAndDelete(id);
        if (!deletedBlog) {
            return res.status(404).send({ message: 'Blog post not found' });
        }
        res.send({ message: 'Blog post deleted successfully', deletedBlog });
    } catch (error) {
        res.status(500).send({ message: 'Failed to delete blog post', error });
    }
});


// GET Popular Policies
app.get('/policies/popular', async (req, res) => {
    try {
        // Find top 6 policies sorted by purchaseCount in descending order
        const popularPolicies = await Policy.find({}).sort({ purchaseCount: -1 }).limit(6);
        res.send(popularPolicies);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching popular policies', error });
    }
});

// GET Recent Reviews
app.get('/reviews', async (req, res) => {
    try {
        // Find latest 5 reviews
        const reviews = await Review.find({}).sort({ reviewDate: -1 }).limit(5);
        res.send(reviews);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching reviews', error });
    }
});

// POST a new newsletter subscriber
app.post('/subscribe', async (req, res) => {
    try {
        const email = req.body.email;
        const existingSubscriber = await Subscriber.findOne({ email });
        if (existingSubscriber) {
            return res.status(409).send({ message: 'This email is already subscribed.' });
        }
        const newSubscriber = new Subscriber({ email });
        await newSubscriber.save();
        res.status(201).send({ message: 'Subscription successful!' });
    } catch (error) {
        res.status(400).send({ message: 'Subscription failed.', error });
    }
});


// GET a single policy by ID
app.get('/policies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const policy = await Policy.findById(id);
        if (!policy) {
            return res.status(404).send({ message: 'Policy not found' });
        }
        res.send(policy);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching policy details', error });
    }
});
 
// POST a new application
app.post('/applications', verifyToken, async (req, res) => {
    try {
        const newApplication = new Application(req.body);
        const result = await newApplication.save();
        res.status(201).send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to submit application', error });
    }
});


// GET all applications
app.get('/applications', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const applications = await Application.find({}).sort({ submissionDate: -1 }); // Show newest first
        res.send(applications);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching applications', error });
    }
});

// PATCH to update an application's status
app.patch('/applications/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Find the application and update its status
        const updatedApplication = await Application.findByIdAndUpdate(
            id,
            { status: status },
            { new: true, runValidators: true }
        );

        if (!updatedApplication) {
            return res.status(404).send({ message: 'Application not found' });
        }

        res.send(updatedApplication);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update application status', error });
    }
});

// PATCH to update a user's role (Admin only)
app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { role: role },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).send({ message: 'User not found' });
        }
        res.send(updatedUser);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update user role', error });
    }
});

// GET all users with the 'agent' role
app.get('/users/agents', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const agents = await User.find({ role: 'agent' });
        res.send(agents);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching agents', error });
    }
});

// PATCH to update an application (assign agent or change status)
app.patch('/applications/:id', verifyToken, async (req, res) => {
    // Note: Both admin and agent can use this. We'll add specific role checks if needed.
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedApplication = await Application.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedApplication) {
            return res.status(44).send({ message: 'Application not found' });
        }
        
        // If an application is approved, increment the policy's purchaseCount
        if (updateData.status === 'Approved') {
            await Policy.findByIdAndUpdate(updatedApplication.policyId, { $inc: { purchaseCount: 1 } });
        }

        res.send(updatedApplication);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update application', error });
    }
});

// --- AGENT ONLY ROUTES ---

// GET endpoint to check if a user is an agent
app.get('/users/agent/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (req.decoded.email !== email) {
        return res.send({ agent: false });
    }
    const user = await User.findOne({ email: email });
    const result = { agent: user?.role === 'agent' };
    res.send(result);
});

// GET applications assigned to a specific agent
app.get('/applications/agent/:email', verifyToken, async (req, res) => {
    try {
        const agentEmail = req.params.email;
        const agent = await User.findOne({ email: agentEmail });
        if (!agent) {
            return res.status(404).send({ message: 'Agent not found' });
        }
        const assignedApplications = await Application.find({ agentId: agent._id });
        res.send(assignedApplications);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching assigned applications', error });
    }
});



// Start the server
app.listen(port, () => {
  console.log(`Aegis Life server is listening on port: ${port}`);
});