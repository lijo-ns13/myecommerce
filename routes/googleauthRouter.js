
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Route to initiate Google authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google callback URL
router.get('/auth/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  // Generate a JWT token after successful authentication
  const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  // Send the token to the client (e.g., in a cookie or as JSON)
  res.cookie('jwt', token, { httpOnly: true, secure: true });
  res.redirect('/'); // Redirect to your app's dashboard or another route
});

module.exports = router;
