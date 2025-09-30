const jwt = require('jsonwebtoken');

// This middleware will verify the JSON Web Token
const verifyToken = (req, res, next) => {
    // Check for the authorization header
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access: No token provided' });
    }

    // The token is in the format "Bearer <token>"
    const token = authorization.split(' ')[1];

    // Verify the token using the secret key
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'Forbidden access: Invalid token' });
        }
        // Attach the decoded user information to the request object
        req.decoded = decoded;
        next(); // Proceed to the next middleware or the route handler
    });
};

module.exports = verifyToken;