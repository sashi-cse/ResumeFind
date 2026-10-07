require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const Candidate = require('./models/Candidate');

const DB_NAME = process.env.DB_NAME || 'resume_portal';
const MONGO_URI = process.env.MONGO_URI;

const uploadDir = path.join(__dirname, 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Function to generate a clean PDF resume
async function createSamplePdf(candidate) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Top Banner
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: rgb(0 / 255, 113 / 255, 227 / 255)
  });

  // Name & Roll Number
  page.drawText(candidate.name, {
    x: 40,
    y: height - 50,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  page.drawText(`Roll No: ${candidate.rollNumber}  |  Department: ${candidate.department}`, {
    x: 40,
    y: height - 75,
    size: 12,
    font: font,
    color: rgb(0.9, 0.95, 1)
  });

  // Contact Info
  let currentY = height - 130;
  page.drawText(`Email: ${candidate.email}  |  Phone: ${candidate.phone}`, {
    x: 40,
    y: currentY,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Section: Technical Skills
  currentY -= 40;
  page.drawText('CORE TECHNICAL SKILLS', {
    x: 40,
    y: currentY,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: width - 40, y: currentY - 5 },
    thickness: 1.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  currentY -= 25;
  const skillsText = candidate.skills.map(s => `• ${s.toUpperCase()}`).join('   ');
  page.drawText(skillsText, {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0 / 255, 113 / 255, 227 / 255)
  });

  // Section: Education
  currentY -= 40;
  page.drawText('ACADEMIC BACKGROUND', {
    x: 40,
    y: currentY,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: width - 40, y: currentY - 5 },
    thickness: 1.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  currentY -= 25;
  page.drawText(`Bachelor of Technology in ${candidate.department} (2021 - 2025)`, {
    x: 40,
    y: currentY,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2)
  });

  currentY -= 18;
  page.drawText('CGPA: 8.85 / 10.0  |  Relevant Coursework: Data Structures, Web Development, Databases', {
    x: 40,
    y: currentY,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4)
  });

  // Section: Key Projects
  currentY -= 40;
  page.drawText('FEATURED PROJECTS', {
    x: 40,
    y: currentY,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: width - 40, y: currentY - 5 },
    thickness: 1.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  currentY -= 25;
  page.drawText(`1. Full-Stack Web Application (${candidate.skills.slice(0, 3).join(', ')})`, {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  currentY -= 16;
  page.drawText('   - Engineered responsive UI, RESTful APIs, and secure database persistence.', {
    x: 40,
    y: currentY,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4)
  });

  currentY -= 16;
  page.drawText('   - Deployed with CI/CD pipeline and automated test coverage.', {
    x: 40,
    y: currentY,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4)
  });

  // Footer
  page.drawText(`Document verified for placement records • Roll No: ${candidate.rollNumber}`, {
    x: 40,
    y: 30,
    size: 9,
    font: font,
    color: rgb(0.6, 0.6, 0.6)
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(uploadDir, candidate.resumeFileName);
  fs.writeFileSync(filePath, pdfBytes);
  return filePath;
}

const sampleCandidates = [
  {
    rollNumber: '21CS101',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@college.edu',
    phone: '+91 98765 43210',
    department: 'Computer Science',
    skills: ['reactjs', 'nodejs', 'expressjs', 'mongodb', 'javascript'],
    resumeFileName: '21CS101_Resume.pdf'
  },
  {
    rollNumber: '21IT042',
    name: 'Ananya Patel',
    email: 'ananya.patel@college.edu',
    phone: '+91 98111 22334',
    department: 'Information Technology',
    skills: ['reactjs', 'typescript', 'tailwind', 'nextjs', 'nodejs'],
    resumeFileName: '21IT042_Resume.pdf'
  },
  {
    rollNumber: '22AI015',
    name: 'Vikramaditya Roy',
    email: 'vikram.roy@college.edu',
    phone: '+91 97222 33445',
    department: 'AI & Data Science',
    skills: ['python', 'machine learning', 'sql', 'fastapi', 'docker'],
    resumeFileName: '22AI015_Resume.pdf'
  },
  {
    rollNumber: '21CS088',
    name: 'Sneha Kulkarni',
    email: 'sneha.k@college.edu',
    phone: '+91 98333 44556',
    department: 'Computer Science',
    skills: ['java', 'spring boot', 'mysql', 'microservices', 'docker'],
    resumeFileName: '21CS088_Resume.pdf'
  },
  {
    rollNumber: '21IT023',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@college.edu',
    phone: '+91 98444 55667',
    department: 'Information Technology',
    skills: ['flutter', 'dart', 'firebase', 'android', 'ios'],
    resumeFileName: '21IT023_Resume.pdf'
  },
  {
    rollNumber: '22AI034',
    name: 'Priya Nambiar',
    email: 'priya.n@college.edu',
    phone: '+91 98555 66778',
    department: 'Data Science & AI',
    skills: ['python', 'pandas', 'machine learning', 'nlp', 'tensorflow'],
    resumeFileName: '22AI034_Resume.pdf'
  },
  {
    rollNumber: '21CS142',
    name: 'Karthik Nair',
    email: 'karthik.nair@college.edu',
    phone: '+91 98666 77889',
    department: 'Computer Science',
    skills: ['devops', 'aws', 'docker', 'kubernetes', 'ci/cd', 'linux'],
    resumeFileName: '21CS142_Resume.pdf'
  },
  {
    rollNumber: '22EC019',
    name: 'Rohan Verma',
    email: 'rohan.v@college.edu',
    phone: '+91 98777 88990',
    department: 'Electronics & Communication',
    skills: ['c++', 'embedded c', 'iot', 'python', 'arduino'],
    resumeFileName: '22EC019_Resume.pdf'
  }
];

async function seed() {
  try {
    console.log(`Connecting to MongoDB Atlas (DB: ${DB_NAME})...`);
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`✓ Connected to ${DB_NAME}`);

    for (const data of sampleCandidates) {
      console.log(`Generating resume PDF for ${data.name} (${data.rollNumber})...`);
      const filePath = await createSamplePdf(data);
      const stat = fs.statSync(filePath);

      await Candidate.findOneAndUpdate(
        { rollNumber: data.rollNumber },
        {
          ...data,
          resumeOriginalName: `${data.name}_Resume.pdf`,
          resumePath: filePath,
          fileSize: stat.size
        },
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded ${data.name} [${data.rollNumber}] with skills: ${data.skills.join(', ')}`);
    }

    console.log('\n======================================================');
    console.log(`✓ ALL SAMPLE RESUMES CREATED IN: ${uploadDir}`);
    console.log(`✓ ALL CANDIDATES SAVED TO DATABASE: "${DB_NAME}"`);
    console.log('======================================================\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
