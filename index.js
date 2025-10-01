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
const Application = require('./models/Application');
const Payment = require('./models/Payment');

const verifyToken = require('./middleware/verifyToken');     
const verifyAdmin = require('./middleware/verifyAdmin');
const verifyAgent = require('./middleware/verifyAgent');

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// PDF generation imports
const pdf = require('pdf-creator-node');
const fs = require('fs');
const path = require('path');

// Initialize the app
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://aegis-life.web.app'
    ]
}));
app.use(express.json());

// --- MongoDB Connection ---

const mongoURI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wknmybf.mongodb.net/aegisLifeDB?retryWrites=true&w=majority&appName=Cluster0`;

mongoose.connect(mongoURI)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Ensure docs directory exists for PDF storage
const docsDir = path.join(__dirname, 'docs');
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

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

// --- BLOGS CRUD API ---

// MODIFY the main POST /blogs route to be accessible by Admins OR Agents
// It will now save the author's details from their token.
app.post('/blogs', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.decoded.email });
        if (user.role !== 'admin' && user.role !== 'agent') {
            return res.status(403).send({ message: 'Forbidden: Only admins or agents can post blogs.' });
        }
        
        const blogData = {
            ...req.body,
            authorName: user.name,
            authorEmail: user.email
        };

        const newBlog = new Blog(blogData);
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

// --- AGENT-SPECIFIC BLOG ROUTES ---

// GET all blogs for a specific agent
app.get('/blogs/agent/:email', verifyToken, verifyAgent, async (req, res) => {
    const agentEmail = req.params.email;
    if (req.decoded.email !== agentEmail) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    const blogs = await Blog.find({ authorEmail: agentEmail });
    res.send(blogs);
});

// Agent updates their OWN blog
app.patch('/blogs/agent/:id', verifyToken, verifyAgent, async (req, res) => {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    // Ownership check
    if (blog.authorEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: You can only edit your own posts.' });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(id, req.body, { new: true });
    res.send(updatedBlog);
});

// Agent deletes their OWN blog
app.delete('/blogs/agent/:id', verifyToken, verifyAgent, async (req, res) => {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    // Ownership check
    if (blog.authorEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: You can only delete your own posts.' });
    }

    const result = await Blog.findByIdAndDelete(id);
    res.send(result);
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
            return res.status(404).send({ message: 'Application not found' });
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

app.post('/reviews', verifyToken, async (req, res) => {
    try {
        const reviewData = req.body;
        const newReview = new Review(reviewData);
        const result = await newReview.save();
        res.status(201).send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to submit review', error });
    }
});

// --- PAYMENT API Endpoints (Private) ---

// Create a payment intent
app.post('/create-payment-intent', verifyToken, async (req, res) => {
    try {
        const { price } = req.body;
        const amount = parseInt(price * 100); // Stripe expects the amount in cents

        if (amount < 50) { // Stripe's minimum is typically $0.50
            return res.status(400).send({ error: 'Amount must be at least $0.50' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd', // Change to your desired currency
            payment_method_types: ['card']
        });

        res.send({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Save payment info to the database
app.post('/payments', verifyToken, async (req, res) => {
    try {
        const payment = req.body;
        const newPayment = new Payment(payment);
        const result = await newPayment.save();
        res.send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to save payment', error });
    }
});

// GET payment history for a user
app.get('/payments/user/:email', verifyToken, async (req, res) => {
    try {
        const email = req.params.email;
        
        // Verify the user is accessing their own payments
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'Forbidden: You can only access your own payments' });
        }

        const payments = await Payment.find({ userEmail: email }).sort({ paymentDate: -1 });
        res.send(payments);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching payment history', error });
    }
});

// GET all payments (Admin only)
app.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const payments = await Payment.find({}).sort({ paymentDate: -1 });
        res.send(payments);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching payments', error });
    }
});

// PATCH to submit a claim request for a policy
app.patch('/applications/claim/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { claimDetails } = req.body;
        
        const updatedApplication = await Application.findByIdAndUpdate(
            id,
            { 
                claimStatus: 'Pending',
                claimDetails: claimDetails
            },
            { new: true, runValidators: true }
        );

        if (!updatedApplication) {
            return res.status(404).send({ message: 'Application not found' });
        }
        res.send(updatedApplication);
    } catch (error) {
        res.status(400).send({ message: 'Failed to submit claim request', error });
    }
});

// GET all pending claim requests
app.get('/applications/claims/pending', verifyToken, verifyAgent, async (req, res) => {
    try {
        const pendingClaims = await Application.find({ claimStatus: 'Pending' });
        res.send(pendingClaims);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching pending claims', error });
    }
});

// PATCH to approve a claim
app.patch('/applications/claims/approve/:id', verifyToken, verifyAgent, async (req, res) => {
    try {
        const { id } = req.params;
        const approvedClaim = await Application.findByIdAndUpdate(
            id,
            { claimStatus: 'Approved' },
            { new: true }
        );
        if (!approvedClaim) {
            return res.status(404).send({ message: 'Application not found' });
        }
        res.send(approvedClaim);
    } catch (error) {
        res.status(400).send({ message: 'Failed to approve claim', error });
    }
});

// GET all applications for a specific customer by email
app.get('/applications/customer/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const applications = await Application.find({ applicantEmail: email });
    
    if (!applications) {
      return res.status(404).send({ message: 'No applications found for this user.' });
    }
    
    res.send(applications);
  } catch (error) {
    console.error('Error fetching customer applications:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});





app.get('/admin-stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const pendingApplications = await Application.countDocuments({ status: 'Pending' });
        const totalPolicies = await Policy.countDocuments();

        // --- FIX: Use the 'Payment' model instead of 'Transaction' ---
        const revenueAggregation = await Payment.aggregate([
            { $match: { status: 'success' } }, // Only count successful transactions
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

        res.send({
            totalUsers,
            pendingApplications,
            totalPolicies,
            totalRevenue
        });
    } catch (error) {
        console.error("Error fetching admin stats:", error);
        res.status(500).send({ message: "Failed to fetch admin statistics" });
    }
});


app.get('/applications/recent', async (req, res) => {
    try {
        const recentApplications = await Application.find({})
            .sort({ submissionDate: -1 }) // Sort by newest first
            .limit(5); // Get only the top 5
        res.send(recentApplications);
    } catch (error) {
        console.error("Error fetching recent applications:", error);
        res.status(500).send({ message: "Failed to fetch recent applications" });
    }
});


// GET a user's role by email
app.get('/users/role/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (req.decoded.email !== email) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    try {
        const user = await User.findOne({ email: email });
        res.send({ role: user?.role || 'customer' });
    } catch (error) {
        res.status(500).send({ message: 'Error fetching user role', error });
    }
});

// PATCH to update a user's name
app.patch('/users/profile/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (req.decoded.email !== email) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    try {
        const { name } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { name: name },
            { new: true }
        );
        res.send(updatedUser);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update profile', error });
    }
});

// --- API Endpoint for Policies ---
app.get('/policies', async (req, res) => {
    try {
        const { category, search, page = 1, limit = 9 } = req.query;
        const currentPage = parseInt(page);
        const limitPerPage = parseInt(limit);
        const skip = (currentPage - 1) * limitPerPage;

        const query = {};

        if (category) {
            query.category = category;
        }

        if (search) {
            // Add a case-insensitive regex search on the 'title' field
            query.title = { $regex: search, $options: 'i' };
        }

        const policies = await Policy.find(query).skip(skip).limit(limitPerPage);
        const total = await Policy.countDocuments(query);
        
        res.json({
            policies,
            totalPages: Math.ceil(total / limitPerPage),
            currentPage: currentPage
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching policies', error });
    }
});

// --- PDF Generation API (Private) ---
app.get('/applications/pdf/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const application = await Application.findById(id).lean(); // .lean() for a plain JS object

        if (!application || req.decoded.email !== application.applicantEmail) {
            return res.status(403).send({ message: 'Forbidden access' });
        }

        const html = fs.readFileSync(path.join(__dirname, 'templates/policy-template.html'), 'utf-8');
        const filename = `policy_${application._id}.pdf`;
        const documentPath = path.join(__dirname, 'docs', filename);

        const document = {
            html: html,
            data: {
                ...application,
                submissionDate: new Date(application.submissionDate).toLocaleDateString(),
                generationDate: new Date().toLocaleDateString()
            },
            path: documentPath,
            type: ""
        };

        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm'
        };

        await pdf.create(document, options);
        
        // Send the file for download
        res.download(documentPath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Delete the file from the server after download
            fs.unlinkSync(documentPath);
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error generating PDF', error });
    }
});


// GET the 4 latest blog posts for the home page
app.get('/blogs/latest', async (req, res) => {
    try {
        const latestBlogs = await Blog.find({}).sort({ publishDate: -1 }).limit(4);
        res.send(latestBlogs);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching latest blogs', error });
    }
});

// GET a single blog post by ID
app.get('/blogs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).send({ message: 'Blog post not found' });
        }
        res.send(blog);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching blog details', error });
    }
});


app.get('/agents/public', async (req, res) => {
    try {
        // Find top 3 users with the 'agent' role
        const agents = await User.find({ role: 'agent' }).limit(3);
        res.send(agents);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching public agents', error });
    }
});

// PATCH to increment the visit count of a blog
app.patch('/blogs/visit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Use MongoDB's $inc operator to efficiently increment the count
        const updatedBlog = await Blog.findByIdAndUpdate(id, { $inc: { visitCount: 1 } });
        if (!updatedBlog) {
            return res.status(404).send({ message: 'Blog post not found' });
        }
        res.send({ message: 'Visit count updated' });
    } catch (error) {
        res.status(400).send({ message: 'Failed to update visit count', error });
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Aegis Life server is listening on port: ${port}`);
});