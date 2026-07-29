const User = require("../models/User");
const bcrypt = require("bcrypt");

// Register User
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        console.log(name);
        console.log(email);
        console.log(password);

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill all the fields"
            });
        }

        const existingUser = await User.findOne({ email });

        console.log(existingUser);

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log(hashedPassword);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
        });

        res.status(201).json({
            success: true,
            message: "User Registered Successfully",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
            },
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
const generateToken = require("../utils/generateToken");

const loginUser = async (req, res) => {
    try {

        const { email, password } = req.body;

        // 1. Validate Input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password"
            });
        }

        // 2. Find User
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email or Password"
            });
        }

        // 3. Compare Password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email or Password"
            });
        }

        // 4. Generate JWT
        const token = generateToken(user._id);

        // 5. Send Response
        res.status(200).json({
            success: true,
            message: "Login Successful",
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getProfile = async (req, res) => {

    res.status(200).json({
        success: true,
        user: req.user
    });

};

module.exports = {
    registerUser,
    loginUser,
    getProfile
};