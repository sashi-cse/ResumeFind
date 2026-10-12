// ResumeFinder Client Application

const GOOGLE_CLIENT_ID = '744894548754-rthokkpmrhrb4dnne6p3ps07700la64t.apps.googleusercontent.com';
let currentStudentUser = null;
let currentExistingProfile = null;
let currentCandidates = [];
let currentSkillsInput = [];
let selectedFile = null;
let currentSearchedTerms = [];

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

  const stripped = lower.replace(/[\.\-_\s]/g, '');
  if (SKILL_ALIASES[stripped]) return SKILL_ALIASES[stripped];

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

  if (a === b) return true;

  const normA = normalizeSkill(a);
  const normB = normalizeSkill(b);
  if (normA && normB && normA === normB) return true;

  const stripA = a.replace(/[\.\-_\s]/g, '');
  const stripB = b.replace(/[\.\-_\s]/g, '');
  if (stripA === stripB) return true;

  if (stripA.length >= 4 && stripB.length >= 4) {
    if (stripA.includes(stripB) || stripB.includes(stripA)) return true;
  }

  return false;
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (window.lucide) window.lucide.createIcons();
  setupTagInput();
  setupEditTagInput();
  setupDragAndDrop();
  setupSearchInput();
  setupRollNumberDetection();
  loadAllCandidates();
  loadQuickSkills();
  initGoogleAuth();
});

// -------------------------------------------------------------
// THEME SWITCHER (iOS Light / Dark Mode)
// -------------------------------------------------------------
function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
  showToast(isDark ? 'Switched to Dark Mode' : 'Switched to Light Mode', 'info');
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  }
  if (text) {
    text.textContent = isDark ? 'Light' : 'Dark';
  }
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// GOOGLE AUTHENTICATION & STUDENT SESSION
// -------------------------------------------------------------
function initGoogleAuth() {
  const stored = localStorage.getItem('resume_student_user');
  if (stored) {
    try {
      currentStudentUser = JSON.parse(stored);
      applyStudentSessionUI(currentStudentUser);
      // Auto-check database profile on session restore
      checkMyProfileInDatabase(false);
    } catch (_) {
      localStorage.removeItem('resume_student_user');
    }
  }

  const trySetup = () => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      setupGoogleButton();
      return true;
    }
    return false;
  };

  if (!trySetup()) {
    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      if (trySetup() || retries > 25) {
        clearInterval(interval);
      }
    }, 200);
  }
}

function setupGoogleButton() {
  try {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignInCallback,
      auto_select: false
    });

    const btnWrapper = document.getElementById('googleBtnWrapper');
    if (btnWrapper) {
      btnWrapper.innerHTML = '';
      google.accounts.id.renderButton(btnWrapper, {
        theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 250
      });
    }
  } catch (err) {
    console.warn('Error rendering Google button:', err);
  }
}

async function handleGoogleSignInCallback(response) {
  if (!response || !response.credential) {
    showToast('Failed to receive Google credential token.', 'error');
    return;
  }

  try {
    showToast('Verifying Google credentials...', 'info');
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Google verification failed.', 'error');
      return;
    }

    currentStudentUser = {
      ...data.user,
      token: response.credential
    };
    localStorage.setItem('resume_student_user', JSON.stringify(currentStudentUser));

    applyStudentSessionUI(currentStudentUser);
    showToast(`Welcome, ${currentStudentUser.name}!`, 'success');

    // Run database check to auto-detect existing profile
    await checkMyProfileInDatabase(false);
  } catch (err) {
    console.error('Google auth error:', err);
    showToast('Error during Google sign-in. Please try again.', 'error');
  }
}

function applyStudentSessionUI(user) {
  if (!user) return;
  const authGate = document.getElementById('studentAuthGate');
  const formWrapper = document.getElementById('studentFormWrapper');
  const avatar = document.getElementById('authStudentAvatar');
  const nameEl = document.getElementById('authStudentName');
  const emailEl = document.getElementById('authStudentEmail');

  if (authGate) authGate.classList.add('hidden');
  if (formWrapper) formWrapper.classList.remove('hidden');

  if (avatar && user.picture) avatar.src = user.picture;
  if (nameEl) nameEl.textContent = user.name || 'Verified Student';
  if (emailEl) emailEl.textContent = user.email || '';

  const nameInput = document.getElementById('formName');
  const emailInput = document.getElementById('formEmail');
  if (nameInput && !nameInput.value) nameInput.value = user.name || '';
  if (emailInput && !emailInput.value) emailInput.value = user.email || '';

  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// DATABASE PROFILE CHECK & AUTO-DETECTION
// -------------------------------------------------------------
async function checkMyProfileInDatabase(isManual = false) {
  if (!currentStudentUser) {
    if (isManual) showToast('Please sign in with Google first.', 'error');
    return;
  }

  const checkBtn = document.getElementById('btnCheckDbProfile');
  const dbBadge = document.getElementById('dbStatusBadge');
  const dbTypeTag = document.getElementById('profileTypeTag');
  const dbDesc = document.getElementById('dbStatusDescription');
  const iconWrapper = document.getElementById('dbStatusIconWrapper');
  const statusBanner = document.getElementById('profileStatusBanner');
  const bannerIcon = document.getElementById('profileStatusBannerIcon');
  const bannerText = document.getElementById('profileStatusBannerText');

  try {
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Checking DB...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    const queryParams = new URLSearchParams();
    if (currentStudentUser.googleId) queryParams.append('googleId', currentStudentUser.googleId);
    if (currentStudentUser.email) queryParams.append('email', currentStudentUser.email);
    queryParams.append('_t', Date.now());

    const res = await fetch(`/api/candidates/my-profile?${queryParams.toString()}`);
    const data = await res.json();

    if (data.success && data.exists && data.candidate) {
      currentExistingProfile = data.candidate;

      // Status header update
      if (dbBadge) dbBadge.textContent = 'Profile Found in Database';
      if (dbTypeTag) {
        dbTypeTag.textContent = 'Existing Student';
        dbTypeTag.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
        dbTypeTag.classList.remove('hidden');
      }
      if (dbDesc) dbDesc.textContent = `Verified for ${data.candidate.name} (${data.candidate.rollNumber}). Registered in database.`;
      if (iconWrapper) {
        iconWrapper.className = 'w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0';
      }

      // Banner update
      if (statusBanner && bannerIcon && bannerText) {
        statusBanner.className = 'p-3.5 sm:p-4 rounded-2xl text-xs flex items-start justify-between gap-3 transition-all bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200';
        bannerIcon.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>`;
        bannerText.innerHTML = `
          <div class="font-bold text-sm text-emerald-800 dark:text-emerald-200">
            ✓ Existing Profile Found for ${data.candidate.rollNumber} (${data.candidate.name})
          </div>
          <p class="text-emerald-700/90 dark:text-emerald-300/90 mt-0.5">
            Your registered details and skillset have been auto-loaded. You can modify your skills or contact info below. Your active resume PDF is preserved unless you upload a new one.
          </p>
        `;
        statusBanner.classList.remove('hidden');
      }

      // Populate form
      populateStudentForm(data.candidate);

      if (isManual) {
        showToast(`✓ Profile found for ${data.candidate.name} (${data.candidate.rollNumber})!`, 'success');
      }
    } else {
      currentExistingProfile = null;

      // Status header update
      if (dbBadge) dbBadge.textContent = 'No Profile in Database';
      if (dbTypeTag) {
        dbTypeTag.textContent = 'New Registration';
        dbTypeTag.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30';
        dbTypeTag.classList.remove('hidden');
      }
      if (dbDesc) dbDesc.textContent = 'No existing candidate record found for your Google account.';
      if (iconWrapper) {
        iconWrapper.className = 'w-9 h-9 rounded-xl bg-apple-blue/10 dark:bg-apple-blue/20 text-apple-blue flex items-center justify-center shrink-0';
      }

      // Banner update
      if (statusBanner && bannerIcon && bannerText) {
        statusBanner.className = 'p-3.5 sm:p-4 rounded-2xl text-xs flex items-start justify-between gap-3 transition-all bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 text-blue-800 dark:text-blue-200';
        bannerIcon.innerHTML = `<i data-lucide="info" class="w-4 h-4 text-apple-blue"></i>`;
        bannerText.innerHTML = `
          <div class="font-bold text-sm text-blue-800 dark:text-blue-200">
            👋 Welcome, ${currentStudentUser.name || 'Student'}!
          </div>
          <p class="text-blue-700/90 dark:text-blue-300/90 mt-0.5">
            No existing resume profile was found in the database. Please enter your Roll Number, GKV Mail, Skills, and attach your resume PDF to register.
          </p>
        `;
        statusBanner.classList.remove('hidden');
      }

      resetFormToNewStudentState();

      if (isManual) {
        showToast('No existing profile found. You can fill out the form to register!', 'info');
      }
    }
  } catch (err) {
    console.error('Check DB profile error:', err);
    if (isManual) showToast('Failed to check database profile status.', 'error');
  } finally {
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Check Database</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

function populateStudentForm(candidate) {
  if (!candidate) return;

  const rollInput = document.getElementById('formRollNumber');
  const nameInput = document.getElementById('formName');
  const emailInput = document.getElementById('formEmail');
  const gkvInput = document.getElementById('formGkvEmail');
  const deptInput = document.getElementById('formDepartment');
  const phoneInput = document.getElementById('formPhone');
  const lockBadge = document.getElementById('rollNumberLockBadge');
  const submitBtn = document.getElementById('submitCandidateBtn');
  const resumeRequiredStar = document.getElementById('resumeRequiredStar');
  const resumeOptionalNotice = document.getElementById('resumeOptionalNotice');
  const existingResumeNotice = document.getElementById('existingResumeNotice');
  const existingResumeFileName = document.getElementById('existingResumeFileName');

  if (rollInput && candidate.rollNumber) {
    rollInput.value = candidate.rollNumber;
    rollInput.readOnly = true;
    rollInput.classList.add('bg-gray-100/80', 'dark:bg-white/5', 'cursor-not-allowed');
  }
  if (lockBadge) lockBadge.classList.remove('hidden');

  if (nameInput && candidate.name) nameInput.value = candidate.name;
  if (emailInput && candidate.email) emailInput.value = candidate.email;
  if (gkvInput && candidate.gkvEmail) gkvInput.value = candidate.gkvEmail;
  if (deptInput && candidate.department) deptInput.value = candidate.department;
  if (phoneInput && candidate.phone) phoneInput.value = candidate.phone;

  if (Array.isArray(candidate.skills)) {
    currentSkillsInput = [...candidate.skills];
    renderSkillsTags();
  }

  // Active resume notice
  if (existingResumeNotice) {
    existingResumeNotice.classList.remove('hidden');
    if (existingResumeFileName) {
      existingResumeFileName.textContent = candidate.resumeFileName || `${candidate.rollNumber}_Resume.pdf`;
    }
  }
  if (resumeRequiredStar) resumeRequiredStar.classList.add('hidden');
  if (resumeOptionalNotice) resumeOptionalNotice.classList.remove('hidden');

  if (submitBtn) {
    submitBtn.innerHTML = `
      <i data-lucide="save" class="w-4 h-4"></i>
      <span>Update Profile & Save Changes</span>
    `;
    submitBtn.className = 'w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2';
  }

  if (window.lucide) window.lucide.createIcons();
}

function resetFormToNewStudentState() {
  const rollInput = document.getElementById('formRollNumber');
  const nameInput = document.getElementById('formName');
  const emailInput = document.getElementById('formEmail');
  const lockBadge = document.getElementById('rollNumberLockBadge');
  const submitBtn = document.getElementById('submitCandidateBtn');
  const resumeRequiredStar = document.getElementById('resumeRequiredStar');
  const resumeOptionalNotice = document.getElementById('resumeOptionalNotice');
  const existingResumeNotice = document.getElementById('existingResumeNotice');

  if (rollInput) {
    rollInput.readOnly = false;
    rollInput.classList.remove('bg-gray-100/80', 'dark:bg-white/5', 'cursor-not-allowed');
  }
  if (lockBadge) lockBadge.classList.add('hidden');

  if (currentStudentUser) {
    if (nameInput) nameInput.value = currentStudentUser.name || '';
    if (emailInput) emailInput.value = currentStudentUser.email || '';
  }

  if (existingResumeNotice) existingResumeNotice.classList.add('hidden');
  if (resumeRequiredStar) resumeRequiredStar.classList.remove('hidden');
  if (resumeOptionalNotice) resumeOptionalNotice.classList.add('hidden');

  if (submitBtn) {
    submitBtn.innerHTML = `
      <i data-lucide="check" class="w-4 h-4"></i>
      <span>Save & Upload Resume</span>
    `;
    submitBtn.className = 'w-full py-3.5 px-6 rounded-2xl bg-apple-blue hover:bg-apple-hover active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-lg shadow-apple-blue/25 flex items-center justify-center gap-2';
  }

  if (window.lucide) window.lucide.createIcons();
}

function previewCurrentStudentResume() {
  if (currentExistingProfile && currentExistingProfile.rollNumber) {
    previewResume(
      currentExistingProfile.rollNumber,
      encodeURIComponent(currentExistingProfile.name || 'Student Resume'),
      encodeURIComponent(currentExistingProfile.department || 'Engineering')
    );
  } else {
    showToast('No active resume found to preview.', 'info');
  }
}

function signOutStudent() {
  currentStudentUser = null;
  currentExistingProfile = null;
  localStorage.removeItem('resume_student_user');

  const authGate = document.getElementById('studentAuthGate');
  const formWrapper = document.getElementById('studentFormWrapper');
  const statusBanner = document.getElementById('profileStatusBanner');
  if (authGate) authGate.classList.remove('hidden');
  if (formWrapper) formWrapper.classList.add('hidden');
  if (statusBanner) statusBanner.classList.add('hidden');

  clearRegistrationForm();
  resetFormToNewStudentState();
  setupGoogleButton();
  showToast('Signed out of Google student session.', 'info');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// NAVIGATION TABS (iOS Segmented Control)
// -------------------------------------------------------------
function switchTab(tab) {
  const searchSection = document.getElementById('searchSection');
  const registerSection = document.getElementById('registerSection');
  const searchBtn = document.getElementById('tabSearchBtn');
  const registerBtn = document.getElementById('tabRegisterBtn');

  if (tab === 'search') {
    searchSection.classList.remove('hidden');
    registerSection.classList.add('hidden');
    searchBtn.classList.add('active');
    searchBtn.classList.remove('text-gray-600', 'dark:text-neutral-400');
    registerBtn.classList.remove('active');
    registerBtn.classList.add('text-gray-600', 'dark:text-neutral-400');
  } else {
    searchSection.classList.add('hidden');
    registerSection.classList.remove('hidden');
    registerBtn.classList.add('active');
    registerBtn.classList.remove('text-gray-600', 'dark:text-neutral-400');
    searchBtn.classList.remove('active');
    searchBtn.classList.add('text-gray-600', 'dark:text-neutral-400');
    if (!currentStudentUser) {
      setupGoogleButton();
    }
  }
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// SEARCH & RETRIEVAL LOGIC
// -------------------------------------------------------------
function setupSearchInput() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');

  input.addEventListener('input', () => {
    if (input.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  currentSearchedTerms = [];
  loadAllCandidates();
}

async function performSearch() {
  const query = document.getElementById('searchInput').value.trim();
  const badge = document.getElementById('searchModeBadge');
  const statusText = document.getElementById('searchStatusText');

  if (!query) {
    loadAllCandidates();
    return;
  }

  // Detect query type
  const isRollPattern = /^[A-Za-z0-9_-]{3,15}$/.test(query) && !query.includes(',');
  badge.textContent = isRollPattern ? 'Roll Number Mode' : 'Skillset Mode';

  try {
    statusText.textContent = `Searching for "${query}"...`;
    const res = await fetch(`/api/candidates/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();

    if (data.success) {
      currentCandidates = data.data;
      currentSearchedTerms = data.searchedSkills || [];
      renderCandidates(currentCandidates, data.searchType, query);
    } else {
      showToast(data.message || 'Error searching candidates', 'error');
    }
  } catch (err) {
    console.error('Search error:', err);
    showToast('Failed to perform search. Check network connection.', 'error');
  }
}

function applySkillChip(skill) {
  const input = document.getElementById('searchInput');
  const current = input.value.trim();
  if (current) {
    const list = current.split(',').map(s => s.trim().toLowerCase());
    if (!list.includes(skill.toLowerCase())) {
      input.value = `${current}, ${skill}`;
    }
  } else {
    input.value = skill;
  }
  document.getElementById('clearSearchBtn').classList.remove('hidden');
  performSearch();
}

async function loadAllCandidates() {
  const badge = document.getElementById('searchModeBadge');
  const statusText = document.getElementById('searchStatusText');
  badge.textContent = 'Smart Auto-Detect';
  statusText.textContent = 'Showing all registered candidates';

  try {
    const res = await fetch(`/api/candidates?_t=${Date.now()}`);
    const data = await res.json();
    if (data.success) {
      currentCandidates = data.data;
      renderCandidates(currentCandidates, 'all', '');
    }
  } catch (err) {
    console.error('Error loading candidates:', err);
  }
}

async function loadQuickSkills() {
  try {
    const res = await fetch('/api/skills/tags');
    const data = await res.json();
    if (data.success && data.data && data.data.length > 0) {
      const container = document.getElementById('quickSkillsContainer');
      const topSkills = data.data.slice(0, 7);
      container.innerHTML = `
        <span class="text-xs font-medium text-gray-400 dark:text-neutral-400 mr-1 flex items-center gap-1">
          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-apple-blue"></i> Quick Skills:
        </span>
        ${topSkills
          .map(
            item =>
              `<button onclick="applySkillChip('${item.skill}')" class="skill-chip">#${item.skill}</button>`
          )
          .join('')}
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.warn('Could not load skills list:', err);
  }
}

// -------------------------------------------------------------
// RENDER CANDIDATES
// -------------------------------------------------------------
function renderCandidates(candidates, searchType, queryText) {
  const grid = document.getElementById('candidatesGrid');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('resultCountBadge');

  countBadge.textContent = `${candidates.length} ${candidates.length === 1 ? 'Candidate' : 'Candidates'}`;

  if (!candidates || candidates.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = candidates
    .map(c => {
      const initials = c.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      // Check match score badge
      let matchBadgeHtml = '';
      if (searchType === 'skillset' && c.matchScore !== undefined) {
        if (c.matchScore === 100) {
          matchBadgeHtml = `
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              100% Match (${c.matchCount}/${c.totalSearchedSkills})
            </span>
          `;
        } else {
          matchBadgeHtml = `
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              ${c.matchScore}% Match (${c.matchCount}/${c.totalSearchedSkills})
            </span>
          `;
        }
      } else if (searchType === 'rollNumber') {
        matchBadgeHtml = `
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <i data-lucide="check-check" class="w-3 h-3"></i> Roll Verified
          </span>
        `;
      }

      // Render skill pills (highlight matched skills)
      const matchedSet = new Set((c.matchedSkills || []).map(s => s.toLowerCase()));
      const skillsHtml = (c.skills || [])
        .map(skill => {
          const isMatched =
            matchedSet.has(skill.toLowerCase()) ||
            (c.matchedSkills || []).some(ms => isSkillMatch(ms, skill)) ||
            currentSearchedTerms.some(t => isSkillMatch(skill, t));

          if (isMatched && searchType === 'skillset') {
            return `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/40 shadow-sm">${skill}</span>`;
          }
          return `<span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-300 border border-gray-200 dark:border-white/10">${skill}</span>`;
        })
        .join('');

      return `
        <div class="candidate-card ios-card rounded-3xl p-5 border shadow-ios-card flex flex-col justify-between">
          <!-- Card Header -->
          <div>
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-neutral-700 dark:to-neutral-900 text-white font-bold text-base flex items-center justify-center shadow-md">
                  ${initials}
                </div>
                <div>
                  <h3 class="text-base font-bold text-apple-dark dark:text-white leading-tight">${c.name}</h3>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-apple-blue/10 dark:bg-apple-blue/20 text-apple-blue dark:text-blue-400">
                      ${c.rollNumber}
                    </span>
                    <span class="text-[11px] text-gray-400 dark:text-neutral-400 truncate max-w-[110px]">${c.department || 'Engineering'}</span>
                  </div>
                </div>
              </div>

              ${matchBadgeHtml}
            </div>

            <!-- Email & Details -->
            <div class="space-y-1 mb-3">
              ${c.email ? `<p class="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1.5"><i data-lucide="mail" class="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 shrink-0"></i> <span class="truncate">${c.email}</span></p>` : ''}
              ${c.gkvEmail && c.gkvEmail !== c.email ? `<p class="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1.5"><i data-lucide="building-2" class="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 shrink-0"></i> <span class="font-mono text-[11px] truncate">${c.gkvEmail}</span></p>` : ''}
            </div>

            <!-- Skill Tags -->
            <div class="space-y-1.5 mb-5">
              <p class="text-[11px] font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Skillset</p>
              <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                ${skillsHtml}
              </div>
            </div>
          </div>

          <!-- Card Actions (Preview & Download) -->
          <div class="pt-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-2">
            <!-- Preview Button -->
            <button
              onclick="previewResume('${c.rollNumber}', '${encodeURIComponent(c.name)}', '${encodeURIComponent(c.department || '')}')"
              class="flex-1 py-2 px-3 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 text-apple-dark dark:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <i data-lucide="eye" class="w-3.5 h-3.5 text-gray-600 dark:text-neutral-300"></i>
              <span>Preview</span>
            </button>

            <!-- Download Button -->
            <a
              href="/api/candidates/${c.rollNumber}/download"
              download
              class="flex-1 py-2 px-3 rounded-xl bg-apple-blue hover:bg-apple-hover active:scale-95 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm shadow-apple-blue/20"
            >
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Download</span>
            </a>
          </div>
        </div>
      `;
    })
    .join('');

  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// PREVIEW MODAL
// -------------------------------------------------------------
function previewResume(rollNumber, encodedName, encodedDept) {
  const modal = document.getElementById('previewModal');
  const iframe = document.getElementById('pdfIframe');
  const loading = document.getElementById('pdfLoading');
  const nameEl = document.getElementById('modalCandidateName');
  const rollEl = document.getElementById('modalRollNumber');
  const deptEl = document.getElementById('modalDepartment');
  const downloadBtn = document.getElementById('modalDownloadBtn');

  nameEl.textContent = decodeURIComponent(encodedName);
  rollEl.textContent = rollNumber;
  deptEl.textContent = decodeURIComponent(encodedDept) || 'Engineering';

  const previewUrl = `/api/candidates/${rollNumber}/preview?_t=${Date.now()}`;
  const downloadUrl = `/api/candidates/${rollNumber}/download?_t=${Date.now()}`;

  downloadBtn.onclick = () => {
    window.location.href = downloadUrl;
  };

  const openTabBtn = document.getElementById('modalOpenTabBtn');
  if (openTabBtn) {
    openTabBtn.href = previewUrl;
  }

  loading.classList.remove('hidden');
  iframe.src = previewUrl;
  iframe.onload = () => {
    loading.classList.add('hidden');
  };

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (window.lucide) window.lucide.createIcons();
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  const iframe = document.getElementById('pdfIframe');
  iframe.src = 'about:blank';
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// -------------------------------------------------------------
// CANDIDATE REGISTRATION & SKILLS INPUT
// -------------------------------------------------------------
function setupTagInput() {
  const input = document.getElementById('skillTagInput');

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkillTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && currentSkillsInput.length > 0) {
      removeSkillTag(currentSkillsInput.length - 1);
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addSkillTag(input.value);
      input.value = '';
    }
  });
}

function addSkillTag(val) {
  const clean = val.replace(/,/g, '').trim().toLowerCase();
  if (clean && !currentSkillsInput.includes(clean)) {
    currentSkillsInput.push(clean);
    renderSkillsTags();
  }
}

function removeSkillTag(index) {
  currentSkillsInput.splice(index, 1);
  renderSkillsTags();
}

function renderSkillsTags() {
  const container = document.getElementById('skillsTagContainer');
  container.innerHTML = currentSkillsInput
    .map(
      (skill, idx) => `
      <span class="tag-badge">
        <span>${skill}</span>
        <button type="button" onclick="removeSkillTag(${idx})" class="hover:text-rose-200">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </span>
    `
    )
    .join('');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// FILE DROPZONE
// -------------------------------------------------------------
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, e => {
      e.preventDefault();
      dropzone.classList.add('border-apple-blue', 'bg-apple-blue/5');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, e => {
      e.preventDefault();
      dropzone.classList.remove('border-apple-blue', 'bg-apple-blue/5');
    });
  });

  dropzone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setFile(files[0]);
    }
  });
}

function handleFileSelected(e) {
  if (e.target.files.length > 0) {
    setFile(e.target.files[0]);
  }
}

function setFile(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF resume document.', 'error');
    return;
  }
  selectedFile = file;
  document.getElementById('dropzoneEmpty').classList.add('hidden');
  document.getElementById('dropzoneSelected').classList.remove('hidden');
  document.getElementById('selectedFileName').textContent = file.name;
  document.getElementById('selectedFileSize').textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  if (window.lucide) window.lucide.createIcons();
}

function clearSelectedFile(e) {
  if (e) e.stopPropagation();
  selectedFile = null;
  document.getElementById('formResumeFile').value = '';
  document.getElementById('dropzoneEmpty').classList.remove('hidden');
  document.getElementById('dropzoneSelected').classList.add('hidden');
}

// -------------------------------------------------------------
// SUBMIT CANDIDATE
// -------------------------------------------------------------
async function handleCandidateSubmit(e) {
  e.preventDefault();

  if (!currentStudentUser) {
    showToast('Please sign in with Google to submit or update your profile.', 'error');
    const authGate = document.getElementById('studentAuthGate');
    if (authGate) authGate.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const rollNumber = document.getElementById('formRollNumber').value.trim();
  const name = document.getElementById('formName').value.trim();
  const email = document.getElementById('formEmail').value.trim();
  const gkvEmail = document.getElementById('formGkvEmail').value.trim();
  const department = document.getElementById('formDepartment').value.trim();
  const phone = document.getElementById('formPhone').value.trim();
  const submitBtn = document.getElementById('submitCandidateBtn');

  if (!rollNumber) {
    showToast('Please enter candidate Roll Number', 'error');
    return;
  }

  if (!name) {
    showToast('Please enter candidate Full Name', 'error');
    return;
  }

  if (!gkvEmail) {
    showToast('Please enter your official GKV Mail (e.g. 21cs101@gkv.ac.in)', 'error');
    document.getElementById('formGkvEmail').focus();
    return;
  }

  if (currentSkillsInput.length === 0) {
    showToast('Please add at least one skill tag', 'error');
    return;
  }

  const candidateExists = currentExistingProfile !== null || currentCandidates.some(c => c.rollNumber === rollNumber);
  if (!selectedFile && !candidateExists) {
    showToast('Please attach candidate PDF resume', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('rollNumber', rollNumber);
  formData.append('name', name);
  formData.append('email', email || currentStudentUser.email || '');
  formData.append('gkvEmail', gkvEmail);
  formData.append('department', department || 'General');
  formData.append('phone', phone);
  formData.append('googleId', currentStudentUser.googleId || '');
  formData.append('googlePicture', currentStudentUser.picture || '');
  formData.append('googleToken', currentStudentUser.token || '');
  formData.append('skills', JSON.stringify(currentSkillsInput));
  if (selectedFile) {
    formData.append('resume', selectedFile);
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Saving profile...</span>`;

    const res = await fetch('/api/candidates', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message || `Student ${name} (${rollNumber}) saved successfully!`, 'success');
      clearSelectedFile();
      await loadQuickSkills();
      await checkMyProfileInDatabase(false);
      // Reset search input so updated profile immediately shows at top of candidate list
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      const clearSearchBtn = document.getElementById('clearSearchBtn');
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      currentSearchedTerms = [];
      switchTab('search');
      await loadAllCandidates();
    } else {
      showToast(data.message || 'Failed to save candidate', 'error');
    }
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Server error while saving candidate.', 'error');
  } finally {
    submitBtn.disabled = false;
    if (currentExistingProfile) {
      submitBtn.innerHTML = `
        <i data-lucide="save" class="w-4 h-4"></i>
        <span>Update Profile & Save Changes</span>
      `;
    } else {
      submitBtn.innerHTML = `
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>Save & Upload Resume</span>
      `;
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

// -------------------------------------------------------------
// SMART ROLL NUMBER DETECTION & ANTI-SPOOFING
// -------------------------------------------------------------
function setupRollNumberDetection() {
  const rollInput = document.getElementById('formRollNumber');
  if (!rollInput) return;

  let debounceTimer = null;
  rollInput.addEventListener('input', () => {
    // If the input is readOnly (locked for existing verified student), do nothing
    if (rollInput.readOnly) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const roll = rollInput.value.trim().toUpperCase();
      if (!roll) {
        clearRegistrationAutoFill();
        return;
      }

      let candidate = currentCandidates.find(c => c.rollNumber === roll);
      if (!candidate && roll.length >= 2) {
        try {
          const res = await fetch(`/api/candidates/${roll}`);
          const data = await res.json();
          if (data.success) candidate = data.data;
        } catch (_) {}
      }

      const submitBtn = document.getElementById('submitCandidateBtn');
      const statusBanner = document.getElementById('profileStatusBanner');
      const bannerIcon = document.getElementById('profileStatusBannerIcon');
      const bannerText = document.getElementById('profileStatusBannerText');

      if (candidate) {
        // Ownership check: does this existing candidate belong to the currently logged in student?
        const isOwner = currentStudentUser && (
          (candidate.googleId && candidate.googleId === currentStudentUser.googleId) ||
          (!candidate.googleId && candidate.email && candidate.email.toLowerCase() === (currentStudentUser.email || '').toLowerCase()) ||
          (!candidate.googleId && candidate.gkvEmail && candidate.gkvEmail.toLowerCase() === (document.getElementById('formGkvEmail').value || '').trim().toLowerCase())
        );

        if (!isOwner) {
          // Warning: Someone else's roll number!
          if (statusBanner && bannerIcon && bannerText) {
            statusBanner.className = 'p-3.5 sm:p-4 rounded-2xl text-xs flex items-start justify-between gap-3 transition-all bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-200';
            bannerIcon.innerHTML = `<i data-lucide="shield-alert" class="w-4 h-4 text-rose-600 dark:text-rose-400"></i>`;
            bannerText.innerHTML = `
              <div>
                <span class="font-bold text-sm text-rose-800 dark:text-rose-200">Roll Number Already Registered (${roll})</span>
                <p class="text-rose-700/90 dark:text-rose-300/90 mt-0.5">
                  This Roll Number belongs to another student. You cannot view, edit, or overwrite other students' profiles.
                </p>
              </div>
            `;
            statusBanner.classList.remove('hidden');
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
          }
          if (window.lucide) window.lucide.createIcons();
          return;
        } else {
          // This is the student's own profile!
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          }
          currentExistingProfile = candidate;
          populateStudentForm(candidate);
        }
      } else {
        // Roll number is free and available
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        clearRegistrationAutoFill();
      }
    }, 250);
  });
}

function clearRegistrationAutoFill() {
  const submitBtn = document.getElementById('submitCandidateBtn');
  if (submitBtn && !currentExistingProfile) {
    submitBtn.innerHTML = `
      <i data-lucide="check" class="w-4 h-4"></i>
      <span>Save & Upload Resume</span>
    `;
    submitBtn.className = 'w-full py-3.5 px-6 rounded-2xl bg-apple-blue hover:bg-apple-hover active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-lg shadow-apple-blue/25 flex items-center justify-center gap-2';
    if (window.lucide) window.lucide.createIcons();
  }
}

function clearRegistrationForm() {
  document.getElementById('candidateForm').reset();
  currentSkillsInput = [];
  renderSkillsTags();
  clearSelectedFile();
  if (currentExistingProfile) {
    populateStudentForm(currentExistingProfile);
  } else {
    clearRegistrationAutoFill();
    resetFormToNewStudentState();
  }
}

// -------------------------------------------------------------
// DELETE CANDIDATE
// -------------------------------------------------------------
async function deleteCandidate(rollNumber, encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!confirm(`Are you sure you want to remove ${name} (${rollNumber}) and delete their resume?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/candidates/${rollNumber}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Candidate ${rollNumber} removed.`, 'success');
      performSearch();
      loadQuickSkills();
    } else {
      showToast(data.message || 'Failed to delete candidate.', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting.', 'error');
  }
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS (iOS Dynamic Island Style)
// -------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';

  toast.className = `
    pointer-events-auto px-4 py-3 rounded-2xl shadow-ios-modal flex items-center gap-2.5 text-xs font-semibold
    backdrop-blur-2xl transition-all duration-300 transform -translate-y-2 opacity-0
    ${
      isSuccess
        ? 'bg-emerald-900/90 text-white border border-emerald-500/30'
        : isError
        ? 'bg-rose-900/90 text-white border border-rose-500/30'
        : 'bg-neutral-900/90 text-white border border-white/20'
    }
  `;

  const iconName = isSuccess ? 'check-circle' : isError ? 'alert-triangle' : 'info';
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 ${isSuccess ? 'text-emerald-400' : isError ? 'text-rose-400' : 'text-blue-400'}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  // Animate in
  setTimeout(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.classList.add('-translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// -------------------------------------------------------------
// EDIT CANDIDATE & REPLACE RESUME MODAL LOGIC
// -------------------------------------------------------------
let editSkillsList = [];
let editSelectedFile = null;

function setupEditTagInput() {
  const input = document.getElementById('editSkillTagInput');
  if (!input) return;

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEditSkillTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && editSkillsList.length > 0) {
      removeEditSkillTag(editSkillsList.length - 1);
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addEditSkillTag(input.value);
      input.value = '';
    }
  });
}

function addEditSkillTag(val) {
  const clean = val.replace(/,/g, '').trim().toLowerCase();
  if (clean && !editSkillsList.includes(clean)) {
    editSkillsList.push(clean);
    renderEditSkillsTags();
  }
}

function removeEditSkillTag(idx) {
  editSkillsList.splice(idx, 1);
  renderEditSkillsTags();
}

function renderEditSkillsTags() {
  const container = document.getElementById('editSkillsTagContainer');
  if (!container) return;
  container.innerHTML = editSkillsList
    .map(
      (skill, idx) => `
      <span class="tag-badge">
        <span>${skill}</span>
        <button type="button" onclick="removeEditSkillTag(${idx})" class="hover:text-rose-200">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </span>
    `
    )
    .join('');
  if (window.lucide) window.lucide.createIcons();
}

function handleEditFileSelected(e) {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please select a valid PDF file.', 'error');
      return;
    }
    editSelectedFile = file;
    document.getElementById('editDropzoneEmpty').classList.add('hidden');
    document.getElementById('editDropzoneSelected').classList.remove('hidden');
    document.getElementById('editSelectedFileName').textContent = file.name;
    if (window.lucide) window.lucide.createIcons();
  }
}

function clearEditSelectedFile(e) {
  if (e) e.stopPropagation();
  editSelectedFile = null;
  const input = document.getElementById('editResumeFile');
  if (input) input.value = '';
  document.getElementById('editDropzoneEmpty').classList.remove('hidden');
  document.getElementById('editDropzoneSelected').classList.add('hidden');
}

async function openEditModal(rollNumber) {
  const modal = document.getElementById('editModal');
  let candidate = currentCandidates.find(c => c.rollNumber === rollNumber);

  if (!candidate) {
    try {
      const res = await fetch(`/api/candidates/${rollNumber}`);
      const data = await res.json();
      if (data.success) candidate = data.data;
    } catch (err) {
      console.error(err);
    }
  }

  if (!candidate) {
    showToast('Failed to load candidate details', 'error');
    return;
  }

  document.getElementById('editRollNumber').value = candidate.rollNumber;
  document.getElementById('editRollNumberText').textContent = candidate.rollNumber;
  document.getElementById('editName').value = candidate.name;
  document.getElementById('editEmail').value = candidate.email || '';
  document.getElementById('editDepartment').value = candidate.department || '';
  document.getElementById('editCurrentFileName').textContent = candidate.resumeFileName || `${candidate.rollNumber}_Resume.pdf`;

  editSkillsList = [...(candidate.skills || [])];
  renderEditSkillsTags();
  clearEditSelectedFile();

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (window.lucide) window.lucide.createIcons();
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  clearEditSelectedFile();
}

async function handleEditSubmit(e) {
  e.preventDefault();

  const rollNumber = document.getElementById('editRollNumber').value.trim();
  const name = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const department = document.getElementById('editDepartment').value.trim();
  const submitBtn = document.getElementById('editSubmitBtn');

  if (!name) {
    showToast('Candidate name is required', 'error');
    return;
  }

  if (editSkillsList.length === 0) {
    showToast('Please add at least one skill', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('email', email);
  formData.append('department', department || 'General');
  formData.append('skills', JSON.stringify(editSkillsList));

  if (editSelectedFile) {
    formData.append('resume', editSelectedFile);
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Saving...</span>`;

    const res = await fetch(`/api/candidates/${rollNumber}`, {
      method: 'PUT',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showToast(`Student ${rollNumber} updated successfully!`, 'success');
      closeEditModal();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      const clearSearchBtn = document.getElementById('clearSearchBtn');
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      currentSearchedTerms = [];
      await loadAllCandidates();
      loadQuickSkills();
    } else {
      showToast(data.message || 'Error updating candidate.', 'error');
    }
  } catch (err) {
    console.error('Update error:', err);
    showToast('Server error while updating candidate.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <i data-lucide="save" class="w-3.5 h-3.5"></i>
      <span>Save Changes</span>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
