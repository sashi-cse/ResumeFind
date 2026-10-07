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

// Text wrapping utility for clean PDF rendering
function wrapText(text, maxChars = 92) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Function to generate a comprehensive, professional A4 PDF resume
async function createSamplePdf(candidate) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const { width, height } = page.getSize();
  const marginX = 36;

  // 1. Executive Slate Navy Top Header
  const headerHeight = 92;
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width: width,
    height: headerHeight,
    color: rgb(15 / 255, 23 / 255, 42 / 255) // Slate 900
  });

  // Apple Blue Accent Line
  page.drawRectangle({
    x: 0,
    y: height - headerHeight - 3,
    width: width,
    height: 3,
    color: rgb(0 / 255, 113 / 255, 227 / 255)
  });

  // Candidate Name
  page.drawText(candidate.name, {
    x: marginX,
    y: height - 32,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  // Professional Title / Specialization
  page.drawText(candidate.title || 'Software Engineer', {
    x: marginX,
    y: height - 48,
    size: 11,
    font: fontBold,
    color: rgb(56 / 255, 189 / 255, 248 / 255) // Sky Blue
  });

  // Academic Meta Info
  const cgpaText = candidate.education ? candidate.education.cgpa : '9.0 / 10.0';
  const metaText = `Roll No: ${candidate.rollNumber}   |   Department: ${candidate.department}   |   CGPA: ${cgpaText}`;
  page.drawText(metaText, {
    x: marginX,
    y: height - 66,
    size: 8.5,
    font: font,
    color: rgb(203 / 255, 213 / 255, 225 / 255) // Slate 300
  });

  // Contact Info
  const contactText = `Email: ${candidate.email}   |   Phone: ${candidate.phone}   |   LinkedIn: ${candidate.linkedin || 'linkedin.com/in/' + candidate.rollNumber.toLowerCase()}`;
  page.drawText(contactText, {
    x: marginX,
    y: height - 80,
    size: 8,
    font: font,
    color: rgb(148 / 255, 163 / 255, 184 / 255) // Slate 400
  });

  let currentY = height - headerHeight - 20;

  // Helper for Section Dividers
  function drawSectionHeader(title) {
    currentY -= 6;
    page.drawText(title, {
      x: marginX,
      y: currentY,
      size: 9.5,
      font: fontBold,
      color: rgb(15 / 255, 23 / 255, 42 / 255)
    });

    page.drawLine({
      start: { x: marginX, y: currentY - 3 },
      end: { x: width - marginX, y: currentY - 3 },
      thickness: 1,
      color: rgb(226 / 255, 232 / 255, 240 / 255)
    });
    currentY -= 14;
  }

  // --- SECTION: PROFESSIONAL SUMMARY ---
  drawSectionHeader('PROFESSIONAL SUMMARY');
  const summaryLines = wrapText(candidate.summary, 94);
  for (const line of summaryLines) {
    page.drawText(line, {
      x: marginX,
      y: currentY,
      size: 8.5,
      font: font,
      color: rgb(51 / 255, 65 / 255, 85 / 255)
    });
    currentY -= 11.5;
  }
  currentY -= 4;

  // --- SECTION: TECHNICAL SKILLS ---
  drawSectionHeader('CORE TECHNICAL SKILLS');
  if (candidate.skillCategories) {
    for (const [catName, catSkills] of Object.entries(candidate.skillCategories)) {
      page.drawText(`• ${catName}: `, {
        x: marginX,
        y: currentY,
        size: 8.5,
        font: fontBold,
        color: rgb(15 / 255, 23 / 255, 42 / 255)
      });
      const labelWidth = fontBold.widthOfTextAtSize(`• ${catName}: `, 8.5);
      page.drawText(catSkills, {
        x: marginX + labelWidth,
        y: currentY,
        size: 8.5,
        font: font,
        color: rgb(51 / 255, 65 / 255, 85 / 255)
      });
      currentY -= 12;
    }
  } else {
    const skillsText = candidate.skills.map(s => s.toUpperCase()).join('  •  ');
    page.drawText(`• Skills: ${skillsText}`, {
      x: marginX,
      y: currentY,
      size: 8.5,
      font: fontBold,
      color: rgb(0 / 255, 113 / 255, 227 / 255)
    });
    currentY -= 14;
  }
  currentY -= 4;

  // --- SECTION: EXPERIENCE & INTERNSHIPS ---
  drawSectionHeader('WORK EXPERIENCE & INTERNSHIPS');
  if (candidate.experience && candidate.experience.length > 0) {
    for (const exp of candidate.experience) {
      page.drawText(exp.role, {
        x: marginX,
        y: currentY,
        size: 9,
        font: fontBold,
        color: rgb(15 / 255, 23 / 255, 42 / 255)
      });
      const roleWidth = fontBold.widthOfTextAtSize(exp.role, 9);
      page.drawText(` | ${exp.company}`, {
        x: marginX + roleWidth,
        y: currentY,
        size: 9,
        font: fontItalic,
        color: rgb(71 / 255, 85 / 255, 105 / 255)
      });

      const durationWidth = font.widthOfTextAtSize(exp.duration, 8);
      page.drawText(exp.duration, {
        x: width - marginX - durationWidth,
        y: currentY,
        size: 8,
        font: font,
        color: rgb(100 / 255, 116 / 255, 139 / 255)
      });
      currentY -= 12;

      for (const bullet of exp.bullets) {
        const lines = wrapText(`-  ${bullet}`, 90);
        for (let i = 0; i < lines.length; i++) {
          page.drawText(lines[i], {
            x: marginX + (i > 0 ? 10 : 0),
            y: currentY,
            size: 8.2,
            font: font,
            color: rgb(51 / 255, 65 / 255, 85 / 255)
          });
          currentY -= 10.5;
        }
      }
      currentY -= 3;
    }
  }
  currentY -= 3;

  // --- SECTION: FEATURED PROJECTS ---
  drawSectionHeader('FEATURED TECHNICAL PROJECTS');
  if (candidate.projects && candidate.projects.length > 0) {
    for (const proj of candidate.projects) {
      page.drawText(proj.name, {
        x: marginX,
        y: currentY,
        size: 9,
        font: fontBold,
        color: rgb(15 / 255, 23 / 255, 42 / 255)
      });
      const nameW = fontBold.widthOfTextAtSize(proj.name, 9);
      if (proj.tech) {
        page.drawText(` (${proj.tech})`, {
          x: marginX + nameW,
          y: currentY,
          size: 8,
          font: fontItalic,
          color: rgb(0 / 255, 113 / 255, 227 / 255)
        });
      }
      currentY -= 11.5;

      for (const bullet of proj.bullets) {
        const lines = wrapText(`-  ${bullet}`, 90);
        for (let i = 0; i < lines.length; i++) {
          page.drawText(lines[i], {
            x: marginX + (i > 0 ? 10 : 0),
            y: currentY,
            size: 8.2,
            font: font,
            color: rgb(51 / 255, 65 / 255, 85 / 255)
          });
          currentY -= 10.5;
        }
      }
      currentY -= 3;
    }
  }
  currentY -= 3;

  // --- SECTION: EDUCATION ---
  drawSectionHeader('EDUCATION & ACADEMIC BACKGROUND');
  if (candidate.education) {
    const edu = candidate.education;
    page.drawText(edu.degree, {
      x: marginX,
      y: currentY,
      size: 9,
      font: fontBold,
      color: rgb(15 / 255, 23 / 255, 42 / 255)
    });
    const degW = fontBold.widthOfTextAtSize(edu.degree, 9);
    page.drawText(`  •  ${edu.institution}`, {
      x: marginX + degW,
      y: currentY,
      size: 8.5,
      font: font,
      color: rgb(71 / 255, 85 / 255, 105 / 255)
    });

    const yrW = font.widthOfTextAtSize(edu.year || '2021 - 2025', 8);
    page.drawText(edu.year || '2021 - 2025', {
      x: width - marginX - yrW,
      y: currentY,
      size: 8,
      font: font,
      color: rgb(100 / 255, 116 / 255, 139 / 255)
    });
    currentY -= 12;

    const details = `CGPA: ${edu.cgpa}   |   Relevant Coursework: ${edu.coursework || 'Data Structures, Operating Systems, DBMS'}`;
    page.drawText(details, {
      x: marginX,
      y: currentY,
      size: 8,
      font: font,
      color: rgb(71 / 255, 85 / 255, 105 / 255)
    });
    currentY -= 14;
  }
  currentY -= 3;

  // --- SECTION: CERTIFICATIONS & ACHIEVEMENTS ---
  if (candidate.certifications && candidate.certifications.length > 0) {
    drawSectionHeader('CERTIFICATIONS & HONORS');
    for (const cert of candidate.certifications) {
      page.drawText(`•  ${cert}`, {
        x: marginX,
        y: currentY,
        size: 8.2,
        font: font,
        color: rgb(51 / 255, 65 / 255, 85 / 255)
      });
      currentY -= 11;
    }
  }

  // --- FOOTER BANNER ---
  page.drawLine({
    start: { x: marginX, y: 34 },
    end: { x: width - marginX, y: 34 },
    thickness: 0.8,
    color: rgb(203 / 255, 213 / 255, 225 / 255)
  });

  const footerText = `Official Placement & Training Cell Verified Record  •  Candidate ID: ${candidate.rollNumber}  •  Campus Placement Portal`;
  const footerW = font.widthOfTextAtSize(footerText, 7.5);
  page.drawText(footerText, {
    x: (width - footerW) / 2,
    y: 22,
    size: 7.5,
    font: font,
    color: rgb(148 / 255, 163 / 255, 184 / 255)
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(uploadDir, candidate.resumeFileName);
  fs.writeFileSync(filePath, pdfBytes);
  return filePath;
}

const sampleCandidates = [
  // 1. Priority Candidate - Full-Stack Developer & Cloud Architect
  {
    rollNumber: '21CS101',
    name: 'Rahul Sharma',
    title: 'Full-Stack Software Engineer & Cloud Architect',
    department: 'Computer Science & Engineering',
    email: 'rahul.sharma@college.edu',
    phone: '+91 98765 43210',
    linkedin: 'linkedin.com/in/rahul-sharma-cs',
    summary: 'Proactive Full-Stack Software Engineer with proven expertise in building resilient React & Node.js microservices, distributed cloud architecture, and high-concurrency database systems.',
    skills: ['reactjs', 'nodejs', 'expressjs', 'mongodb', 'javascript', 'typescript', 'docker', 'aws'],
    skillCategories: {
      'Languages': 'JavaScript (ES6+), TypeScript, Python, C++, SQL',
      'Frameworks & Web': 'React.js, Next.js, Node.js, Express.js, Redux Toolkit, Tailwind CSS',
      'Databases & Cloud': 'MongoDB, Redis, PostgreSQL, AWS (S3, EC2, Lambda), Docker',
      'DevOps & Tools': 'Git, GitHub Actions CI/CD, RESTful APIs, Microservices, Agile Scrum'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science & Engineering',
      institution: 'National Institute of Technology',
      year: '2021 - 2025',
      cgpa: '9.15 / 10.0',
      coursework: 'Data Structures & Algorithms, Distributed Systems, DBMS, Operating Systems'
    },
    experience: [
      {
        role: 'Full-Stack Software Engineering Intern',
        company: 'TechVanguard Solutions',
        duration: 'May 2024 - July 2024',
        bullets: [
          'Architected and deployed microservices backend serving 25k+ daily active users with 99.9% uptime SLA.',
          'Optimized MongoDB indexes and aggregation pipelines, reducing average endpoint latency by 42%.'
        ]
      }
    ],
    projects: [
      {
        name: 'Cloud-Native Collaborative Workspace',
        tech: 'React, Node.js, Express, MongoDB, Socket.io',
        bullets: [
          'Engineered real-time document editor with operational transformation syncing 50+ concurrent editors.',
          'Integrated JWT authentication, role-based access control (RBAC), and automated PDF export pipeline.'
        ]
      },
      {
        name: 'High-Performance Distributed Task Queue',
        tech: 'Node.js, Redis, Docker, RabbitMQ',
        bullets: [
          'Implemented asynchronous worker pool processing 5,000+ background jobs per minute with retry logic.'
        ]
      }
    ],
    certifications: [
      'AWS Certified Solutions Architect - Associate (2024)',
      'Meta Front-End Developer Professional Certificate (Coursera)',
      'LeetCode Knight: 550+ algorithmic problems solved with 2,100+ contest rating'
    ],
    resumeFileName: '21CS101_Resume.pdf'
  },

  // 2. Modern Frontend & Next.js Engineer
  {
    rollNumber: '21IT042',
    name: 'Ananya Patel',
    title: 'Frontend Engineer & UI Systems Architect',
    department: 'Information Technology',
    email: 'ananya.patel@college.edu',
    phone: '+91 98111 22334',
    linkedin: 'linkedin.com/in/ananya-patel-it',
    summary: 'Frontend engineer specializing in building high-performance, accessible (WCAG compliant) web applications using React, Next.js, TypeScript, and modern CSS architecture.',
    skills: ['reactjs', 'typescript', 'tailwind', 'nextjs', 'nodejs', 'redux', 'jest'],
    skillCategories: {
      'Languages': 'TypeScript, JavaScript, HTML5, CSS3, Sass',
      'Frameworks & Libraries': 'React.js, Next.js 14, Redux Toolkit, Tailwind CSS, Framer Motion',
      'Testing & Tooling': 'Jest, React Testing Library, Storybook, Vite, Webpack, Git',
      'Core Competencies': 'Web Performance Optimization, Core Web Vitals, Responsive Design, a11y'
    },
    education: {
      degree: 'Bachelor of Technology in Information Technology',
      institution: 'Institute of Engineering & Technology',
      year: '2021 - 2025',
      cgpa: '8.95 / 10.0',
      coursework: 'Object-Oriented Software Design, Human-Computer Interaction, Web Technologies'
    },
    experience: [
      {
        role: 'Frontend Engineering Intern',
        company: 'PixelCraft Interactive',
        duration: 'Jan 2024 - Apr 2024',
        bullets: [
          'Spearheaded migration of legacy jQuery portals to Next.js 14, improving page load speeds by 65%.',
          'Developed accessible UI component library adopted across 6 internal engineering squads.'
        ]
      }
    ],
    projects: [
      {
        name: 'Enterprise Next.js E-Commerce Platform',
        tech: 'Next.js 14, TypeScript, Tailwind, Stripe',
        bullets: [
          'Built server-rendered marketplace with instantaneous client transitions, edge caching, and cart state.',
          'Attained perfect 100/100 Google Lighthouse score on SEO, Accessibility, and Best Practices.'
        ]
      },
      {
        name: 'Interactive Motion Design System',
        tech: 'React, Tailwind CSS, Storybook',
        bullets: [
          'Created reusable, themeable component library with 40+ atomic elements and dark mode support.'
        ]
      }
    ],
    certifications: [
      'Meta React Native & Frontend Developer Specialization',
      'Google Mobile Web Specialist Certification'
    ],
    resumeFileName: '21IT042_Resume.pdf'
  },

  // 3. AI & Deep Learning Systems Engineer
  {
    rollNumber: '22AI015',
    name: 'Vikramaditya Roy',
    title: 'Machine Learning & Backend Systems Engineer',
    department: 'AI & Data Science',
    email: 'vikram.roy@college.edu',
    phone: '+91 97222 33445',
    linkedin: 'linkedin.com/in/vikram-roy-ai',
    summary: 'AI researcher and engineer with deep knowledge in deep neural networks, transformer models, FastAPI microservices, and high-performance vector databases.',
    skills: ['python', 'machine learning', 'sql', 'fastapi', 'docker', 'pytorch', 'scikit-learn'],
    skillCategories: {
      'Languages': 'Python, C++, SQL, Bash Scripting',
      'ML & Deep Learning': 'PyTorch, TensorFlow, Scikit-Learn, Hugging Face Transformers, OpenCV',
      'Backend & MLOps': 'FastAPI, Flask, Docker, MLflow, Triton Server, FAISS, PostgreSQL',
      'Core Competencies': 'Vector Embeddings, LLM Fine-Tuning, Computer Vision, Model Quantization'
    },
    education: {
      degree: 'Bachelor of Technology in AI & Data Science',
      institution: 'University School of Information Technology',
      year: '2022 - 2026',
      cgpa: '9.30 / 10.0',
      coursework: 'Machine Learning, Deep Neural Networks, Applied Linear Algebra, Probability'
    },
    experience: [
      {
        role: 'AI & ML Engineering Intern',
        company: 'DeepCognition Labs',
        duration: 'May 2024 - Aug 2024',
        bullets: [
          'Fine-tuned transformer models for multi-label technical document classification achieving 94.2% F1 score.',
          'Deployed containerized inference pipelines on AWS EC2 GPU instances with sub-50ms latency.'
        ]
      }
    ],
    projects: [
      {
        name: 'Multimodal Semantic Search Engine',
        tech: 'Python, FastAPI, PyTorch, FAISS, Docker',
        bullets: [
          'Indexed 500,000+ academic papers with hybrid keyword and dense vector similarity search.',
          'Implemented re-ranking pipeline improving retrieval precision by 28% over pure BM25 search.'
        ]
      },
      {
        name: 'Real-Time Industrial Defect Detection',
        tech: 'Python, PyTorch, OpenCV, Flask',
        bullets: [
          'Trained YOLOv8 object detector achieving 97.4% mAP for assembly line automated quality control.'
        ]
      }
    ],
    certifications: [
      'DeepLearning.AI Deep Learning Specialization (Andrew Ng)',
      'NVIDIA Deep Learning Institute Certificate: Fundamentals of Deep Learning'
    ],
    resumeFileName: '22AI015_Resume.pdf'
  },

  // 4. Enterprise Java & Microservices Specialist
  {
    rollNumber: '21CS088',
    name: 'Sneha Kulkarni',
    title: 'Enterprise Java & Distributed Backend Engineer',
    department: 'Computer Science & Engineering',
    email: 'sneha.k@college.edu',
    phone: '+91 98333 44556',
    linkedin: 'linkedin.com/in/sneha-kulkarni-cs',
    summary: 'Backend specialist with deep proficiency in Java, Spring Boot, microservices architectures, Kafka distributed messaging, and enterprise relational database optimization.',
    skills: ['java', 'spring boot', 'mysql', 'microservices', 'docker', 'kafka', 'hibernate'],
    skillCategories: {
      'Languages': 'Java 17/21, SQL, Python, Go',
      'Frameworks': 'Spring Boot 3, Spring Cloud, Hibernate / JPA, JUnit, Mockito',
      'Messaging & DB': 'Apache Kafka, RabbitMQ, MySQL, PostgreSQL, Redis',
      'Infrastructure': 'Docker, Kubernetes, Jenkins, Maven, Prometheus, Grafana'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science & Engineering',
      institution: 'College of Engineering Pune',
      year: '2021 - 2025',
      cgpa: '9.05 / 10.0',
      coursework: 'Enterprise Software Engineering, Database Systems, Computer Networks'
    },
    experience: [
      {
        role: 'Backend Software Engineering Intern',
        company: 'FinServe Technologies',
        duration: 'Jun 2024 - Aug 2024',
        bullets: [
          'Developed core payment reconciliation services handling over $2.5M daily simulated transactions.',
          'Implemented event-driven architecture using Kafka, decoupling notification and billing microservices.'
        ]
      }
    ],
    projects: [
      {
        name: 'High-Throughput Core Banking Ledger Service',
        tech: 'Java 21, Spring Boot, MySQL, Kafka',
        bullets: [
          'Built ACID-compliant multi-tenant ledger service with double-entry bookkeeping and JWT security.',
          'Implemented distributed locking with Redis to guarantee zero race conditions on concurrent balance debits.'
        ]
      },
      {
        name: 'Resilient Order Management Engine',
        tech: 'Spring Cloud, Resilience4j, Docker',
        bullets: [
          'Implemented fault-tolerant circuit breaker, rate limiting, and retry patterns with Eureka service discovery.'
        ]
      }
    ],
    certifications: [
      'Oracle Certified Professional: Java SE 11 Developer',
      'Spring Professional Certification (VMware)'
    ],
    resumeFileName: '21CS088_Resume.pdf'
  },

  // 5. Mobile Engineer (Flutter & iOS)
  {
    rollNumber: '21IT023',
    name: 'Arjun Mehta',
    title: 'Mobile Application Engineer (Flutter & iOS)',
    department: 'Information Technology',
    email: 'arjun.mehta@college.edu',
    phone: '+91 98444 55667',
    linkedin: 'linkedin.com/in/arjun-mehta-mobile',
    summary: 'Mobile application engineer with 4+ published applications across iOS and Android. Expert in Flutter, Dart, BLoC state management, native platform channels, and offline-first architectures.',
    skills: ['flutter', 'dart', 'firebase', 'android', 'ios', 'sqlite', 'bloc'],
    skillCategories: {
      'Languages': 'Dart, Kotlin, Swift, JavaScript',
      'Frameworks': 'Flutter SDK, Android SDK, SwiftUI, BLoC, Provider, Riverpod',
      'Backend & Cloud': 'Firebase (Auth, Firestore, Cloud Functions), REST APIs, SQLite, Hive',
      'Tooling': 'Xcode, Android Studio, Git, Fastlane, TestFlight, Google Play Console'
    },
    education: {
      degree: 'Bachelor of Technology in Information Technology',
      institution: 'Maharaja Agrasen Institute of Technology',
      year: '2021 - 2025',
      cgpa: '8.78 / 10.0',
      coursework: 'Mobile Computing, Software Testing & Quality Assurance, Cloud Architectures'
    },
    experience: [
      {
        role: 'Mobile App Development Intern',
        company: 'AppNova Studios',
        duration: 'Feb 2024 - May 2024',
        bullets: [
          'Refactored state management to BLoC architecture, reducing memory overhead and crash rates by 32%.',
          'Integrated biometric authentication and background push notifications for 20,000+ active mobile users.'
        ]
      }
    ],
    projects: [
      {
        name: 'FitPulse - Offline-First Health & Fitness Tracker',
        tech: 'Flutter, Dart, SQLite, HealthKit',
        bullets: [
          'Built cross-platform fitness app with offline caching, pedometer sensor integration, and charts.',
          'Achieved 4.8-star rating on Google Play Store with 10k+ downloads and zero crash reports.'
        ]
      },
      {
        name: 'CampusMarket - Student Peer-to-Peer Exchange',
        tech: 'Flutter, Firebase, Cloud Storage',
        bullets: [
          'Developed campus marketplace with real-time in-app chat, push notifications, and image compression.'
        ]
      }
    ],
    certifications: [
      'Google Flutter Certified Developer',
      'Firebase Cloud Practitioner & Mobile Architect'
    ],
    resumeFileName: '21IT023_Resume.pdf'
  },

  // 6. Data Scientist & NLP Researcher
  {
    rollNumber: '22AI034',
    name: 'Priya Nambiar',
    title: 'Data Scientist & NLP Researcher',
    department: 'Data Science & AI',
    email: 'priya.n@college.edu',
    phone: '+91 98555 66778',
    linkedin: 'linkedin.com/in/priya-nambiar-ds',
    summary: 'Data Scientist with strong statistical foundation and extensive experience in Natural Language Processing, Hugging Face transformers, predictive modeling, and automated data pipelines.',
    skills: ['python', 'pandas', 'machine learning', 'nlp', 'tensorflow', 'huggingface', 'data science'],
    skillCategories: {
      'Languages': 'Python, R, SQL, Julia',
      'Data Science': 'Pandas, NumPy, SciPy, Matplotlib, Seaborn, Plotly',
      'ML & NLP': 'TensorFlow, Keras, Hugging Face, NLTK, spaCy, Scikit-Learn',
      'Tools & Databases': 'Jupyter, Streamlit, Tableau, PostgreSQL, BigQuery, Docker'
    },
    education: {
      degree: 'Bachelor of Technology in Data Science & AI',
      institution: 'Indian Institute of Information Technology',
      year: '2022 - 2026',
      cgpa: '9.25 / 10.0',
      coursework: 'Statistical Inference, Natural Language Processing, Big Data Analytics, Neural Networks'
    },
    experience: [
      {
        role: 'Data Science Intern',
        company: 'Synthetix Analytics',
        duration: 'May 2024 - Jul 2024',
        bullets: [
          'Analyzed 1.2M customer reviews using BERT topic modeling, uncovering 14 product defect patterns.',
          'Built automated executive reporting pipelines in Python, saving 15 engineering hours weekly.'
        ]
      }
    ],
    projects: [
      {
        name: 'LegalDoc NLP Summarizer & Entity Extractor',
        tech: 'Python, Transformers, PyTorch, Streamlit',
        bullets: [
          'Fine-tuned BART model for automated legal clause extraction and plain-English summarization.',
          'Deployed interactive web dashboard enabling lawyers to process 50-page agreements in under 10 seconds.'
        ]
      },
      {
        name: 'Customer Churn Prediction Engine',
        tech: 'Python, Pandas, XGBoost, SHAP',
        bullets: [
          'Trained predictive classifier reaching 91.5% ROC-AUC score with SHAP feature interpretability.'
        ]
      }
    ],
    certifications: [
      'Google Data Analytics Professional Certificate',
      'Hugging Face NLP Specialist Certificate'
    ],
    resumeFileName: '22AI034_Resume.pdf'
  },

  // 7. DevOps & Cloud Infrastructure Engineer
  {
    rollNumber: '21CS142',
    name: 'Karthik Nair',
    title: 'DevOps & Cloud Infrastructure Engineer',
    department: 'Computer Science & Engineering',
    email: 'karthik.nair@college.edu',
    phone: '+91 98666 77889',
    linkedin: 'linkedin.com/in/karthik-nair-devops',
    summary: 'Cloud infrastructure engineer passionate about declarative GitOps, Kubernetes container orchestration, Terraform Infrastructure as Code, and automated multi-environment CI/CD.',
    skills: ['devops', 'aws', 'docker', 'kubernetes', 'ci/cd', 'linux', 'terraform', 'jenkins'],
    skillCategories: {
      'Cloud & Platforms': 'AWS (EKS, EC2, S3, RDS, CloudFront), Google Cloud Platform (GCP)',
      'Containers & Mesh': 'Docker, Kubernetes, Helm, ArgoCD, Docker Compose',
      'Infrastructure as Code': 'Terraform, Ansible, CloudFormation',
      'CI/CD & Monitoring': 'GitHub Actions, Jenkins, Prometheus, Grafana, ELK Stack, Linux/Bash'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science',
      institution: 'National Institute of Engineering',
      year: '2021 - 2025',
      cgpa: '8.82 / 10.0',
      coursework: 'Computer Networks, Linux Systems Programming, Cloud Computing'
    },
    experience: [
      {
        role: 'Cloud Infrastructure Intern',
        company: 'ScaleGrid Cloud Systems',
        duration: 'May 2024 - Aug 2024',
        bullets: [
          'Engineered GitHub Actions CI/CD pipelines reducing deployment cycle time from 40 mins to 8 mins.',
          'Authored reusable Terraform modules provisioning multi-region VPC and EKS clusters with security hardening.'
        ]
      }
    ],
    projects: [
      {
        name: 'High-Availability Kubernetes Cluster with GitOps',
        tech: 'Kubernetes, ArgoCD, Helm, AWS EKS',
        bullets: [
          'Deployed enterprise microservices cluster with automated canary rollouts and Prometheus alerts.'
        ]
      },
      {
        name: 'Zero-Downtime Multi-Tier Deployment Automation',
        tech: 'Docker, Jenkins, AWS ECS, Bash',
        bullets: [
          'Automated Docker image vulnerability scanning with Trivy and automated blue-green cutover.'
        ]
      }
    ],
    certifications: [
      'AWS Certified Solutions Architect - Associate',
      'Certified Kubernetes Administrator (CKA - Linux Foundation)'
    ],
    resumeFileName: '21CS142_Resume.pdf'
  },

  // 8. Embedded Systems & IoT Engineer
  {
    rollNumber: '22EC019',
    name: 'Rohan Verma',
    title: 'Embedded Systems & IoT Firmware Engineer',
    department: 'Electronics & Communication',
    email: 'rohan.v@college.edu',
    phone: '+91 98777 88990',
    linkedin: 'linkedin.com/in/rohan-verma-embedded',
    summary: 'Hardware-software integration engineer with hands-on expertise in microcontroller programming (STM32, ESP32), FreeRTOS real-time scheduling, low-power IoT telemetry, and embedded C/C++.',
    skills: ['c++', 'embedded c', 'iot', 'python', 'arduino', 'raspberry pi', 'esp32', 'rtos'],
    skillCategories: {
      'Languages': 'Embedded C, C++20, Python, Assembly',
      'Hardware & MCUs': 'ARM Cortex-M, STM32, ESP32, Arduino, Raspberry Pi, Nordic nRF',
      'Protocols': 'I2C, SPI, UART, CAN, MQTT, BLE, CoAP, Zigbee',
      'Tools & RTOS': 'FreeRTOS, Keil uVision, STM32CubeIDE, Logic Analyzer, KiCad'
    },
    education: {
      degree: 'Bachelor of Technology in Electronics & Communication',
      institution: 'Delhi Technological University',
      year: '2022 - 2026',
      cgpa: '8.65 / 10.0',
      coursework: 'Microprocessors & Microcontrollers, Digital Signal Processing, Embedded Systems'
    },
    experience: [
      {
        role: 'Firmware Engineering Intern',
        company: 'SenseTech Instruments',
        duration: 'Jan 2024 - Jun 2024',
        bullets: [
          'Programmed low-power sensor drivers on ESP32 MCUs operating with FreeRTOS task queues.',
          'Extended sensor battery operating lifetime by 45% utilizing deep-sleep modes and burst telemetry.'
        ]
      }
    ],
    projects: [
      {
        name: 'Industrial IoT Predictive Telemetry Node',
        tech: 'Embedded C, ESP32, MQTT, AWS IoT Core',
        bullets: [
          'Deployed vibration and thermal monitoring nodes streaming live machine health metrics to AWS.'
        ]
      },
      {
        name: 'Autonomous Obstacle-Avoiding Robotics Rover',
        tech: 'C++, ROS, Raspberry Pi, LiDAR',
        bullets: [
          'Implemented SLAM navigation algorithms and sensor fusion combining ultrasonic and LiDAR readings.'
        ]
      }
    ],
    certifications: [
      'ARM Embedded Systems Architecture Certificate',
      'Embedded Linux System Development (The Linux Foundation)'
    ],
    resumeFileName: '22EC019_Resume.pdf'
  },

  // 9. Algorithms & Competitive Programming Specialist (BABA PANDEY)
  {
    rollNumber: '23630',
    name: 'BABA PANDEY',
    title: 'Algorithms & Competitive Programming Specialist',
    department: 'Computer Science & Engineering',
    email: 'baba.pandey@college.edu',
    phone: '+91 99000 11223',
    linkedin: 'linkedin.com/in/baba-pandey-cp',
    summary: 'Competitive programmer with 1,200+ solved problems across LeetCode and Codeforces. Expert in algorithmic time-space complexity optimization, Graph Theory, and Dynamic Programming.',
    skills: ['dsa', 'c++', 'java', 'problem solving', 'algorithms', 'python', 'data structures'],
    skillCategories: {
      'Languages': 'C++ (C++17/20), Java, Python, SQL',
      'Algorithmic Domains': 'Advanced Graph Algorithms, Dynamic Programming, Segment Trees, Trie, Greedy',
      'Core Computer Science': 'Object-Oriented Programming (OOP), OS, Database Management Systems, System Design',
      'Competitive Platforms': 'LeetCode (Knight), Codeforces (Candidate Master), CodeChef (5-Star), HackerRank'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science & Engineering',
      institution: 'National Institute of Technology',
      year: '2023 - 2027',
      cgpa: '9.40 / 10.0',
      coursework: 'Advanced Algorithms, Discrete Mathematics, Theory of Computation, Data Structures'
    },
    experience: [
      {
        role: 'Algorithmic Problem Setter & Peer Mentor',
        company: 'University Competitive Programming Club',
        duration: 'Aug 2023 - Present',
        bullets: [
          'Authored 30+ contest problems on Advanced Graph Algorithms and Dynamic Programming for 500+ participants.',
          'Conducted algorithmic workshops covering recursion, binary search, and trees for 150+ undergraduates.'
        ]
      }
    ],
    projects: [
      {
        name: 'Real-Time Algorithm Visualizer & Benchmarker',
        tech: 'C++, WebAssembly, React, TypeScript',
        bullets: [
          'Built interactive visualization engine executing pathfinding and sorting algorithms with step-by-step memory tracking.',
          'Benchmarked custom algorithms against standard C++ STL containers across large randomized datasets.'
        ]
      },
      {
        name: 'High-Performance In-Memory Graph Engine',
        tech: 'C++20, STL, Multi-Threading',
        bullets: [
          'Implemented ultra-fast graph traversal engine running Dijkstra and Tarjan SCC on 1M+ vertices under 40ms.'
        ]
      }
    ],
    certifications: [
      'Codeforces Candidate Master (Top 2% globally)',
      'LeetCode Knight Rating: 2,150+ (Top 1.5% globally)',
      'ACM-ICPC Regionalist (2024)'
    ],
    resumeFileName: '23630_Resume.pdf'
  },

  // 10. Cybersecurity & Information Security Analyst (NEW)
  {
    rollNumber: '21CS055',
    name: 'Divya Iyer',
    title: 'Cybersecurity & Information Security Analyst',
    department: 'Computer Science & Engineering',
    email: 'divya.iyer@college.edu',
    phone: '+91 98888 11223',
    linkedin: 'linkedin.com/in/divya-iyer-sec',
    summary: 'Security analyst specializing in penetration testing, vulnerability assessment, network traffic inspection, secure coding practices (OWASP Top 10), and Linux system hardening.',
    skills: ['cybersecurity', 'ethical hacking', 'linux', 'python', 'networking', 'wireshark', 'penetration testing'],
    skillCategories: {
      'Security Domains': 'Network Security, Web Application Penetration Testing, Threat Hunting, Cryptography',
      'Tools & Software': 'Wireshark, Nmap, Burp Suite, Metasploit, Snort, John the Ripper, Ghidra',
      'Operating Systems': 'Kali Linux, Ubuntu Server, Red Hat Enterprise Linux, Windows Security',
      'Languages': 'Python, Bash Scripting, C, SQL'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science & Engineering',
      institution: 'Government College of Technology',
      year: '2021 - 2025',
      cgpa: '9.15 / 10.0',
      coursework: 'Information Security, Computer Networks, Cryptography & Network Security'
    },
    experience: [
      {
        role: 'Information Security Intern',
        company: 'CyberDefend Solutions',
        duration: 'May 2024 - Aug 2024',
        bullets: [
          'Performed vulnerability scans and web penetration tests across 12 client assets, reporting 18 critical CVEs.',
          'Automated security log analysis using custom Python scripts, reducing incident triage time by 50%.'
        ]
      }
    ],
    projects: [
      {
        name: 'Automated Network Intrusion Detection System',
        tech: 'Python, Scapy, Snort, Wireshark, Linux',
        bullets: [
          'Developed real-time packet inspection engine detecting ARP spoofing and port scanning with instant email alerts.',
          'Benchmarked packet capture performance handling 10,000+ packets/sec with zero dropped frames.'
        ]
      },
      {
        name: 'Web Application Security Scanner Suite',
        tech: 'Python, Flask, Docker',
        bullets: [
          'Built automated scanner auditing SQL injection, XSS, and broken access controls with detailed mitigation guides.'
        ]
      }
    ],
    certifications: [
      'CompTIA Security+ Certified',
      'Certified Ethical Hacker (CEH v12)',
      'TryHackMe: Ranked in Top 1% globally'
    ],
    resumeFileName: '21CS055_Resume.pdf'
  },

  // 11. UI/UX Designer & Creative Frontend Developer (NEW)
  {
    rollNumber: '22IT076',
    name: 'Siddharth Joshi',
    title: 'UI/UX Designer & Creative Frontend Developer',
    department: 'Information Technology',
    email: 'siddharth.j@college.edu',
    phone: '+91 97777 22334',
    linkedin: 'linkedin.com/in/siddharth-joshi-uiux',
    summary: 'Product designer and frontend developer blending user empathy, wireframing, and design systems with modern React, Tailwind CSS, and HTML5/CSS3 frontend architecture.',
    skills: ['ui/ux', 'figma', 'reactjs', 'html5', 'css3', 'tailwind', 'wireframing', 'user research'],
    skillCategories: {
      'Design & Prototyping': 'Figma, Adobe XD, Wireframing, User Personas, Design Systems, Usability Testing',
      'Frontend Code': 'React.js, HTML5, CSS3, Tailwind CSS, JavaScript, Framer Motion',
      'Standards & Accessibility': 'WCAG 2.1 AA Compliance, Responsive Layouts, Typography, Color Systems',
      'Product Tools': 'Git, Notion, Miro, Storybook, Zeplin'
    },
    education: {
      degree: 'Bachelor of Technology in Information Technology',
      institution: 'Institute of Technology & Management',
      year: '2022 - 2026',
      cgpa: '8.90 / 10.0',
      coursework: 'User Experience Design, Human-Computer Interaction, Web Development'
    },
    experience: [
      {
        role: 'Product Design & Frontend Intern',
        company: 'InnovateHub Studio',
        duration: 'Jan 2024 - May 2024',
        bullets: [
          'Redesigned user onboarding flow, boosting registration conversion rates by 34% through A/B testing.',
          'Created unified 250+ component design system in Figma with direct Tailwind CSS token exports.'
        ]
      }
    ],
    projects: [
      {
        name: 'FinTech Wealth Management Dashboard',
        tech: 'Figma, React, Tailwind CSS, Recharts',
        bullets: [
          'Crafted end-to-end interactive investment portal with wireframes, user testing, and animated financial charts.',
          'Designed modular design tokens for instant multi-brand theming and high-contrast dark mode.'
        ]
      },
      {
        name: 'Accessible Component Library',
        tech: 'HTML5, CSS3, Tailwind, Storybook',
        bullets: [
          'Developed WCAG 2.1 AA certified component kit with high contrast mode, ARIA tags, and keyboard focus states.'
        ]
      }
    ],
    certifications: [
      'Google UX Design Professional Certificate',
      'Interaction Design Foundation (IxDF) Certified Designer'
    ],
    resumeFileName: '22IT076_Resume.pdf'
  },

  // 12. Big Data & Data Platform Engineer (NEW)
  {
    rollNumber: '21CS199',
    name: 'Neha Gupta',
    title: 'Big Data & Data Platform Engineer',
    department: 'Computer Science & Engineering',
    email: 'neha.gupta@college.edu',
    phone: '+91 96666 33445',
    linkedin: 'linkedin.com/in/neha-gupta-data',
    summary: 'Data engineer experienced in constructing large-scale streaming and batch ETL pipelines, distributed processing with Apache Spark, Kafka message ingestion, and cloud data warehouses.',
    skills: ['data engineering', 'apache spark', 'sql', 'python', 'kafka', 'aws', 'snowflake', 'airflow'],
    skillCategories: {
      'Data Processing': 'Apache Spark (PySpark), Apache Kafka, Apache Airflow, Apache Flink',
      'Databases & Warehouses': 'Snowflake, PostgreSQL, Amazon Redshift, MongoDB, Cassandra',
      'Languages': 'Python, SQL, Scala, Bash',
      'Cloud & Platforms': 'AWS (S3, EMR, Glue), Docker, Git, dbt (data build tool)'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science',
      institution: 'Birla Institute of Technology',
      year: '2021 - 2025',
      cgpa: '9.08 / 10.0',
      coursework: 'Big Data Systems, Database Architecture, Distributed Computing'
    },
    experience: [
      {
        role: 'Data Platform Engineering Intern',
        company: 'DataStream Analytics',
        duration: 'Jun 2024 - Aug 2024',
        bullets: [
          'Engineered PySpark batch jobs processing 20GB daily streaming logs into partitioned Parquet data lakes.',
          'Orchestrated 30+ automated daily DAG workflows in Apache Airflow with automated slack failure alerts.'
        ]
      }
    ],
    projects: [
      {
        name: 'Real-Time Financial Fraud Detection Pipeline',
        tech: 'Kafka, Apache Spark, Python, PostgreSQL',
        bullets: [
          'Stream processing pipeline calculating rolling aggregations to flag anomalous debit transactions under 200ms.',
          'Integrated dead-letter queues and idempotency guards ensuring exactly-once processing semantics.'
        ]
      },
      {
        name: 'Cloud Enterprise Data Warehouse with dbt & Snowflake',
        tech: 'Snowflake, AWS S3, dbt, SQL',
        bullets: [
          'Designed dimensional star-schema data warehouse powering self-serve business intelligence dashboards.'
        ]
      }
    ],
    certifications: [
      'Databricks Certified Data Engineer Associate',
      'AWS Certified Data Analytics - Specialty'
    ],
    resumeFileName: '21CS199_Resume.pdf'
  },

  // 13. Distributed Systems & Go Backend Engineer (NEW)
  {
    rollNumber: '22CS110',
    name: 'Aman Preet Singh',
    title: 'Distributed Systems & Go Backend Engineer',
    department: 'Computer Science & Engineering',
    email: 'aman.singh@college.edu',
    phone: '+91 95555 44556',
    linkedin: 'linkedin.com/in/aman-preet-systems',
    summary: 'High-concurrency systems engineer specializing in Golang, gRPC protocols, microservice mesh architecture, distributed consensus algorithms, and PostgreSQL database performance.',
    skills: ['golang', 'kubernetes', 'docker', 'grpc', 'microservices', 'postgresql', 'redis'],
    skillCategories: {
      'Languages': 'Go (Golang), C++, SQL, Bash, Python',
      'Distributed Systems': 'gRPC, Protocol Buffers, Raft Consensus, Redis Pub/Sub, Kafka',
      'Databases & Cache': 'PostgreSQL, Redis, ClickHouse, SQLite',
      'DevOps & Mesh': 'Kubernetes, Docker, Envoy, OpenTelemetry, Grafana, Linux'
    },
    education: {
      degree: 'Bachelor of Technology in Computer Science & Engineering',
      institution: 'Thapar Institute of Engineering & Technology',
      year: '2022 - 2026',
      cgpa: '9.20 / 10.0',
      coursework: 'Distributed Systems, Operating Systems, Concurrent Programming'
    },
    experience: [
      {
        role: 'Systems Engineering Intern',
        company: 'CloudPulse Networks',
        duration: 'May 2024 - Aug 2024',
        bullets: [
          'Engineered Go microservices processing 45,000 gRPC requests/sec with p99 latency under 4 milliseconds.',
          'Deployed distributed tracing using OpenTelemetry & Jaeger to monitor call graphs across 15 microservices.'
        ]
      }
    ],
    projects: [
      {
        name: 'Distributed Key-Value Store with Raft Consensus',
        tech: 'Go, gRPC, Protobuf, Docker',
        bullets: [
          'Developed fault-tolerant replicated key-value storage engine implementing Raft consensus and leader heartbeats.',
          'Supported snapshotting and log compaction to minimize disk usage and state recovery times.'
        ]
      },
      {
        name: 'High-Throughput Flash Sale Inventory Engine',
        tech: 'Golang, PostgreSQL, Redis, Kubernetes',
        bullets: [
          'Engineered atomic reservation engine preventing overselling with distributed Redis locks and optimistic concurrency.'
        ]
      }
    ],
    certifications: [
      'Certified Kubernetes Application Developer (CKAD)',
      'Google Cloud Certified Associate Cloud Engineer'
    ],
    resumeFileName: '22CS110_Resume.pdf'
  },

  // 14. Cross-Platform Mobile & Web Developer (NEW)
  {
    rollNumber: '21IT089',
    name: 'Meera Swaminathan',
    title: 'Cross-Platform Mobile & Web Developer',
    department: 'Information Technology',
    email: 'meera.s@college.edu',
    phone: '+91 94444 55667',
    linkedin: 'linkedin.com/in/meera-swami-dev',
    summary: 'Versatile mobile and web engineer specializing in React Native, TypeScript, GraphQL APIs, offline synchronization, and state management for consumer applications.',
    skills: ['react native', 'typescript', 'redux', 'graphql', 'firebase', 'javascript', 'nodejs'],
    skillCategories: {
      'Mobile & Web': 'React Native, React.js, TypeScript, JavaScript (ES6+), HTML5, Tailwind CSS',
      'State & APIs': 'Redux Toolkit, GraphQL, Apollo Client, REST APIs, WebSockets',
      'Backend & BaaS': 'Node.js, Express, Firebase (Auth, Firestore, Cloud Messaging), PostgreSQL',
      'Mobile Tooling': 'Expo, Metro Bundler, Android Studio, Xcode, Jest, Flipper'
    },
    education: {
      degree: 'Bachelor of Technology in Information Technology',
      institution: 'SSN College of Engineering',
      year: '2021 - 2025',
      cgpa: '8.88 / 10.0',
      coursework: 'Mobile Application Engineering, Software Architecture, Database Systems'
    },
    experience: [
      {
        role: 'Mobile App Development Intern',
        company: 'MobileCraft Technologies',
        duration: 'Feb 2024 - Jun 2024',
        bullets: [
          'Shipped key features for React Native audio social application with 50,000+ downloads on Google Play.',
          'Reduced app cold start time by 38% and memory consumption using lazy asset loading and Hermes engine.'
        ]
      }
    ],
    projects: [
      {
        name: 'PulseMed - Telemedicine & Virtual Consultation App',
        tech: 'React Native, TypeScript, GraphQL, WebRTC',
        bullets: [
          'Cross-platform app enabling HD video consultations, real-time prescription sync, and appointment booking.',
          'Integrated offline cache with Apollo Client and SQLite storage for seamless access in low-connectivity areas.'
        ]
      },
      {
        name: 'AudioWave - Live Social Audio Rooms',
        tech: 'React Native, Node.js, WebSockets, Firebase',
        bullets: [
          'Low-latency interactive voice room application supporting 100+ concurrent listeners per room.'
        ]
      }
    ],
    certifications: [
      'Meta React Native Developer Professional Certificate',
      'Apollo GraphQL Associate Certified'
    ],
    resumeFileName: '21IT089_Resume.pdf'
  }
];

async function seed() {
  try {
    console.log(`\n======================================================`);
    console.log(`Connecting to MongoDB Atlas (Database: "${DB_NAME}")...`);
    console.log(`======================================================`);
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log(`✓ Successfully connected to MongoDB Atlas database "${DB_NAME}"\n`);

    for (const data of sampleCandidates) {
      console.log(`Generating rich sample resume PDF for ${data.name} (${data.rollNumber})...`);
      const filePath = await createSamplePdf(data);
      const stat = fs.statSync(filePath);

      await Candidate.findOneAndUpdate(
        { rollNumber: data.rollNumber },
        {
          rollNumber: data.rollNumber,
          name: data.name,
          email: data.email,
          phone: data.phone,
          department: data.department,
          skills: data.skills,
          resumeOriginalName: `${data.rollNumber}_${data.name.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf`,
          resumeFileName: data.resumeFileName,
          resumePath: filePath,
          fileSize: stat.size
        },
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded ${data.name} [${data.rollNumber}] with ${data.skills.length} skills (PDF: ${stat.size} bytes)`);
    }

    console.log('\n======================================================');
    console.log(`✓ ALL 14 SAMPLE RESUME PDFs GENERATED IN: ${uploadDir}`);
    console.log(`✓ ALL 14 CANDIDATES STORED & INDEXED IN DATABASE: "${DB_NAME}"`);
    console.log('======================================================\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
