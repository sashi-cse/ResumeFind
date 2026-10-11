const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// Text wrapping utility
function wrapText(text, maxChars = 85) {
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

/**
 * Generates an executive, professional A4 PDF Resume for a candidate
 * @param {Object} candidate 
 * @returns {Promise<Buffer>}
 */
async function generateResumePdf(candidate) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size: 595 x 842 points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const { width, height } = page.getSize();
  const marginX = 40;

  // 1. Executive Slate Navy Top Header
  const headerHeight = 100;
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
  page.drawText(candidate.name || 'Candidate', {
    x: marginX,
    y: height - 34,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  // Department / Specialization
  const deptText = `${candidate.department || 'Computer Science & Engineering'} • Student Profile`;
  page.drawText(deptText, {
    x: marginX,
    y: height - 52,
    size: 11,
    font: fontBold,
    color: rgb(56 / 255, 189 / 255, 248 / 255) // Sky Blue
  });

  // Academic Meta Info
  const metaText = `Roll No: ${candidate.rollNumber || 'N/A'}   |   Institution: Gurukula Kangri Vishwavidyalaya (GKV)`;
  page.drawText(metaText, {
    x: marginX,
    y: height - 70,
    size: 8.5,
    font: font,
    color: rgb(203 / 255, 213 / 255, 225 / 255) // Slate 300
  });

  // Contact Info
  const gkv = candidate.gkvEmail ? `   |   GKV: ${candidate.gkvEmail}` : '';
  const phone = candidate.phone ? `   |   Ph: ${candidate.phone}` : '';
  const contactText = `Email: ${candidate.email || 'N/A'}${gkv}${phone}`;
  page.drawText(contactText, {
    x: marginX,
    y: height - 85,
    size: 8,
    font: font,
    color: rgb(148 / 255, 163 / 255, 184 / 255) // Slate 400
  });

  let currentY = height - headerHeight - 25;

  // Helper for Section Headers
  function drawSectionHeader(title) {
    currentY -= 10;
    page.drawText(title, {
      x: marginX,
      y: currentY,
      size: 10.5,
      font: fontBold,
      color: rgb(15 / 255, 23 / 255, 42 / 255)
    });

    page.drawLine({
      start: { x: marginX, y: currentY - 3 },
      end: { x: width - marginX, y: currentY - 3 },
      thickness: 1,
      color: rgb(226 / 255, 232 / 255, 240 / 255)
    });
    currentY -= 16;
  }

  // --- SECTION: CANDIDATE SUMMARY ---
  drawSectionHeader('CANDIDATE PROFILE SUMMARY');
  const skillsList = Array.isArray(candidate.skills) ? candidate.skills.join(', ') : 'Software Engineering';
  const summaryText = `Dedicated and forward-thinking ${candidate.department || 'Engineering'} student with foundational and practical expertise in ${skillsList}. Passionate about building robust software solutions, continuous technical learning, and delivering high-impact contributions in engineering teams.`;
  const summaryLines = wrapText(summaryText, 88);
  for (const line of summaryLines) {
    page.drawText(line, {
      x: marginX,
      y: currentY,
      size: 9,
      font: font,
      color: rgb(51 / 255, 65 / 255, 85 / 255)
    });
    currentY -= 13;
  }

  // --- SECTION: TECHNICAL SKILLSET ---
  drawSectionHeader('CORE TECHNICAL SKILLS & PROFICIENCIES');
  if (Array.isArray(candidate.skills) && candidate.skills.length > 0) {
    let skillX = marginX;
    let skillY = currentY;

    candidate.skills.forEach((skill, idx) => {
      const pillText = `• ${skill}`;
      const textWidth = fontBold.widthOfTextAtSize(pillText, 9);

      if (skillX + textWidth + 16 > width - marginX) {
        skillX = marginX;
        skillY -= 18;
      }

      page.drawRectangle({
        x: skillX,
        y: skillY - 4,
        width: textWidth + 14,
        height: 16,
        color: rgb(241 / 255, 245 / 255, 249 / 255), // Slate 100
        borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
        borderWidth: 0.8
      });

      page.drawText(pillText, {
        x: skillX + 7,
        y: skillY,
        size: 8.5,
        font: fontBold,
        color: rgb(15 / 255, 23 / 255, 42 / 255)
      });

      skillX += textWidth + 20;
    });

    currentY = skillY - 20;
  }

  // --- SECTION: EDUCATION ---
  drawSectionHeader('EDUCATION & ACADEMICS');
  page.drawText('Bachelor of Technology (B.Tech)', {
    x: marginX,
    y: currentY,
    size: 10,
    font: fontBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255)
  });
  page.drawText('2021 – 2025', {
    x: width - marginX - 60,
    y: currentY,
    size: 9,
    font: fontBold,
    color: rgb(100 / 255, 116 / 255, 139 / 255)
  });
  currentY -= 13;

  page.drawText(`Faculty of Engineering & Technology, Gurukula Kangri (Deemed to be University), Haridwar`, {
    x: marginX,
    y: currentY,
    size: 8.5,
    font: fontItalic,
    color: rgb(71 / 255, 85 / 255, 105 / 255)
  });
  currentY -= 13;

  page.drawText(`Department: ${candidate.department || 'Computer Science & Engineering'}   |   Student Roll ID: ${candidate.rollNumber || 'N/A'}`, {
    x: marginX,
    y: currentY,
    size: 8.5,
    font: font,
    color: rgb(100 / 255, 116 / 255, 139 / 255)
  });
  currentY -= 20;

  // --- SECTION: VERIFICATION & PORTAL NOTICE ---
  drawSectionHeader('PLACEMENT PORTAL VERIFICATION');
  const noticeLines = [
    'This document represents the candidate profile verified through the official GKV Placement Portal (ResumeFinder).',
    'All details, including student roll number, college institutional email, and skill proficiencies, are stored',
    'and authenticated within the campus placement management system.'
  ];
  for (const line of noticeLines) {
    page.drawText(line, {
      x: marginX,
      y: currentY,
      size: 8,
      font: fontItalic,
      color: rgb(100 / 255, 116 / 255, 139 / 255)
    });
    currentY -= 12;
  }

  // Footer bar
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 25,
    color: rgb(248 / 255, 250 / 255, 252 / 255)
  });
  page.drawText(`GKV Placement Portal • Roll: ${candidate.rollNumber} • Generated on ${new Date().toLocaleDateString('en-IN')}`, {
    x: marginX,
    y: 9,
    size: 8,
    font: font,
    color: rgb(148 / 255, 163 / 255, 184 / 255)
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generateResumePdf
};
