# 🎓 ResumeFinder • Placement & Talent Retrieval Portal

A premium iOS-styled web application built with **Node.js, Express, and MongoDB Atlas** to search, preview, and download candidate resumes by **Skillset** or unique **Roll Number**.

---

## 🌟 Key Features

1. **Dual Smart Search Engine**:
   - **Search by Skillset**: Type skills (e.g. `ReactJS, NodeJS, ExpressJS`) $\rightarrow$ instantly calculates and ranks candidates with match scores (e.g. `100% Match (3/3)`).
   - **Search by Roll Number**: Type any roll number (e.g. `21CS101`) $\rightarrow$ immediately locates that exact student.

2. **Backend Storage by Roll Number**:
   - Resumes are stored on disk cleanly indexed by roll number: `uploads/resumes/<RollNumber>_Resume.pdf`.
   - Roll numbers are enforced as unique in MongoDB to avoid duplicates.

3. **Preview & Instant Download**:
   - **Preview**: Opens the PDF resume directly in an iOS-style popup sheet modal without cluttering your downloads folder.
   - **Download**: One-click download with standardized filenames ready to forward: `<RollNumber>_<Name>_Resume.pdf`.

4. **100% Isolated Database**:
   - Connected to MongoDB Atlas with database name strictly set to `resume_portal`.
   - Your other database (`test`) remains completely isolated and untouched.

5. **Apple / iOS Aesthetic**:
   - Frosted glass textures (`backdrop-blur`), SF Pro typography, smooth animations, segmented control switcher, and mobile responsiveness.

---

## 🚀 Running the Project

The server is currently running on:
**[http://localhost:5000](http://localhost:5000)**

If you ever restart your computer or stop the server, simply run:
```bash
cd "C:\Users\sashi\.gemini\antigravity\scratch\resume-portal"
npm start
```

---

## 📂 Project Structure

```
resume-portal/
├── models/
│   └── Candidate.js          # Mongoose schema with unique rollNumber index
├── routes/
│   └── candidateRoutes.js    # Upload, search, preview, download, and delete APIs
├── uploads/
│   └── resumes/              # Permanent storage for candidate PDF resumes
├── public/
│   ├── index.html            # Premium iOS responsive interface
│   ├── style.css             # Apple frosted glass & animations
│   └── app.js                # Search, preview modal, tag inputs, and toasts
├── .env                      # Environment config with isolated MongoDB URI
├── server.js                 # Express server & Atlas connection
├── seed.js                   # Script that generates sample candidates with real PDFs
└── package.json
```
