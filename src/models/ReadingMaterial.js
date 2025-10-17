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
        required: false
    },
    college: {
        type: String,
        required: true,
        default: 'College of Industrial Technology',
    },
    keywords: {
        type: [String],
        default: [],
        index: true
    },
    subjectTitles: {
        type: [String],
        default: [],
        index: true
    },
    version: {
        type: Number,
        required: false
    },
    edition: {
        type: Number,
        required: false
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