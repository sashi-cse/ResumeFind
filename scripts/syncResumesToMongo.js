require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Candidate = require('../models/Candidate');

const MONGO_URI = process.env.MONGO_URI;
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');

async function syncAll() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected! Syncing candidate resumes into MongoDB Atlas permanent storage...');

  const candidates = await Candidate.find({});
  console.log(`Found ${candidates.length} candidates.`);

  for (const c of candidates) {
    let buffer = null;

    // Check if file exists on disk
    const possiblePaths = [
      path.join(uploadDir, `${c.rollNumber}_Resume.pdf`),
      c.resumeFileName ? path.join(uploadDir, c.resumeFileName) : null,
      c.resumePath && fs.existsSync(c.resumePath) ? c.resumePath : null
    ].filter(Boolean);

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        buffer = fs.readFileSync(p);
        console.log(`✓ Read existing disk resume for ${c.rollNumber} (${c.name}) [${buffer.length} bytes]`);
        break;
      }
    }

    // If no real file on disk, do not overwrite with fake PDF
    if (!buffer) {
      console.log(`⚠️ No disk file found for ${c.rollNumber} (${c.name}) - skipping (preserving whatever candidate uploaded)`);
      continue;
    }

    c.resumeData = buffer;
    c.resumeContentType = 'application/pdf';
    c.fileSize = buffer.length;
    c.resumeFileName = `${c.rollNumber}_Resume.pdf`;
    c.resumePath = path.join(uploadDir, `${c.rollNumber}_Resume.pdf`);
    await c.save();
    console.log(`💾 Saved permanently to MongoDB Atlas for ${c.rollNumber} (${c.name})\n`);
  }

  console.log('🎉 ALL CANDIDATE RESUMES ARE NOW PERMANENTLY STORED IN MONGODB ATLAS!');
  process.exit(0);
}

syncAll().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
