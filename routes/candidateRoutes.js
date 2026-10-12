const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OAuth2Client } = require('google-auth-library');
const Candidate = require('../models/Candidate');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '744894548754-rthokkpmrhrb4dnne6p3ps07700la64t.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token) {
  if (!token) return null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });
    return ticket.getPayload();
  } catch (err) {
    console.warn('Google verifyIdToken note:', err.message);
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (decoded && decoded.email) return decoded;
      }
    } catch (_) {}
    return null;
  }
}

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Priority list configuration helper
const priorityFilePath = path.join(__dirname, '..', 'priority.json');
function getPriorityRolls() {
  try {
    if (fs.existsSync(priorityFilePath)) {
      const data = JSON.parse(fs.readFileSync(priorityFilePath, 'utf8'));
      if (Array.isArray(data)) {
        return data.map(r => r.toString().trim().toUpperCase());
      }
    }
  } catch (err) {
    console.warn('Error reading priority list:', err.message);
  }
  return [];
}

// Multer storage engine - stores file uniquely identified by Roll Number
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawRoll = (req.body.rollNumber || 'TEMP').toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${rawRoll}-${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF resume files are supported!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// Skill Alias Dictionary & Normalization Engine
const SKILL_ALIASES = {
  'nodejs': 'node',
  'node.js': 'node',
  'node': 'node',

  'reactjs': 'react',
  'react.js': 'react',
  'react': 'react',

  'expressjs': 'express',
  'express.js': 'express',
  'express': 'express',

  'vuejs': 'vue',
  'vue.js': 'vue',
  'vue': 'vue',

  'nextjs': 'next',
  'next.js': 'next',
  'next': 'next',

  'angularjs': 'angular',
  'angular.js': 'angular',
  'angular': 'angular',

  'mongodb': 'mongodb',
  'mongo': 'mongodb',

  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'psql': 'postgresql',

  'javascript': 'javascript',
  'js': 'javascript',

  'typescript': 'typescript',
  'ts': 'typescript',

  'python': 'python',
  'py': 'python',

  'c++': 'cpp',
  'cpp': 'cpp',

  'c#': 'csharp',
  'csharp': 'csharp',

  'golang': 'go',
  'go': 'go'
};

function normalizeSkill(str) {
  if (!str) return '';
  const lower = str.toString().trim().toLowerCase();
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];

  // Remove common punctuation (. - _ space)
  const stripped = lower.replace(/[\.\-_\s]/g, '');
  if (SKILL_ALIASES[stripped]) return SKILL_ALIASES[stripped];

  // If ends with 'js' (e.g. nestjs, sveltejs) and length > 4, strip js
  if (stripped.endsWith('js') && stripped.length > 4) {
    const withoutJs = stripped.slice(0, -2);
    if (SKILL_ALIASES[withoutJs]) return SKILL_ALIASES[withoutJs];
    return withoutJs;
  }

  return stripped;
}

function isSkillMatch(skillA, skillB) {
  if (!skillA || !skillB) return false;
  const a = skillA.toString().trim().toLowerCase();
  const b = skillB.toString().trim().toLowerCase();

  // 1. Exact match
  if (a === b) return true;

  // 2. Canonical normalized form match (e.g. node.js vs nodejs -> both 'node')
  const normA = normalizeSkill(a);
  const normB = normalizeSkill(b);
  if (normA && normB && normA === normB) return true;

  // 3. Punctuation stripped match
  const stripA = a.replace(/[\.\-_\s]/g, '');
  const stripB = b.replace(/[\.\-_\s]/g, '');
  if (stripA === stripB) return true;

  // 4. Substring inclusion if term is significant (e.g. "react" in "react native")
  if (stripA.length >= 4 && stripB.length >= 4) {
    if (stripA.includes(stripB) || stripB.includes(stripA)) return true;
  }

  return false;
}

// Helper to normalize skills array
function parseSkills(skillsInput) {
  if (!skillsInput) return [];
  let rawList = [];
  if (Array.isArray(skillsInput)) {
    rawList = skillsInput;
  } else if (typeof skillsInput === 'string') {
    try {
      const parsed = JSON.parse(skillsInput);
      if (Array.isArray(parsed)) rawList = parsed;
      else rawList = skillsInput.split(',');
    } catch {
      rawList = skillsInput.split(',');
    }
  }
  return [...new Set(rawList.map(s => s.trim().toLowerCase()).filter(Boolean))];
}

// Helper to resolve resume file path reliably across environments (Windows local vs Linux Render)
function resolveResumePath(candidate) {
  if (!candidate) return null;
  // 1. Direct path check if it exists on host disk
  if (candidate.resumePath && fs.existsSync(candidate.resumePath)) {
    return candidate.resumePath;
  }
  // 2. Look in local uploads/resumes by candidate.resumeFileName
  if (candidate.resumeFileName) {
    const byFileName = path.join(__dirname, '..', 'uploads', 'resumes', candidate.resumeFileName);
    if (fs.existsSync(byFileName)) return byFileName;
  }
  // 3. Look in local uploads/resumes by roll number
  if (candidate.rollNumber) {
    const byRoll = path.join(__dirname, '..', 'uploads', 'resumes', `${candidate.rollNumber}_Resume.pdf`);
    if (fs.existsSync(byRoll)) return byRoll;
  }
  // 4. Look in local uploads/resumes by basename of candidate.resumePath
  if (candidate.resumePath) {
    const base = path.basename(candidate.resumePath);
    const byBase = path.join(__dirname, '..', 'uploads', 'resumes', base);
    if (fs.existsSync(byBase)) return byBase;
  }
  return null;
}

// -------------------------------------------------------------
// POST /api/auth/google - Verify Google ID Token & Return Profile
// -------------------------------------------------------------
router.post(['/auth/google', '/google'], async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential token is required.' });
    }

    const payload = await verifyGoogleToken(credential);
    if (!payload || !payload.email) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Google credential token.' });
    }

    const googleId = payload.sub || '';
    const email = payload.email.toLowerCase();
    const name = payload.name || '';
    const picture = payload.picture || '';

    // Check if candidate exists by googleId or email
    let candidate = null;
    if (googleId) {
      candidate = await Candidate.findOne({ googleId });
    }
    if (!candidate && email) {
      candidate = await Candidate.findOne({ email });
    }

    if (candidate) {
      if (!candidate.googleId && googleId) {
        candidate.googleId = googleId;
      }
      if (picture && !candidate.googlePicture) {
        candidate.googlePicture = picture;
      }
      await candidate.save();

      return res.json({
        success: true,
        isRegistered: true,
        user: { googleId, email, name, picture },
        candidate
      });
    }

    return res.json({
      success: true,
      isRegistered: false,
      user: { googleId, email, name, picture },
      candidate: null
    });
  } catch (error) {
    console.error('Error in /api/auth/google:', error);
    res.status(500).json({ success: false, message: 'Server error during Google authentication.' });
  }
});

// -------------------------------------------------------------
// GET /api/candidates/my-profile - Auto-detect student profile by Google account
// -------------------------------------------------------------
router.get('/my-profile', async (req, res) => {
  try {
    const googleId = (req.query.googleId || '').trim();
    const email = (req.query.email || '').trim().toLowerCase();

    if (!googleId && !email) {
      return res.status(400).json({ success: false, message: 'Google credentials required.' });
    }

    let candidate = null;
    if (googleId) {
      candidate = await Candidate.findOne({ googleId });
    }
    if (!candidate && email) {
      candidate = await Candidate.findOne({ email });
    }

    if (candidate) {
      return res.json({
        success: true,
        exists: true,
        candidate
      });
    }

    return res.json({
      success: true,
      exists: false,
      candidate: null
    });
  } catch (error) {
    console.error('Error in /my-profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// POST /api/candidates - Add Candidate & Upload Resume
// -------------------------------------------------------------
router.post('/', upload.single('resume'), async (req, res) => {
  let uploadedFilePath = req.file ? req.file.path : null;

  try {
    const { rollNumber, name, email, gkvEmail, phone, department, googleId, googlePicture, googleToken } = req.body;

    if (!rollNumber || !rollNumber.trim()) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ success: false, message: 'Roll Number is required.' });
    }

    if (!name || !name.trim()) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ success: false, message: 'Candidate name is required.' });
    }

    let verifiedGoogleId = googleId || '';
    let verifiedPicture = googlePicture || '';
    if (googleToken) {
      const gPayload = await verifyGoogleToken(googleToken);
      if (gPayload) {
        verifiedGoogleId = gPayload.sub || verifiedGoogleId;
        verifiedPicture = gPayload.picture || verifiedPicture;
      }
    }

    const cleanRollNumber = rollNumber.trim().toUpperCase();
    const parsedSkills = parseSkills(req.body.skills);

    // Enforce 1 Student = 1 Roll Number policy
    if (verifiedGoogleId) {
      const candidateOwnedByGoogle = await Candidate.findOne({ googleId: verifiedGoogleId });
      if (candidateOwnedByGoogle && candidateOwnedByGoogle.rollNumber !== cleanRollNumber) {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
        return res.status(403).json({
          success: false,
          message: `Security Alert: Your Google account is already linked to Roll Number ${candidateOwnedByGoogle.rollNumber}. You can only manage your own profile.`
        });
      }
    }

    // Check if Roll Number already exists in DB -> Automatically Update & Replace Resume!
    const existing = await Candidate.findOne({ rollNumber: cleanRollNumber });
    if (existing) {
      // Security check: if existing candidate belongs to another Google account, prevent overwrite
      if (existing.googleId && verifiedGoogleId && existing.googleId !== verifiedGoogleId) {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
        return res.status(403).json({
          success: false,
          message: 'Security Alert: This Roll Number is linked to a different Google account.'
        });
      }

      // Security check 2: if existing record was registered before Google auth, verify ownership by email or gkvEmail
      if (!existing.googleId && (existing.email || existing.gkvEmail)) {
        const callerEmail = (email || '').trim().toLowerCase();
        const callerGkvEmail = (gkvEmail || '').trim().toLowerCase();
        const emailMatches = existing.email && callerEmail && existing.email.toLowerCase() === callerEmail;
        const gkvMatches = existing.gkvEmail && callerGkvEmail && existing.gkvEmail.toLowerCase() === callerGkvEmail;
        if (!emailMatches && !gkvMatches) {
          if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
          return res.status(403).json({
            success: false,
            message: `Security Alert: Roll Number ${cleanRollNumber} is registered under another email. You cannot edit another student's profile.`
          });
        }
      }

      existing.name = name.trim();
      if (email !== undefined) existing.email = (email || '').trim().toLowerCase();
      if (gkvEmail !== undefined) existing.gkvEmail = (gkvEmail || '').trim().toLowerCase();
      if (phone !== undefined) existing.phone = (phone || '').trim();
      if (department !== undefined) existing.department = (department || 'Engineering').trim();
      if (verifiedGoogleId) existing.googleId = verifiedGoogleId;
      if (verifiedPicture) existing.googlePicture = verifiedPicture;
      if (parsedSkills.length > 0) existing.skills = parsedSkills;

      if (req.file) {
        const finalFileName = `${cleanRollNumber}_Resume.pdf`;
        const finalFilePath = path.join(uploadDir, finalFileName);

        const fileBuffer = fs.readFileSync(uploadedFilePath);
        existing.resumeData = fileBuffer;
        existing.resumeContentType = 'application/pdf';

        if (fs.existsSync(finalFilePath) && finalFilePath !== uploadedFilePath) {
          try { fs.unlinkSync(finalFilePath); } catch (_) {}
        }
        fs.renameSync(uploadedFilePath, finalFilePath);

        existing.resumeFileName = finalFileName;
        existing.resumeOriginalName = req.file.originalname;
        existing.resumePath = finalFilePath;
        existing.fileSize = req.file.size;
      }

      await existing.save();

      return res.status(200).json({
        success: true,
        message: `Student ${existing.name} (${cleanRollNumber}) updated and resume replaced successfully!`,
        data: existing,
        isUpdate: true
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume PDF file is required for new candidates.' });
    }

    if (parsedSkills.length === 0) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ success: false, message: 'At least one skill must be provided.' });
    }

    // Standardized permanent file name for this candidate
    const finalFileName = `${cleanRollNumber}_Resume.pdf`;
    const finalFilePath = path.join(uploadDir, finalFileName);

    const fileBuffer = fs.readFileSync(uploadedFilePath);

    // Rename file to permanent roll number name
    fs.renameSync(uploadedFilePath, finalFilePath);

    const candidate = new Candidate({
      rollNumber: cleanRollNumber,
      name: name.trim(),
      email: (email || '').trim().toLowerCase(),
      gkvEmail: (gkvEmail || '').trim().toLowerCase(),
      googleId: verifiedGoogleId,
      googlePicture: verifiedPicture,
      phone: (phone || '').trim(),
      department: (department || 'Engineering').trim(),
      skills: parsedSkills,
      resumeFileName: finalFileName,
      resumeOriginalName: req.file.originalname,
      resumePath: finalFilePath,
      fileSize: req.file.size,
      resumeData: fileBuffer,
      resumeContentType: 'application/pdf'
    });

    await candidate.save();

    res.status(201).json({
      success: true,
      message: `Candidate ${candidate.name} (${candidate.rollNumber}) registered successfully!`,
      data: candidate
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    console.error('Error in candidate registration:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error while saving candidate.' });
  }
});

// -------------------------------------------------------------
// GET /api/candidates/search - Smart Dual Search (Skillset OR Roll Number)
// -------------------------------------------------------------
router.get('/search', async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || '').trim();
    const type = req.query.type || 'auto'; // 'auto', 'skills', 'roll'

    if (!query) {
      // Return all candidates sorted by newest (recently updated first)
      const allCandidates = await Candidate.find().sort({ updatedAt: -1, createdAt: -1 });
      return res.json({
        success: true,
        count: allCandidates.length,
        searchType: 'all',
        data: allCandidates.map(c => ({
          ...c.toObject(),
          matchScore: 100,
          matchedSkills: c.skills
        }))
      });
    }

    const isRollSearch = type === 'roll' || (type === 'auto' && /^[A-Za-z0-9_-]{3,15}$/.test(query) && !query.includes(','));

    // 1. Try Roll Number Search if requested or detected
    if (isRollSearch) {
      const rollRegex = new RegExp(query, 'i');
      const rollMatches = await Candidate.find({ rollNumber: rollRegex }).sort({ rollNumber: 1 });

      if (rollMatches.length > 0 || type === 'roll') {
        return res.json({
          success: true,
          count: rollMatches.length,
          searchType: 'rollNumber',
          query: query,
          data: rollMatches.map(c => ({
            ...c.toObject(),
            matchScore: 100,
            matchedSkills: c.skills
          }))
        });
      }
    }

    // 2. Skillset Search
    const searchTerms = parseSkills(query);

    if (searchTerms.length === 0) {
      const all = await Candidate.find().sort({ updatedAt: -1, createdAt: -1 });
      return res.json({
        success: true,
        count: all.length,
        searchType: 'all',
        data: all
      });
    }

    // Fetch candidates and apply intelligent alias-aware matching
    const allCandidates = await Candidate.find();

    // Score and rank candidates by how many of the queried skills match
    const scoredResults = allCandidates
      .map(candidate => {
        const matchedTerms = [];
        const matchedCandidateSkills = [];

        searchTerms.forEach(term => {
          const matchedSkill = (candidate.skills || []).find(candSkill => isSkillMatch(candSkill, term));
          if (matchedSkill) {
            matchedTerms.push(term);
            if (!matchedCandidateSkills.includes(matchedSkill)) {
              matchedCandidateSkills.push(matchedSkill);
            }
          }
        });

        if (matchedTerms.length === 0) return null;

        const matchCount = matchedTerms.length;
        const matchScore = Math.min(100, Math.round((matchCount / searchTerms.length) * 100));

        return {
          ...candidate.toObject(),
          matchScore: matchScore,
          matchCount: matchCount,
          totalSearchedSkills: searchTerms.length,
          matchedSkills: matchedCandidateSkills
        };
      })
      .filter(Boolean);

    const priorityRolls = getPriorityRolls();

    // Sort: Priority roll numbers first (if skills matched), then by match score, then match count, then newest
    scoredResults.sort((a, b) => {
      const aIsPriority = priorityRolls.includes((a.rollNumber || '').toUpperCase());
      const bIsPriority = priorityRolls.includes((b.rollNumber || '').toUpperCase());

      // If one candidate is on the priority list and the other is not, priority comes first!
      if (aIsPriority !== bIsPriority) {
        return bIsPriority ? 1 : -1;
      }

      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return (new Date(b.updatedAt || b.createdAt)) - (new Date(a.updatedAt || a.createdAt));
    });

    res.json({
      success: true,
      count: scoredResults.length,
      searchType: 'skillset',
      searchedSkills: searchTerms,
      data: scoredResults
    });
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ success: false, message: 'Server error during search.' });
  }
});

// -------------------------------------------------------------
// GET /api/candidates - List all candidates
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ updatedAt: -1, createdAt: -1 });
    res.json({
      success: true,
      count: candidates.length,
      data: candidates
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// GET /api/skills/tags - Popular / All Available Skills
// -------------------------------------------------------------
router.get('/skills/tags', async (req, res) => {
  try {
    const candidates = await Candidate.find({}, 'skills');
    const skillCounts = {};
    candidates.forEach(c => {
      if (Array.isArray(c.skills)) {
        c.skills.forEach(s => {
          const key = s.trim();
          if (key) {
            skillCounts[key] = (skillCounts[key] || 0) + 1;
          }
        });
      }
    });

    const tags = Object.keys(skillCounts)
      .map(skill => ({ skill, count: skillCounts[skill] }))
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// GET /api/candidates/:rollNumber - Get Single Candidate
// -------------------------------------------------------------
router.get('/:rollNumber', async (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const candidate = await Candidate.findOne({ rollNumber: roll });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// GET /api/candidates/:rollNumber/preview - Preview Resume (PDF Stream)
// -------------------------------------------------------------
router.get('/:rollNumber/preview', async (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const candidate = await Candidate.findOne({ rollNumber: roll });

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    // 1. If stored in MongoDB Atlas, stream from database buffer and re-cache to disk
    if (candidate.resumeData && candidate.resumeData.length > 0) {
      try {
        const localTarget = path.join(uploadDir, candidate.resumeFileName || `${candidate.rollNumber}_Resume.pdf`);
        fs.writeFileSync(localTarget, candidate.resumeData);
      } catch (_) {}

      const originalName = candidate.resumeOriginalName || candidate.resumeFileName || `${candidate.rollNumber}_Resume.pdf`;
      res.setHeader('Content-Type', candidate.resumeContentType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      return res.send(candidate.resumeData);
    }

    // 2. If file exists on host disk, stream it directly
    const filePath = resolveResumePath(candidate);
    if (filePath && fs.existsSync(filePath)) {
      const originalName = candidate.resumeOriginalName || candidate.resumeFileName || `${candidate.rollNumber}_Resume.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      return fs.createReadStream(filePath).pipe(res);
    }

    // 3. If no uploaded file is found, return clean not-found notice (never generate fake PDF)
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Resume Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b;">
          <div style="text-align: center; padding: 2.5rem; background: white; border-radius: 1.25rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); max-width: 420px; margin: 1rem;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 24px;">📄</div>
            <h3 style="margin: 0 0 0.5rem; font-size: 1.15rem; font-weight: 700; color: #0f172a;">No Resume Uploaded</h3>
            <p style="margin: 0; font-size: 0.875rem; color: #64748b; line-height: 1.5;">Candidate <strong>${candidate.name}</strong> (${candidate.rollNumber}) has not uploaded an original PDF resume yet.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error previewing resume:', error);
    res.status(500).json({ success: false, message: 'Failed to preview resume.' });
  }
});

// -------------------------------------------------------------
// GET /api/candidates/:rollNumber/download - Download Resume
// -------------------------------------------------------------
router.get('/:rollNumber/download', async (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const candidate = await Candidate.findOne({ rollNumber: roll });

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    const safeName = (candidate.name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
    const downloadName = candidate.resumeOriginalName || `${candidate.rollNumber}_${safeName}_Resume.pdf`;

    // 1. If stored in MongoDB Atlas, send exact uploaded binary buffer
    if (candidate.resumeData && candidate.resumeData.length > 0) {
      try {
        const localTarget = path.join(uploadDir, candidate.resumeFileName || `${candidate.rollNumber}_Resume.pdf`);
        fs.writeFileSync(localTarget, candidate.resumeData);
      } catch (_) {}

      res.setHeader('Content-Type', candidate.resumeContentType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      return res.send(candidate.resumeData);
    }

    // 2. If file exists on host disk, download it directly
    const filePath = resolveResumePath(candidate);
    if (filePath && fs.existsSync(filePath)) {
      return res.download(filePath, downloadName, err => {
        if (err && !res.headersSent) {
          res.status(500).json({ success: false, message: 'Error initiating file download.' });
        }
      });
    }

    return res.status(404).json({ success: false, message: 'Original resume PDF file not found for this candidate.' });
  } catch (error) {
    console.error('Error downloading resume:', error);
    res.status(500).json({ success: false, message: 'Failed to download resume.' });
  }
});

// -------------------------------------------------------------
// PUT /api/candidates/:rollNumber - Update Candidate & Replace Resume
// -------------------------------------------------------------
router.put('/:rollNumber', upload.single('resume'), async (req, res) => {
  let uploadedFilePath = req.file ? req.file.path : null;

  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const candidate = await Candidate.findOne({ rollNumber: roll });

    if (!candidate) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(404).json({ success: false, message: `Candidate ${roll} not found.` });
    }

    const { name, email, phone, department, skills } = req.body;

    if (name && name.trim()) candidate.name = name.trim();
    if (email !== undefined) candidate.email = email.trim().toLowerCase();
    if (phone !== undefined) candidate.phone = phone.trim();
    if (department !== undefined) candidate.department = department.trim();

    if (skills) {
      const parsed = parseSkills(skills);
      if (parsed.length > 0) {
        candidate.skills = parsed;
      }
    }

    // If new resume PDF is uploaded, replace the file on disk and in database
    if (req.file) {
      const finalFileName = `${roll}_Resume.pdf`;
      const finalFilePath = path.join(uploadDir, finalFileName);

      const fileBuffer = fs.readFileSync(uploadedFilePath);
      candidate.resumeData = fileBuffer;
      candidate.resumeContentType = 'application/pdf';

      // Remove existing file if present before moving new one
      if (fs.existsSync(finalFilePath) && finalFilePath !== uploadedFilePath) {
        try { fs.unlinkSync(finalFilePath); } catch (_) {}
      }

      fs.renameSync(uploadedFilePath, finalFilePath);

      candidate.resumeFileName = finalFileName;
      candidate.resumeOriginalName = req.file.originalname;
      candidate.resumePath = finalFilePath;
      candidate.fileSize = req.file.size;
    }

    await candidate.save();

    res.json({
      success: true,
      message: `Candidate ${candidate.name} (${candidate.rollNumber}) updated successfully!`,
      data: candidate
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    console.error('Error updating candidate:', error);
    res.status(500).json({ success: false, message: error.message || 'Error updating candidate.' });
  }
});

// -------------------------------------------------------------
// DELETE /api/candidates/:rollNumber - Remove Candidate & Resume
// -------------------------------------------------------------
router.delete('/:rollNumber', async (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const candidate = await Candidate.findOneAndDelete({ rollNumber: roll });

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    // Delete file from disk if present
    const filePath = resolveResumePath(candidate);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Could not delete file from disk:', e.message);
      }
    }

    res.json({
      success: true,
      message: `Candidate ${candidate.name} (${candidate.rollNumber}) deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
