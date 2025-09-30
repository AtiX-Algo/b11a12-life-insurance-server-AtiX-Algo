const User = require('../models/User'); // Adjust the path as necessary

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email; // Get email from the previous verifyToken middleware
    
    const query = { email: email };
    const user = await User.findOne(query);

    if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'Forbidden access: Not an admin' });
    }
    
    next(); // User is an admin, proceed
};

module.exports = verifyAdmin;