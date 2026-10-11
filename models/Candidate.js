const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema(
  {
    rollNumber: {
      type: String,
      required: [true, 'Roll Number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Candidate name is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    gkvEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    googleId: {
      type: String,
      trim: true,
      default: ''
    },
    googlePicture: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: 'General'
    },
    skills: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one skill is required'
      }
    },
    resumeFileName: {
      type: String,
      required: true
    },
    resumeOriginalName: {
      type: String,
      default: ''
    },
    resumePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    resumeData: {
      type: Buffer
    },
    resumeContentType: {
      type: String,
      default: 'application/pdf'
    }
  },
  {
    timestamps: true
  }
);

// Helper method to format candidate for API responses (exclude large binary buffer from JSON lists)
CandidateSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.resumeData;
  return obj;
};

module.exports = mongoose.model('Candidate', CandidateSchema);
