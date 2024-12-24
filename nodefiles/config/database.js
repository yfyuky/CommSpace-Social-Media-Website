const { MongoClient } = require('mongodb');

const uri = "mongodb://localhost:27017/commspace";
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        return client.db('commspace');
    } catch (error) {
        console.error('MongoDB Atlas connection error:', error);
        process.exit(1);
    }
}

module.exports = { connectDB, client };
db.users.createIndex({ "resetToken": 1 });
db.users.createIndex({ "resetTokenExpiry": 1 });