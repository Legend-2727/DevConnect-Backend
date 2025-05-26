import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Now available in route handler
    next();
  } catch (err) {
    console.error('JWT error:', err.message);
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};
