import express from 'express';
import cloudinary from '../lib/cloudinary.js';
import ReadingMaterial from '../models/ReadingMaterial.js';
import protectRoute from '../middleware/auth.middleware.js';
import Vote from '../models/Vote.js';

const router = express.Router();

router.post('/', protectRoute, async(req, res) => {
    try {
        const {title, type, caption, author, image} = req.body;

        if(!title || !caption || !image) {
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

router.get("/", protectRoute, async (req, res) => {
    try {
      // pagination + search params
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);
      const skip = (page - 1) * limit;
      const search = req.query.search?.trim() || "";
  
      // build search condition
      const searchCondition = search
        ? { title: { $regex: search, $options: "i" } }
        : {};
  
      // query docs + total count in parallel
      const [materials, totalReadingMaterials] = await Promise.all([
        ReadingMaterial.find(searchCondition)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("user", "username profileImage"),
        ReadingMaterial.countDocuments(searchCondition),
      ]);
  
      // attach votes info for each material
      const results = await Promise.all(
        materials.map(async (material) => {
          const [votesCount, hasVoted] = await Promise.all([
            Vote.countDocuments({ material: material._id }),
            Vote.exists({ material: material._id, user: req.user._id }),
          ]);
  
          return {
            ...material.toObject(),
            votesCount,
            hasVoted: !!hasVoted,
          };
        })
      );
  
      res.json({
        readingMaterials: results,
        currentPage: page,
        totalReadingMaterials,
        totalPages: Math.ceil(totalReadingMaterials / limit),
      });
    } catch (error) {
      console.error("Error getting reading materials:", error);
      res.status(500).json({ message: "Failed to fetch reading materials" });
    }
});   

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