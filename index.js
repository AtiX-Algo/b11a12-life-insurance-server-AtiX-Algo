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

// =================================================================
// --- API ROUTES - ORGANIZED AND DEDUPLICATED ---
// =================================================================

// --- Public Routes (No Authentication Required) ---

// 1. Root endpoint
app.get('/', (req, res) => {
  res.send('Aegis Life server is running!');
});

// 2. Get public agents (fixed route)
app.get('/agents/public', async (req, res) => {
    try {
        // Find top 3 users with the 'agent' role
        const agents = await User.find({ role: 'agent' }).limit(3);
        res.send(agents);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching public agents', error });
    }
});

// 3. Get all agents
app.get('/agents', async (req, res) => {
  try {
    const agents = await Agent.find({});
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching agents', error });
  }
});

// 4. Get policies with search, filter, and pagination
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

// 5. Get single policy by ID
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

// 6. Get popular policies
app.get('/policies/popular', async (req, res) => {
    try {
        const popularPolicies = await Policy.find({}).sort({ purchaseCount: -1 }).limit(6);
        res.send(popularPolicies);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching popular policies', error });
    }
});

// 7. Get all blogs
app.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find({}).sort({ publishDate: -1 });
        res.json(blogs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blogs', error });
    }
});

// 8. Get latest blogs
app.get('/blogs/latest', async (req, res) => {
    try {
        const latestBlogs = await Blog.find({}).sort({ publishDate: -1 }).limit(4);
        res.send(latestBlogs);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching latest blogs', error });
    }
});

// 9. Get single blog by ID
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

// 10. Increment blog visit count
app.patch('/blogs/visit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedBlog = await Blog.findByIdAndUpdate(id, { $inc: { visitCount: 1 } });
        if (!updatedBlog) {
            return res.status(404).send({ message: 'Blog post not found' });
        }
        res.send({ message: 'Visit count updated' });
    } catch (error) {
        res.status(400).send({ message: 'Failed to update visit count', error });
    }
});

// 11. Get recent reviews
app.get('/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({}).sort({ reviewDate: -1 }).limit(5);
        res.send(reviews);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching reviews', error });
    }
});

// 12. Newsletter subscription
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

// --- Authentication Routes ---

// 13. JWT Generation
app.post('/jwt', (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
});

// 14. User registration
app.post('/users', async (req, res) => {
    const user = req.body;
    
    const query = { email: user.email }
    const existingUser = await User.findOne(query);

    if (existingUser) {
        return res.send({ message: 'user already exists' });
    }
    
    const newUser = new User(user);
    try {
        const result = await newUser.save();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: 'Failed to save user', error });
    }
});

// --- Private Routes (All Logged-in Users) ---

// 15. Get user role
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

// 16. Update user profile
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

// 17. Submit application
app.post('/applications', verifyToken, async (req, res) => {
    try {
        const newApplication = new Application(req.body);
        const result = await newApplication.save();
        res.status(201).send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to submit application', error });
    }
});

// 18. Submit claim request
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

// 19. Get customer applications
app.get('/applications/customer/:email', verifyToken, async (req, res) => {
    try {
        const email = req.params.email;
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        const applications = await Application.find({ applicantEmail: email }).sort({ submissionDate: -1 });
        res.send(applications);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching applications', error });
    }
});

// 20. Submit review
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

// 21. Payment intent creation
app.post('/create-payment-intent', verifyToken, async (req, res) => {
    try {
        const { price } = req.body;
        const amount = parseInt(price * 100);

        if (amount < 50) {
            return res.status(400).send({ error: 'Amount must be at least $0.50' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
        });

        res.send({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 22. Save payment
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

// 23. Get user payments
app.get('/payments/user/:email', verifyToken, async (req, res) => {
    try {
        const email = req.params.email;
        
        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'Forbidden: You can only access your own payments' });
        }

        const payments = await Payment.find({ userEmail: email }).sort({ paymentDate: -1 });
        res.send(payments);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching payment history', error });
    }
});

// 24. Generate PDF
app.get('/applications/pdf/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const application = await Application.findById(id).lean();

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
        
        res.download(documentPath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            fs.unlinkSync(documentPath);
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error generating PDF', error });
    }
});

// --- Agent & Admin Shared Routes ---

// 25. Create blog (Admin or Agent)
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

// 26. Update application (Admin or Agent)
app.patch('/applications/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedApplication = await Application.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedApplication) {
            return res.status(404).send({ message: 'Application not found' });
        }
        
        if (updateData.status === 'Approved') {
            await Policy.findByIdAndUpdate(updatedApplication.policyId, { $inc: { purchaseCount: 1 } });
        }

        res.send(updatedApplication);
    } catch (error) {
        res.status(400).send({ message: 'Failed to update application', error });
    }
});

// --- Agent Only Routes ---

// 27. Check if user is agent
app.get('/users/agent/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (req.decoded.email !== email) {
        return res.send({ agent: false });
    }
    const user = await User.findOne({ email: email });
    const result = { agent: user?.role === 'agent' };
    res.send(result);
});

// 28. Get agent's applications
app.get('/applications/agent/:email', verifyToken, verifyAgent, async (req, res) => {
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

// 29. Get agent's blogs
app.get('/blogs/agent/:email', verifyToken, verifyAgent, async (req, res) => {
    const agentEmail = req.params.email;
    if (req.decoded.email !== agentEmail) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    const blogs = await Blog.find({ authorEmail: agentEmail });
    res.send(blogs);
});

// 30. Update agent's own blog
app.patch('/blogs/agent/:id', verifyToken, verifyAgent, async (req, res) => {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    if (blog.authorEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: You can only edit your own posts.' });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(id, req.body, { new: true });
    res.send(updatedBlog);
});

// 31. Delete agent's own blog
app.delete('/blogs/agent/:id', verifyToken, verifyAgent, async (req, res) => {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    if (blog.authorEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: You can only delete your own posts.' });
    }

    const result = await Blog.findByIdAndDelete(id);
    res.send(result);
});

// 32. Get pending claims
app.get('/applications/claims/pending', verifyToken, verifyAgent, async (req, res) => {
    try {
        const pendingClaims = await Application.find({ claimStatus: 'Pending' });
        res.send(pendingClaims);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching pending claims', error });
    }
});

// 33. Approve claim
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

// --- Admin Only Routes ---

// 34. Get all users
app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({});
        res.send(users);
    } catch (error) {
        res.status(500).send({ message: "Error fetching users", error });
    }
});

// 35. Check if user is admin
app.get('/users/admin/:email', verifyToken, async (req, res) => {
    const email = req.params.email;

    if (req.decoded.email !== email) {
        return res.send({ admin: false });
    }

    const user = await User.findOne({ email: email });
    const result = { admin: user?.role === 'admin' };
    res.send(result);
});

// 36. Update user role
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

// 37. Get all agents (users with agent role)
app.get('/users/agents', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const agents = await User.find({ role: 'agent' });
        res.send(agents);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching agents', error });
    }
});

// 38. Get all applications
app.get('/applications', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const applications = await Application.find({}).sort({ submissionDate: -1 });
        res.send(applications);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching applications', error });
    }
});

// 39. Create policy
app.post('/policies', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const newPolicy = new Policy(req.body);
        const result = await newPolicy.save();
        res.status(201).send(result);
    } catch (error) {
        res.status(400).send({ message: 'Failed to create policy', error });
    }
});

// 40. Update policy
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

// 41. Delete policy
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

// 42. Update any blog (admin)
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

// 43. Delete any blog (admin)
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

// 44. Get all payments
app.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const payments = await Payment.find({}).sort({ paymentDate: -1 });
        res.send(payments);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching payments', error });
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Aegis Life server is listening on port: ${port}`);
});