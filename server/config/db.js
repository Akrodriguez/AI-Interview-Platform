const mongoose = require("mongoose");
const dns = require("dns");

// Use public DNS servers for MongoDB Atlas SRV resolution
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
    const mongoURI =
        process.env.MONGO_URI ||
        "mongodb://127.0.0.1:27017/ai-interview-platform";

    try {
        console.log("Attempting MongoDB connection...");

        await mongoose.connect(mongoURI);

        console.log("✅ MongoDB Connected");
        return true;
    } catch (error) {
        console.log(
            "⚠️ MongoDB Connection Failed – continuing without database"
        );
        console.error(error.message);
        return false;
    }
};

module.exports = connectDB;