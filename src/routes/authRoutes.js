import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import "dotenv/config";
import ReadingMaterial from '../models/ReadingMaterial.js';
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

        return res.status(200).json({ message: 'User registered successfully. Please wait for admin approval' });
        
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

        if(!user.isActive) {
            return res.status(400).json({ message: 'Your account is pending approval' });
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

router.get("/:type", async (req, res) => {
    try {
      const { type } = req.params;
      let result;
  
      if (type === "contributors") {
        // Unique users who have at least one reading material
        const userIds = await ReadingMaterial.distinct("user");
        result = await User.find({ _id: { $in: userIds } }).select("-password");
      } 
      else if (type === "allActive") {
        result = await User.find({ isActive: true }).select("-password");
      } 
      else if (type === "pending") {
        result = await User.find({ isActive: false }).select("-password");
      } 
      else {
        return res.status(400).json({ message: "Invalid type parameter" });
      }
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error on /api/users/:type route", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

router.patch("/:id/approve", async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: true },
        { new: true }
      );
  
      if (!user) return res.status(404).json({ message: "User not found" });
  
      res.json({ message: "User activated successfully", user });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });
  
router.delete("/:id", async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
  
      if (!user) return res.status(404).json({ message: "User not found" });
  
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });
export default router;