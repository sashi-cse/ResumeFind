// ResumeFinder Client Application

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
});

// -------------------------------------------------------------
// THEME SWITCHER (iOS Light / Dark Mode)
// -------------------------------------------------------------
function initTheme() {
  const isDark = document.documentElement.classList.contains('dark');
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
    const res = await fetch(`/api/candidates/search?q=${encodeURIComponent(query)}`);
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
    const res = await fetch('/api/candidates');
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
            ${c.email ? `<p class="text-xs text-gray-500 dark:text-neutral-400 mb-3 flex items-center gap-1.5"><i data-lucide="mail" class="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500"></i> ${c.email}</p>` : ''}

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

  downloadBtn.onclick = () => {
    window.location.href = `/api/candidates/${rollNumber}/download`;
  };

  loading.classList.remove('hidden');
  iframe.src = `/api/candidates/${rollNumber}/preview`;
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

  const rollNumber = document.getElementById('formRollNumber').value.trim();
  const name = document.getElementById('formName').value.trim();
  const email = document.getElementById('formEmail').value.trim();
  const department = document.getElementById('formDepartment').value.trim();
  const submitBtn = document.getElementById('submitCandidateBtn');

  if (!rollNumber) {
    showToast('Please enter candidate Roll Number', 'error');
    return;
  }

  if (!name) {
    showToast('Please enter candidate Full Name', 'error');
    return;
  }

  if (currentSkillsInput.length === 0) {
    showToast('Please add at least one skill tag', 'error');
    return;
  }

  const candidateExists = currentCandidates.some(c => c.rollNumber === rollNumber);
  if (!selectedFile && !candidateExists) {
    showToast('Please attach candidate PDF resume', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('rollNumber', rollNumber);
  formData.append('name', name);
  formData.append('email', email);
  formData.append('department', department || 'General');
  formData.append('skills', JSON.stringify(currentSkillsInput));
  if (selectedFile) {
    formData.append('resume', selectedFile);
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Saving...</span>`;

    const res = await fetch('/api/candidates', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message || `Student ${name} (${rollNumber}) saved successfully!`, 'success');
      document.getElementById('candidateForm').reset();
      currentSkillsInput = [];
      renderSkillsTags();
      clearSelectedFile();
      clearRegistrationAutoFill();
      await loadQuickSkills();
      switchTab('search');
      loadAllCandidates();
    } else {
      showToast(data.message || 'Failed to save candidate', 'error');
    }
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Server error while saving candidate.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <i data-lucide="check" class="w-4 h-4"></i>
      <span>Save & Upload Resume</span>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

// -------------------------------------------------------------
// SMART ROLL NUMBER DETECTION & AUTO-FILL
// -------------------------------------------------------------
function setupRollNumberDetection() {
  const rollInput = document.getElementById('formRollNumber');
  if (!rollInput) return;

  let debounceTimer = null;
  rollInput.addEventListener('input', () => {
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

      if (candidate) {
        const banner = document.getElementById('existingCandidateBanner');
        const nameEl = document.getElementById('detectedCandidateName');
        const submitBtn = document.getElementById('submitCandidateBtn');
        const nameInput = document.getElementById('formName');
        const emailInput = document.getElementById('formEmail');
        const deptInput = document.getElementById('formDepartment');

        if (banner) banner.classList.remove('hidden');
        if (nameEl) nameEl.textContent = `${candidate.name} (${candidate.rollNumber})`;

        if (!nameInput.value) nameInput.value = candidate.name;
        if (!emailInput.value && candidate.email) emailInput.value = candidate.email;
        if (!deptInput.value && candidate.department) deptInput.value = candidate.department;

        if (currentSkillsInput.length === 0 && candidate.skills && candidate.skills.length > 0) {
          currentSkillsInput = [...candidate.skills];
          renderSkillsTags();
        }

        if (submitBtn) {
          submitBtn.innerHTML = `
            <i data-lucide="edit-3" class="w-4 h-4"></i>
            <span>Update Student & Replace Resume</span>
          `;
        }
        if (window.lucide) window.lucide.createIcons();
      } else {
        clearRegistrationAutoFill();
      }
    }, 250);
  });
}

function clearRegistrationAutoFill() {
  const banner = document.getElementById('existingCandidateBanner');
  const submitBtn = document.getElementById('submitCandidateBtn');
  if (banner) banner.classList.add('hidden');
  if (submitBtn) {
    submitBtn.innerHTML = `
      <i data-lucide="check" class="w-4 h-4"></i>
      <span>Save & Upload Resume</span>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function clearRegistrationForm() {
  document.getElementById('candidateForm').reset();
  currentSkillsInput = [];
  renderSkillsTags();
  clearSelectedFile();
  clearRegistrationAutoFill();
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
      performSearch();
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
