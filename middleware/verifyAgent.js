const User = require('../models/User'); // Make sure the path to your User model is correct

const verifyAgent = async (req, res, next) => {
    // Get the email from the decoded token (which was set by the verifyToken middleware)
    const email = req.decoded.email;

    // Find the user in the database using their email
    const query = { email: email };
    const user = await User.findOne(query);

    // Check if the user's role is 'agent'
    if (user?.role !== 'agent') {
        // If not an agent, send a 403 Forbidden status and stop the request
        return res.status(403).send({ error: true, message: 'Forbidden access: This action is for agents only.' });
    }
    
    // If the user is an agent, proceed to the next function in the chain (the route handler)
    next();
};

module.exports = verifyAgent;