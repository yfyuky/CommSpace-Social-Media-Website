const express = require('express');
const router = express.Router();
const { client } = require('../config/database');

router.post('/users', async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        
        // Check if user exists
        const existingUser = await users.findOne({ username: req.body.username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Create new user
        const newUser = {
            username: req.body.username,
            password: req.body.password, // Should hash password in production
            createdAt: new Date()
        };
        
        await users.insertOne(newUser);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        
        const user = await users.findOne({ 
            username: req.body.username,
            password: req.body.password // Should compare hashed passwords
        });

        if (user) {
            req.session.userId = user._id;
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/login', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/login', (req, res) => {
    res.json({ loggedIn: !!req.session.userId });
});

module.exports = router;