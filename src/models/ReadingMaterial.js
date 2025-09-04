import mongoose from "mongoose";

const readingMaterialSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    caption: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    is_approved: {
        type: Boolean,
        required: false,
        default: false
    },
    image: {
        type: String,
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }   
}, {
    timestamps: true,
});

const ReadingMaterial = mongoose.model('ReadingMaterial', readingMaterialSchema);
export default ReadingMaterial;