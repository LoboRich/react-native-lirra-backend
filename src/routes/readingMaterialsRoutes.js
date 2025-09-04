import express from 'express';
import cloudinary from '../lib/cloudinary.js';
import ReadingMaterial from '../models/ReadingMaterial.js';
import protectRoute from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protectRoute, async(req, res) => {
    try {
        const {title, type, caption, author, image} = req.body;

        if(!title || !type || !caption || !author || !image) {
            return res.status(400).json({message: 'Please provide all required fields'});
        }
        // upload image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image)
        const imageUrl = uploadResponse.secure_url;

        const newReadingMaterial = await ReadingMaterial.create({
            title,
            type,
            caption,
            author,
            image: imageUrl,
            user: req.user._id
        });

        await newReadingMaterial.save();

        res.status(201).json(newReadingMaterial);
    } catch (error) {
        console.log("Error creating reading material", error);
        res.status(500).json({message: error.message});
    }
})

router.get('/', protectRoute, async(req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 5;
        const skip = (page-1) * limit;

        const readingMaterials = await ReadingMaterial.find()
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate('user', 'username profileImage');
        
        const totalReadingMaterials = await ReadingMaterial.countDocuments();

        res.send({
            readingMaterials,
            currentPage: page,
            totalReadingMaterials,
            totalPages: Math.ceil(totalReadingMaterials / limit)
        });

    } catch (error) {
        console.log("Error getting reading materials", error);
        res.status(500).json({message: error.message});
    }
})

router.get('/user', protectRoute, async(req, res) => {
    try {
        const readingMaterials = await ReadingMaterial.find({user: req.user._id}).sort({createdAt: -1});
        res.json(readingMaterials);
    } catch (error) {
        console.log("Error getting user reading materials", error);
        res.status(500).json({message: error.message});
    }
})

router.delete('/:id', protectRoute, async(req, res) => {
    try {
        const readingMaterial = await ReadingMaterial.findById(req.params.id);
        if(!readingMaterial) {
            return res.status(404).json({message: 'Reading material not found'});
        }

        if(readingMaterial.user.toString() !== req.user._id) {
            return res.status(401).json({message: 'You are not authorized to delete this reading material'});
        }

        // delete image from cloudinary
        if(readingMaterial.image && readingMaterial.image.includes('cloudinary')) {
            try {
                const publicId = readingMaterial.image.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (error) {
                console.log("Error deleting image from cloudinary", error);
            }
        }

        await readingMaterial.deleteOne();
        res.status(200).json({message: 'Reading material deleted successfully'});
    } catch (error) {
        console.log("Error deleting reading material", error);
        res.status(500).json({message: error.message});
    }
})

export default router;