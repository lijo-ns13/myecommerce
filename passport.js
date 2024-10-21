const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb://localhost:27017"; // Your MongoDB URI
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
// Connect to MongoDB
let db;
MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db('myecommerce');
    })
    .catch(err => console.error(err));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const usersCollection = db.collection('users');
        let user = await usersCollection.findOne({ email: profile.emails[0].value });

        if (!user) {
            // Create a new user if not found
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let referralCode = '';
        for (let i = 0; i < 6; i++) {
            referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
            user = {
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                role:'user',
                referralCode:referralCode
            };
            await usersCollection.insertOne(user);
        }

        // Generate a JWT token
        const token = jwt.sign({ _id: user._id ,role:user.role}, process.env.JWT_SECRET, { expiresIn: '30m' });
        done(null, { user, token });
    } catch (err) {
        done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.token);
});

passport.deserializeUser(async (token, done) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ _id: decoded.userId });
        done(null, user);
    } catch (err) {
        done(err);
    }
});
