import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import "dotenv/config";

const router = express.Router();

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '10d',
    });
}

router.post('/register', async(req, res) => {
   try {
        const { role, username, firstname, lastname, postnomials, college, email, password } = req.body;

        if(!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if(password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        if(username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters long' });
        }

        const existingUserEmail = await User.findOne({email});
        if(existingUserEmail) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const existingUserUsername = await User.findOne({username});
        if(existingUserUsername) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // get random profile avatar from dicebear.com

        const profileImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        const user = await User.create({ 
            username,
            email,
            password,
            profileImage,
            firstName: firstname,
            lastName: lastname,
            postnomials,
            college,
            role
        });

        await user.save();

        const token = generateToken(user._id);

        return res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                firstName: user.firstName,
                lastName: user.lastName,
                postnomials: user.postnomials,
                college: user.college,
                role: user.role
            },
        });
        
   } catch (error) {
        console.log("Error on the register route", error);
        res.status(500).json({ message: 'Internal server error' });
   }
})

router.post('/login', async(req, res) => {
   try {
        const { email, password } = req.body;

        if(!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findOne({ email }); // check if user is existing

        if(!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isPasswordCorrect = await user.comparePassword(password); // check if password is correct

        if(!isPasswordCorrect) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                firstName: user.firstName,
                lastName: user.lastName,
                postnomials: user.postnomials,
                college: user.college,
                role: user.role
            },
        });
        
   } catch (error) {
        console.log("Error on the login route", error);
        res.status(500).json({ message: 'Internal server error' });
   }
})

export default router;