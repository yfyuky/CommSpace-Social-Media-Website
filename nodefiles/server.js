const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer')

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
const fs = require('fs');

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

// Configure multer upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB file size limit
    },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

const app = express();

const STUDENT_ID = 'M00913254';
const uri = "mongodb+srv://mm4049:ua7Vgj38s1hw4bln@cluster0.7izac.mongodb.net/commspace?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-specific-password'
    }
});

// Middleware
app.use(cors({
    origin: 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(uploadDir));


// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Main route
app.get(`/${STUDENT_ID}`, (req, res) => {
    res.sendFile(path.join(__dirname, '../html/index.html'));
});

// Authentication Middleware
const authenticateUser = (req, res, next) => {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Password Reset Routes
app.post(`/${STUDENT_ID}/password-reset-request`, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        const { email } = req.body;

        const user = await users.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour

        await users.updateOne(
            { email },
            {
                $set: {
                    resetToken,
                    resetTokenExpiry
                }
            }
        );

        const resetUrl = `http://localhost:8080/${STUDENT_ID}/reset-password?token=${resetToken}`;

        await transporter.sendMail({
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Password Reset Request',
            html: `
                <p>You requested a password reset.</p>
                <p>Click this <a href="${resetUrl}">link</a> to reset your password.</p>
                <p>This link will expire in 1 hour.</p>
            `
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post(`/${STUDENT_ID}/password-reset`, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        const { token, newPassword } = req.body;

        const user = await users.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        await users.updateOne(
            { resetToken: token },
            {
                $set: { password: newPassword },
                $unset: { resetToken: "", resetTokenExpiry: "" }
            }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// User Routes
app.post(`/${STUDENT_ID}/users`, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');

        const newUser = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            createdAt: new Date(),
            displayName: req.body.username,
            karma: 0,
            bio: '',
            followers: [], // Initialize empty followers array
            following: [], // Initialize empty following array
            emailPreferences: {
                notifications: true
            },
            privacySettings: {
                publicProfile: true
            }
        };

        await users.insertOne(newUser);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user profile endpoint
app.get(`/${STUDENT_ID}/users/profile`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');

        const user = await users.findOne(
            { _id: new ObjectId(req.session.userId) },
            {
                projection: {
                    username: 1,
                    displayName: 1,
                    bio: 1,
                    createdAt: 1,
                    karma: 1,
                    followers: 1,
                    following: 1,
                    emailPreferences: 1,
                    privacySettings: 1
                }
            }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate followers and following counts
        const followersCount = user.followers?.length || 0;
        const followingCount = user.following?.length || 0;

        res.json({
            success: true,
            profile: {
                username: user.username,
                displayName: user.displayName,
                bio: user.bio || '',
                createdAt: user.createdAt,
                karma: user.karma || 0,
                followersCount,
                followingCount,
                emailPreferences: user.emailPreferences,
                privacySettings: user.privacySettings
            }
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get(`/${STUDENT_ID}/users/activity`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const communities = db.collection('communities');

        // Get user's posts
        const userPosts = await posts
            .find({ author: req.session.username })
            .sort({ createdAt: -1 })
            .toArray();

        // Get communities user is a member of
        const userCommunities = await communities
            .find({ members: req.session.userId })
            .toArray();

        // Get user's comments
        const postsWithComments = await posts
            .find({ 'comments.author': req.session.username })
            .toArray();

        const userComments = postsWithComments
            .map(post => post.comments.filter(comment => comment.author === req.session.username))
            .flat()
            .sort((a, b) => b.createdAt - a.createdAt);

        res.json({
            success: true,
            activity: {
                posts: userPosts,
                comments: userComments,
                communities: userCommunities
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put(`/${STUDENT_ID}/users/settings`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');

        const updateData = {
            displayName: req.body.displayName,
            bio: req.body.bio,
            emailPreferences: req.body.emailPreferences,
            privacySettings: req.body.privacySettings,
            updatedAt: new Date()
        };

        await users.updateOne(
            { _id: new ObjectId(req.session.userId) },
            { $set: updateData }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search users endpoint
app.get(`/${STUDENT_ID}/users/search`, authenticateUser, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ success: true, users: [] });
        }

        const db = client.db('commspace');
        const users = db.collection('users');

        // Find users matching query
        const searchResults = await users.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { displayName: { $regex: query, $options: 'i' } }
            ]
        }).toArray();

        res.json({ success: true, users: searchResults });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

app.get(`/${STUDENT_ID}/contents/search`, authenticateUser, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ success: true, posts: [] });
        }

        const db = client.db('commspace');
        const posts = db.collection('posts');

        // Find posts matching query
        const searchResults = await posts.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { content: { $regex: query, $options: 'i' } }
            ]
        }).toArray();

        res.json({ success: true, posts: searchResults });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Follow user endpoint
app.post(`/${STUDENT_ID}/follow`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        const { userId } = req.body;

        // Add to current user's following list
        await users.updateOne(
            { _id: new ObjectId(req.session.userId) },
            { $addToSet: { following: new ObjectId(userId) } }
        );

        // Add to target user's followers list
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { followers: new ObjectId(req.session.userId) } }
        );

        res.json({
            success: true,
            message: 'Successfully followed user'
        });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({
            success: false,
            error: 'Error following user'
        });
    }
});

// Unfollow user endpoint
app.delete(`/${STUDENT_ID}/follow`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        const { userId } = req.body;

        // Remove from current user's following list
        await users.updateOne(
            { _id: new ObjectId(req.session.userId) },
            { $pull: { following: new ObjectId(userId) } }
        );

        // Remove from target user's followers list
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { followers: new ObjectId(req.session.userId) } }
        );

        res.json({
            success: true,
            message: 'Successfully unfollowed user'
        });
    } catch (error) {
        console.error('Unfollow error:', error);
        res.status(500).json({
            success: false,
            error: 'Error unfollowing user'
        });
    }
});

// Get user profile endpoint
app.get(`/${STUDENT_ID}/users/:username`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        const { username } = req.params;

        const user = await users.findOne({ username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if current user is following this user
        const currentUser = await users.findOne({
            _id: new ObjectId(req.session.userId)
        });

        const isFollowing = currentUser.following?.some(id =>
            id.toString() === user._id.toString()
        );

        // Get followers and following counts
        const followersCount = user.followers?.length || 0;
        const followingCount = user.following?.length || 0;

        res.json({
            success: true,
            user: {
                username: user.username,
                displayName: user.displayName,
                karma: user.karma || 0,
                createdAt: user.createdAt,
                followersCount,
                followingCount,
                isFollowing
            }
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Error getting user profile'
        });
    }
});

app.post(`/${STUDENT_ID}/login`, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');

        const user = await users.findOne({
            username: req.body.username,
            password: req.body.password
        });

        if (user) {
            req.session.userId = user._id;
            req.session.username = user.username;
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete(`/${STUDENT_ID}/login`, (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get(`/${STUDENT_ID}/login`, (req, res) => {
    res.json({
        loggedIn: !!req.session?.userId,
        user: req.session?.username ? { username: req.session.username } : null
    });
});

// Content Routes
app.get(`/${STUDENT_ID}/contents`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const community = req.query.community;
        const query = community ? { community } : {};
        const postsList = await posts.find(query).toArray();
        res.json({ success: true, posts: postsList });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// In your contents POST endpoint
app.post(`/${STUDENT_ID}/contents`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const newPost = {
            title: req.body.title,
            content: req.body.content,
            community: req.body.community,
            author: req.session.username,
            createdAt: new Date(),
            votes: {},
            totalVotes: 0,
            comments: [],
            imageUrl: req.body.imageUrl || null
        };
        await posts.insertOne(newPost);
        res.json({ success: true, post: newPost });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Community Routes
app.get(`/${STUDENT_ID}/communities`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const communities = db.collection('communities');
        const communitiesList = await communities.find().toArray();
        res.json({ success: true, communities: communitiesList });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post(`/${STUDENT_ID}/communities`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const communities = db.collection('communities');

        // Check if community exists
        const existingCommunity = await communities.findOne({ name: req.body.name });
        if (existingCommunity) {
            return res.status(400).json({ error: 'Community already exists' });
        }

        const newCommunity = {
            name: req.body.name,
            description: req.body.description,
            type: req.body.type,
            creator: req.session.userId,
            createdAt: new Date(),
            members: [req.session.userId],
            moderators: [req.session.userId]
        };

        await communities.insertOne(newCommunity);
        res.json({ success: true, community: newCommunity });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get(`/${STUDENT_ID}/communities/:communityName`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const communities = db.collection('communities');
        const communityName = req.params.communityName;
        const community = await communities.findOne({ name: communityName });

        if (!community) {
            return res.status(404).json({ error: 'Community not found' });
        }

        const isMember = community.members.includes(req.session.userId);

        res.json({
            success: true,
            ...community,
            isMember
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post(`/${STUDENT_ID}/communities/:communityName/join`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const communities = db.collection('communities');
        const communityName = req.params.communityName;
        const community = await communities.findOne({ name: communityName });

        if (!community) {
            return res.status(404).json({ error: 'Community not found' });
        }

        await communities.updateOne(
            { name: communityName },
            { $addToSet: { members: req.session.userId } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete(`/${STUDENT_ID}/communities/:communityName/leave`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const communities = db.collection('communities');
        const communityName = req.params.communityName;
        const community = await communities.findOne({ name: communityName });

        if (!community) {
            return res.status(404).json({ error: 'Community not found' });
        }

        await communities.updateOne(
            { name: communityName },
            { $pull: { members: req.session.userId } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Post interaction routes
app.post(`/${STUDENT_ID}/contents/:postId/vote`, authenticateUser, async (req, res) => {
    console.log('Vote request received:', {
        postId: req.params.postId,
        direction: req.body.direction,
        userId: req.session.userId
    });

    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const postId = new ObjectId(req.params.postId);
        const direction = req.body.direction;
        
        // Find the post
        const post = await posts.findOne({ _id: postId });
        console.log('Found post:', post);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Initialize votes object if needed
        if (!post.votes) {
            post.votes = {};
        }

        // Get current vote value
        const currentVote = post.votes[req.session.userId] || 0;
        console.log('Current vote:', currentVote);

        // Calculate new vote value
        let newVote;
        if (currentVote === direction) {
            // Remove vote if same direction
            delete post.votes[req.session.userId];
            newVote = 0;
        } else {
            // Set new vote
            post.votes[req.session.userId] = direction;
            newVote = direction;
        }

        // Calculate total votes
        const totalVotes = Object.values(post.votes).reduce((sum, vote) => sum + vote, 0);
        console.log('New total votes:', totalVotes);

        // Update post in database
        await posts.updateOne(
            { _id: postId },
            { 
                $set: { 
                    votes: post.votes,
                    totalVotes: totalVotes
                }
            }
        );

        // Send response
        const response = {
            success: true,
            newTotal: totalVotes,
            newVote: newVote
        };
        console.log('Sending response:', response);
        res.json(response);

    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add comments
app.post(`/${STUDENT_ID}/contents/:postId/comments`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const postId = new ObjectId(req.params.postId);

        const comment = {
            id: new ObjectId(),
            author: req.session.username,
            content: req.body.content,
            createdAt: new Date(),
            votes: {}
        };

        await posts.updateOne(
            { _id: postId },
            { $push: { comments: comment } }
        );

        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete post
app.delete(`/${STUDENT_ID}/contents/:postId`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const postId = new ObjectId(req.params.postId);

        // Find the post first to check ownership
        const post = await posts.findOne({ _id: postId });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if the current user is the author
        if (post.author !== req.session.username) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }

        // Delete the post
        await posts.deleteOne({ _id: postId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete comment endpoint
app.delete(`/${STUDENT_ID}/contents/:postId/comments/:commentId`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const posts = db.collection('posts');
        const postId = new ObjectId(req.params.postId);
        const commentId = new ObjectId(req.params.commentId);

        // Find the post first
        const post = await posts.findOne({ _id: postId });
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Find the comment and verify ownership
        const comment = post.comments.find(c => c.id.toString() === commentId.toString());
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check if current user is the comment author
        if (comment.author !== req.session.username) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        // Remove the comment
        await posts.updateOne(
            { _id: postId },
            { $pull: { comments: { id: commentId } } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Follow user
app.post(`/${STUDENT_ID}/users/:userId/follow`, authenticateUser, async (req, res) => {
    try {
        const db = client.db('commspace');
        const users = db.collection('users');
        const targetUserId = new ObjectId(req.params.userId);

        // Check if user exists
        const targetUser = await users.findOne({ _id: targetUserId });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add to following list
        await users.updateOne(
            { _id: new ObjectId(req.session.userId) },
            { $addToSet: { following: targetUserId } }
        );

        // Add to followers list
        await users.updateOne(
            { _id: targetUserId },
            { $addToSet: { followers: new ObjectId(req.session.userId) } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// File filter
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

// Add this route to your server
app.post(`/${STUDENT_ID}/upload`, authenticateUser, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create URL path for the uploaded image
        const imageUrl = `/uploads/${req.file.filename}`;

        console.log('File uploaded successfully:', {
            filename: req.file.filename,
            path: req.file.path,
            url: imageUrl
        });

        res.json({
            success: true,
            imageUrl: imageUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this error handling middleware after your routes
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            error: 'File upload error: ' + err.message
        });
    }
    res.status(500).json({
        error: 'Internal server error: ' + err.message
    });
});

// Initialize default communities
async function initializeDefaultCommunities() {
    try {
        const db = client.db('commspace');
        const communities = db.collection('communities');
        const defaultCommunities = [
            { name: 'programming', description: 'All about programming', type: 'public' },
            { name: 'gaming', description: 'All about gaming', type: 'public' },
            { name: 'science', description: 'All about science', type: 'public' },
            { name: 'movies', description: 'All about movies', type: 'public' },
            { name: 'books', description: 'All about books', type: 'public' },
            { name: 'technology', description: 'All about technology', type: 'public' },
            { name: 'music', description: 'All about music', type: 'public' },
            { name: 'art', description: 'All about art', type: 'public' }
        ];

        for (const community of defaultCommunities) {
            const existingCommunity = await communities.findOne({ name: community.name });
            if (!existingCommunity) {
                await communities.insertOne(community);
            }
        }
    } catch (error) {
        console.error('Error initializing default communities:', error);
    }
}

// Database Connection and Server Start
async function connectDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        await initializeDefaultCommunities();
    } catch (error) {
        console.error('MongoDB Atlas connection error:', error);
        process.exit(1);
    }
}


// Start server
connectDB().then(async () => {
    app.listen(8080, () => {
        console.log(`Server is running on http://localhost:8080/${STUDENT_ID}`);
    });
}).catch(err => console.error('Startup error:', err));