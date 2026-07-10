// ════════════════ DATA ════════════════
const STORE_KEY = 'aichola_users';
const ADMIN_CREDS = { email: 'admin@aichola.com', pass: 'Admin@2024' };
// Numéro marchand Aïchola
const MERCHANT_TEL = '71 12 65 93';
const MERCHANT_TEL_INT = '+228 71 12 65 93';
// ⚙️ CONFIGUREZ ICI votre lien de groupe WhatsApp de formation en ligne
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/VOTRE_LIEN_ICI'; // ← Remplacez par votre vrai lien

// Cache local synchronisé en temps réel avec Firestore (permet de garder
// les fonctions getUsers()/getCourseContent() synchrones comme avant)
let usersCache = [];
let courseContentCache = [];
let firestoreReady = false;

const usersDocRef = db.collection('aichola').doc('users');
const courseDocRef = db.collection('aichola').doc('course_content');

usersDocRef.onSnapshot(function (snap) {
  usersCache = (snap.exists && snap.data().list) ? snap.data().list : [];
  firestoreReady = true;
  // Rafraîchit le tableau admin s'il est affiché
  try {
    const searchInput = document.getElementById('admin-search');
    if (searchInput && typeof renderTable === 'function') renderTable(searchInput.value);
  } catch (e) {}
  // Rafraîchit le statut de paiement de l'étudiant connecté
  try {
    if (currentUser && currentUser.role !== 'admin' && typeof updatePaymentCardStatus === 'function') {
      updatePaymentCardStatus();
    }
  } catch (e) {}
}, function (err) {
  console.error('Erreur Firestore (users):', err);
  try { showToast('⚠️', 'Connexion impossible', 'Vérifiez votre connexion internet.'); } catch (e) {}
});

courseDocRef.onSnapshot(function (snap) {
  courseContentCache = (snap.exists && snap.data().list) ? snap.data().list : [];
  try { if (typeof renderOnlineModules === 'function') renderOnlineModules(); } catch (e) {}
  try { if (typeof renderModulesAdmin === 'function') renderModulesAdmin(); } catch (e) {}
}, function (err) {
  console.error('Erreur Firestore (course content):', err);
});

function getUsers() { return usersCache; }
function saveUsers(u) {
  usersCache = u; // mise à jour immédiate pour une UI réactive
  usersDocRef.set({ list: u }).catch(function (err) {
    console.error('Erreur sauvegarde Firestore:', err);
    try { showToast('⚠️', 'Erreur de sauvegarde', "Vérifiez votre connexion internet et réessayez."); } catch (e) {}
  });
}

// ════════════════ CONTENU DE LA FORMATION (modules : vidéos & fichiers) ════════════════
function getCourseContent() { return courseContentCache; }
function saveCourseContent(modules) {
  courseContentCache = modules;
  courseDocRef.set({ list: modules }).catch(function (err) {
    console.error('Erreur sauvegarde Firestore (contenu):', err);
    return false;
  });
  return true;
}
// Média (photo/vidéo) sélectionné depuis la galerie, en attente d'enregistrement dans le formulaire module
let selectedModuleMedia = null;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(str) { return escapeHtml(str).replace(/'/g, '&#39;'); }

// Construit l'affichage d'une vidéo à partir d'un lien (YouTube / Vimeo / lien direct)
function buildVideoEmbedHtml(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) {
    return `<div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;margin-bottom:6px;">
      <iframe src="https://www.youtube.com/embed/${yt[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  const vm = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    return `<div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;margin-bottom:6px;">
      <iframe src="https://player.vimeo.com/video/${vm[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  // Lien direct (mp4, webm...) ou tout autre lien : lecteur vidéo HTML5 avec repli en lien cliquable
  return `<video controls preload="metadata" style="width:100%;border-radius:12px;background:#000;display:block;margin-bottom:6px;" src="${escapeAttr(trimmed)}">
    Votre navigateur ne supporte pas la lecture vidéo intégrée. <a href="${escapeAttr(trimmed)}" target="_blank" style="color:var(--gold);">Ouvrir la vidéo</a>
  </video>`;
}

// Construit l'affichage d'une photo/vidéo uploadée directement depuis la galerie (pas un lien)
function buildMediaEmbedHtml(media) {
  if (!media || !media.dataUrl) return '';
  if (media.type === 'video') {
    return `<video controls preload="metadata" style="width:100%;border-radius:12px;background:#000;display:block;margin-bottom:6px;" src="${media.dataUrl}">
      Votre navigateur ne supporte pas la lecture vidéo intégrée.
    </video>`;
  }
  return `<img src="${media.dataUrl}" alt="${escapeAttr(media.name || 'photo')}" style="width:100%;border-radius:12px;display:block;margin-bottom:6px;">`;
}

// -- Affichage côté étudiant (page formation en ligne) --
function renderOnlineModules() {
  const container = document.getElementById('online-modules-list');
  if (!container) return;
  const modules = getCourseContent();
  if (modules.length === 0) {
    container.innerHTML = `<div class="modules-empty">Le contenu (vidéos, supports) sera ajouté ici par l'équipe AÏCHOLA MÉDIA très prochainement.</div>`;
    return;
  }
  container.innerHTML = modules.map(mod => `
    <div class="online-module-card">
      <div class="online-module-title">📦 ${escapeHtml(mod.title)}</div>
      ${mod.media ? buildMediaEmbedHtml(mod.media) : ''}
      ${mod.videoUrl ? buildVideoEmbedHtml(mod.videoUrl) : ''}
      ${(mod.files && mod.files.length) ? `
        <div class="online-module-files">
          ${mod.files.map(f => `<a href="${escapeAttr(f.url)}" target="_blank" rel="noopener" class="online-file-btn">📥 ${escapeHtml(f.name)}</a>`).join('')}
        </div>` : ''}
    </div>
  `).join('');
}

// -- Gestion côté admin --
function renderModulesAdmin() {
  const container = document.getElementById('modules-admin-list');
  if (!container) return;
  const modules = getCourseContent();
  if (modules.length === 0) {
    container.innerHTML = `<div class="modules-empty">Aucun module pour le moment. Ajoutez-en un ci-dessous (vidéo + fichiers).</div>`;
    return;
  }
  container.innerHTML = modules.map(mod => `
    <div class="module-admin-card">
      <div class="module-admin-card-top">
        <div class="module-admin-title">📦 ${escapeHtml(mod.title)}</div>
        <div class="module-admin-actions">
          <button onclick="editModule('${mod.id}')" class="btn-mini btn-mini-gold">✏️ Modifier</button>
          <button onclick="deleteModule('${mod.id}')" class="btn-mini btn-mini-danger">🗑 Supprimer</button>
        </div>
      </div>
      ${mod.media ? `<div class="module-admin-media">${mod.media.type === 'video' ? '🎬 Vidéo' : '🖼️ Photo'} depuis la galerie : ${escapeHtml(mod.media.name || '')}</div>` : ''}
      ${mod.videoUrl ? `<div class="module-admin-video">🎬 Vidéo : <a href="${escapeAttr(mod.videoUrl)}" target="_blank">${escapeHtml(mod.videoUrl)}</a></div>` : ''}
      ${(mod.files && mod.files.length) ? `<div class="module-admin-files">📎 ${mod.files.length} fichier(s) : ${mod.files.map(f => escapeHtml(f.name)).join(', ')}</div>` : ''}
    </div>
  `).join('');
}

// Ouvre le sélecteur de fichiers (galerie photos/vidéos du téléphone ou de l'ordinateur)
function handleModuleMediaSelect(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    showToast('⚠️', 'Format non supporté', 'Merci de choisir une photo ou une vidéo.');
    input.value = '';
    return;
  }
  // Limite raisonnable pour éviter de saturer le stockage du navigateur
  const maxSizeMB = isVideo ? 30 : 8;
  if (file.size > maxSizeMB * 1024 * 1024) {
    showToast('⚠️', 'Fichier trop volumineux', `Choisissez un fichier de moins de ${maxSizeMB} Mo (ou utilisez plutôt le champ "Lien vidéo").`);
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    selectedModuleMedia = { type: isVideo ? 'video' : 'image', dataUrl: e.target.result, name: file.name };
    renderModuleMediaPreview();
  };
  reader.onerror = function () {
    showToast('⚠️', 'Erreur de lecture', "Impossible de charger ce fichier depuis la galerie.");
  };
  reader.readAsDataURL(file);
}

// Affiche l'aperçu de la photo/vidéo choisie dans le formulaire admin
function renderModuleMediaPreview() {
  const box = document.getElementById('module-media-preview');
  if (!box) return;
  if (!selectedModuleMedia) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'block';
  const tag = selectedModuleMedia.type === 'video'
    ? `<video src="${selectedModuleMedia.dataUrl}" controls></video>`
    : `<img src="${selectedModuleMedia.dataUrl}" alt="aperçu">`;
  box.innerHTML = `
    <button type="button" class="module-media-remove" onclick="removeModuleMedia()" title="Retirer ce média">✕</button>
    ${tag}
    <div class="module-media-preview-name">${selectedModuleMedia.type === 'video' ? '🎬' : '🖼️'} ${escapeHtml(selectedModuleMedia.name)}</div>
  `;
}

// Retire le média sélectionné (avant enregistrement)
function removeModuleMedia() {
  selectedModuleMedia = null;
  const input = document.getElementById('module-media-input');
  if (input) input.value = '';
  renderModuleMediaPreview();
}

function addFileRowAdmin(prefill) {
  const wrap = document.getElementById('module-files-rows');
  if (!wrap) return;
  const rowId = 'frow-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  const row = document.createElement('div');
  row.className = 'file-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <input class="form-input" placeholder="Nom du fichier (ex: Support Jour 1.pdf)" data-field="name" value="${prefill ? escapeAttr(prefill.name) : ''}">
    <input class="form-input" placeholder="Lien Google Drive / Dropbox" data-field="url" value="${prefill ? escapeAttr(prefill.url) : ''}">
    <button type="button" onclick="removeFileRowAdmin('${rowId}')" class="btn-mini btn-mini-danger" title="Retirer ce fichier">✕</button>
  `;
  wrap.appendChild(row);
}

function removeFileRowAdmin(rowId) {
  const row = document.querySelector('.file-row[data-row-id="' + rowId + '"]');
  if (row) row.remove();
}

function resetModuleForm() {
  document.getElementById('module-edit-id').value = '';
  document.getElementById('module-title-input').value = '';
  document.getElementById('module-video-input').value = '';
  document.getElementById('module-files-rows').innerHTML = '';
  document.getElementById('module-form-heading').textContent = '➕ AJOUTER UN MODULE';
  selectedModuleMedia = null;
  const mediaInput = document.getElementById('module-media-input');
  if (mediaInput) mediaInput.value = '';
  renderModuleMediaPreview();
}

function saveModuleForm() {
  const titleEl = document.getElementById('module-title-input');
  const title = titleEl.value.trim();
  if (!title) {
    showToast('⚠️', 'Titre requis', 'Merci de donner un titre au module.');
    titleEl.focus();
    return;
  }
  const videoUrl = document.getElementById('module-video-input').value.trim();
  const fileRows = Array.from(document.querySelectorAll('#module-files-rows .file-row'));
  const files = fileRows.map(row => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    url: row.querySelector('[data-field="url"]').value.trim()
  })).filter(f => f.name && f.url)
     .map((f, i) => ({ id: 'f-' + Date.now() + '-' + i, name: f.name, url: f.url }));

  const editId = document.getElementById('module-edit-id').value;
  const modules = getCourseContent();
  const media = selectedModuleMedia;

  if (editId) {
    const idx = modules.findIndex(m => m.id === editId);
    if (idx > -1) { modules[idx] = { ...modules[idx], title, videoUrl, files, media }; }
  } else {
    modules.push({ id: 'mod-' + Date.now(), title, videoUrl, files, media });
  }

  const ok = saveCourseContent(modules);
  if (!ok) {
    showToast('⚠️', 'Stockage plein', 'Le fichier est trop volumineux pour être enregistré. Essayez une vidéo plus courte/légère, ou utilisez un lien vidéo.');
    return;
  }
  showToast('✅', editId ? 'Module modifié' : 'Module ajouté', title);
  resetModuleForm();
  renderModulesAdmin();
}

function editModule(id) {
  const mod = getCourseContent().find(m => m.id === id);
  if (!mod) return;
  document.getElementById('module-edit-id').value = mod.id;
  document.getElementById('module-title-input').value = mod.title || '';
  document.getElementById('module-video-input').value = mod.videoUrl || '';
  document.getElementById('module-files-rows').innerHTML = '';
  (mod.files || []).forEach(f => addFileRowAdmin(f));
  selectedModuleMedia = mod.media || null;
  const mediaInput = document.getElementById('module-media-input');
  if (mediaInput) mediaInput.value = '';
  renderModuleMediaPreview();
  document.getElementById('module-form-heading').textContent = '✏️ MODIFIER LE MODULE';
  const card = document.getElementById('module-form-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteModule(id) {
  if (!confirm('Supprimer ce module et son contenu ?')) return;
  saveCourseContent(getCourseContent().filter(m => m.id !== id));
  renderModulesAdmin();
}

// ════════════════ GÉNÉRATION DE RÉFÉRENCE UNIQUE ════════════════
// Format : ACM-INS-XXXXXX-YYYYMMDD (inscription) ou ACM-FOR-XXXXXX-YYYYMMDD (formation)
// Le code 6 chiffres = 3 derniers du timestamp + 3 aléatoires → unicité garantie
function generateRef(type) {
  const prefix = type === 'formation' ? 'FOR' : 'INS';
  const ts = Date.now();
  const tsPart  = String(ts).slice(-3);
  const randPart = String(Math.floor(Math.random() * 900) + 100);
  const code = tsPart + randPart;
  const d = new Date(ts);
  const datePart =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  return 'ACM-' + prefix + '-' + code + '-' + datePart;
}

let currentUser = null;
let currentTab = 'student';
let lang = 'fr';
let payContext = { amount: 10000, type: 'inscription' }; // inscription ou formation
let payTimer = null;
let selectedMethod = null;

// ════════════════ TRANSLATIONS ════════════════
const T = {
  fr: {
    'topbar-sub': 'Centre de Formation Professionnelle',
    't-login-title': 'Connexion', 't-login-sub': 'Accédez à votre espace formation',
    't-email-lbl': 'Email', 't-pass-lbl': 'Mot de passe', 't-login-btn': 'SE CONNECTER',
    't-no-account': 'Pas encore de compte ?', 't-register-link': " S'inscrire",
    't-reg-title': 'Inscription à la Formation', 't-reg-sub': 'Créez votre compte étudiant · Une semaine intensive',
    't-photo-lbl': 'Photo de profil', 't-click-upload': 'Cliquer pour télécharger', 't-photo-hint': 'JPG, PNG — max 5MB',
    't-prenom': 'Prénom', 't-nom': 'Nom', 't-reg-email': 'Email', 't-tel': 'Téléphone',
    't-niveau': "Niveau d'étude", 't-adresse': 'Adresse', 't-reg-pass': 'Mot de passe',
    't-reg-btn': 'CRÉER MON COMPTE', 't-have-account': 'Déjà un compte ?', 't-login-link': ' Se connecter',
    't-welcome-sub': 'Formation professionnelle · AÏCHOLA MÉDIA', 't-inscrit': 'Inscrit',
    't-my-info': 'Mes informations', 't-d-email': 'Email', 't-d-tel': 'Téléphone',
    't-d-adresse': 'Adresse', 't-d-niveau': 'Niveau',
    't-my-formation': 'Ma formation & Paiements',
    't-inscription-p': 'Inscription', 't-formation-p': 'Formation',
    't-duree-label': 'Durée', 't-duree-val': '1 Semaine Intensive',
    't-obj-card': 'Programme de la formation',
    't-admin-title-inner': 'Tableau de bord', 't-admin-sub': 'Gestion des inscriptions · AÏCHOLA MÉDIA',
    't-stat-total': 'Total inscrits', 't-stat-today': "Inscrits aujourd'hui",
    't-stat-paid': 'Inscription payée', 't-stat-contact': 'Contact principal',
    't-all-students': 'Tous les étudiants',
    't-th-photo': 'Photo', 't-th-nom': 'Nom complet', 't-th-email': 'Email',
    't-th-tel': 'Téléphone', 't-th-niveau': 'Niveau', 't-th-adresse': 'Adresse',
    't-th-date': 'Date', 't-th-action': 'Action',
    't-no-students': 'Aucun étudiant inscrit pour le moment', 't-logout': 'Déconnexion',
    'tab-student': 'Étudiant', 'tab-admin': 'Administrateur',
    // Paiement
    't-pay-title': "Frais d'inscription",
    't-pay-subtitle': 'Réglez vos frais pour accéder à la formation',
    't-pay-amount-lbl': 'Montant à payer',
    't-pay-amount-sub': "Frais d'inscription · AÏCHOLA MÉDIA",
    't-choose-method': 'Choisir la méthode de paiement',
    't-yas-tag': 'Mobile Money', 't-moov-tag': 'Mobile Money',
    't-yas-num-lbl': 'Numéro marchand', 't-ref-lbl': 'Référence', 't-ref-lbl2': 'Référence',
    't-moov-num-lbl': 'Numéro marchand',
    't-yas-phone-lbl': 'Votre numéro YAS (pour vérification)',
    't-moov-phone-lbl': 'Votre numéro MOOV (pour vérification)',
    't-pending-title': 'Vérification en cours...',
    't-pending-sub': "Nous vérifions votre paiement.<br>Assurez-vous d'avoir reçu le SMS de confirmation de votre opérateur.",
    't-btn-done': '✅ PAIEMENT CONFIRMÉ – ACCÉDER À MON ESPACE',
    't-pending-ref': 'Réf : ',
    'step-lbl-1': 'Inscription', 'step-lbl-2': 'Paiement', 'step-lbl-3': 'Espace étudiant',
    'objectives': [
      'Maîtrise des outils bureautiques',
      'Maîtrise du traitement de texte',
      'Réalisation du CV',
      "Réalisation d'une bonne lettre de motivation",
      "Réalisation d'une bonne présentation",
      'Bonne prise de parole en publique'
    ],
    'toast-reg-title': 'Compte créé !', 'toast-reg-msg': 'Procédez au paiement des frais d\'inscription.',
    'toast-login-title': 'Connexion réussie', 'toast-login-msg': 'Content de vous revoir !',
    'toast-pay-title': 'Paiement enregistré !', 'toast-pay-msg': 'Bienvenue dans votre espace formation.',
    'err-fill': 'Veuillez remplir tous les champs.',
    'err-email': 'Cet email est déjà utilisé.',
    'err-pass-short': 'Le mot de passe doit faire au moins 6 caractères.',
    'err-login': 'Email ou mot de passe incorrect.',
    'err-phone': 'Veuillez entrer votre numéro de téléphone.',
    'pay-inscrit': 'Payé ✓', 'pay-non-inscrit': 'En attente',
    'pay-formation-done': 'Payé ✓', 'pay-formation-pending': 'En attente',
  },
  en: {
    'topbar-sub': 'Professional Training Center',
    't-login-title': 'Sign In', 't-login-sub': 'Access your training space',
    't-email-lbl': 'Email', 't-pass-lbl': 'Password', 't-login-btn': 'SIGN IN',
    't-no-account': 'No account yet?', 't-register-link': ' Register',
    't-reg-title': 'Training Registration', 't-reg-sub': 'Create your student account · One intensive week',
    't-photo-lbl': 'Profile photo', 't-click-upload': 'Click to upload', 't-photo-hint': 'JPG, PNG — max 5MB',
    't-prenom': 'First name', 't-nom': 'Last name', 't-reg-email': 'Email', 't-tel': 'Phone',
    't-niveau': 'Education level', 't-adresse': 'Address', 't-reg-pass': 'Password',
    't-reg-btn': 'CREATE MY ACCOUNT', 't-have-account': 'Already have an account?', 't-login-link': ' Sign in',
    't-welcome-sub': 'Professional training · AÏCHOLA MÉDIA', 't-inscrit': 'Registered',
    't-my-info': 'My information', 't-d-email': 'Email', 't-d-tel': 'Phone',
    't-d-adresse': 'Address', 't-d-niveau': 'Level',
    't-my-formation': 'My training & Payments',
    't-inscription-p': 'Registration', 't-formation-p': 'Training fee',
    't-duree-label': 'Duration', 't-duree-val': '1 Intensive Week',
    't-obj-card': 'Training program',
    't-admin-title-inner': 'Dashboard', 't-admin-sub': 'Registration management · AÏCHOLA MÉDIA',
    't-stat-total': 'Total registered', 't-stat-today': 'Registered today',
    't-stat-paid': 'Registration paid', 't-stat-contact': 'Main contact',
    't-all-students': 'All students',
    't-th-photo': 'Photo', 't-th-nom': 'Full name', 't-th-email': 'Email',
    't-th-tel': 'Phone', 't-th-niveau': 'Level', 't-th-adresse': 'Address',
    't-th-date': 'Date', 't-th-action': 'Action',
    't-no-students': 'No students registered yet', 't-logout': 'Sign out',
    'tab-student': 'Student', 'tab-admin': 'Administrator',
    't-pay-title': 'Registration fee',
    't-pay-subtitle': 'Pay your fees to access the training',
    't-pay-amount-lbl': 'Amount to pay',
    't-pay-amount-sub': 'Registration fee · AÏCHOLA MÉDIA',
    't-choose-method': 'Choose payment method',
    't-yas-tag': 'Mobile Money', 't-moov-tag': 'Mobile Money',
    't-yas-num-lbl': 'Merchant number', 't-ref-lbl': 'Reference', 't-ref-lbl2': 'Reference',
    't-moov-num-lbl': 'Merchant number',
    't-yas-phone-lbl': 'Your YAS number (for verification)',
    't-moov-phone-lbl': 'Your MOOV number (for verification)',
    't-pending-title': 'Verifying payment...',
    't-pending-sub': 'We are verifying your payment.<br>Make sure you received the confirmation SMS from your operator.',
    't-btn-done': '✅ PAYMENT CONFIRMED – ACCESS MY SPACE',
    't-pending-ref': 'Ref: ',
    'step-lbl-1': 'Registration', 'step-lbl-2': 'Payment', 'step-lbl-3': 'Student space',
    'objectives': [
      'Mastering office tools',
      'Mastering word processing',
      'CV creation',
      'Writing a strong cover letter',
      'Creating a great presentation',
      'Public speaking skills'
    ],
    'toast-reg-title': 'Account created!', 'toast-reg-msg': 'Please proceed to pay the registration fee.',
    'toast-login-title': 'Login successful', 'toast-login-msg': 'Good to see you!',
    'toast-pay-title': 'Payment recorded!', 'toast-pay-msg': 'Welcome to your training space.',
    'err-fill': 'Please fill in all fields.',
    'err-email': 'This email is already taken.',
    'err-pass-short': 'Password must be at least 6 characters.',
    'err-login': 'Incorrect email or password.',
    'err-phone': 'Please enter your phone number.',
    'pay-inscrit': 'Paid ✓', 'pay-non-inscrit': 'Pending',
    'pay-formation-done': 'Paid ✓', 'pay-formation-pending': 'Pending',
  }
};

function t(key) { return T[lang][key] || T['fr'][key] || key; }

function setLang(l) {
  lang = l;
  document.getElementById('btn-fr').classList.toggle('active', l === 'fr');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');
  applyTranslations();
}

function applyTranslations() {
  const ids = [
    'topbar-sub','t-login-title','t-login-sub','t-email-lbl','t-pass-lbl','t-login-btn',
    't-no-account','t-register-link','t-reg-title','t-reg-sub','t-photo-lbl','t-click-upload',
    't-photo-hint','t-prenom','t-nom','t-reg-email','t-tel','t-niveau','t-adresse','t-reg-pass',
    't-reg-btn','t-have-account','t-login-link','t-welcome-sub','t-inscrit','t-my-info',
    't-d-email','t-d-tel','t-d-adresse','t-d-niveau','t-my-formation','t-inscription-p',
    't-formation-p','t-duree-label','t-duree-val','t-obj-card','t-admin-sub','t-stat-total',
    't-stat-today','t-stat-paid','t-stat-contact','t-all-students','t-th-photo','t-th-nom',
    't-th-email','t-th-tel','t-th-niveau','t-th-adresse','t-th-date','t-th-action',
    't-no-students','t-logout',
    't-pay-title','t-pay-subtitle','t-pay-amount-lbl','t-pay-amount-sub','t-choose-method',
    't-yas-tag','t-moov-tag','t-yas-num-lbl','t-ref-lbl','t-ref-lbl2','t-moov-num-lbl',
    't-yas-phone-lbl','t-moov-phone-lbl','t-pending-title','t-btn-done','t-pending-ref',
    'step-lbl-1','step-lbl-2','step-lbl-3'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(id);
  });
  const tabStu = document.getElementById('tab-student');
  const tabAdm = document.getElementById('tab-admin');
  if (tabStu) tabStu.textContent = t('tab-student');
  if (tabAdm) tabAdm.textContent = t('tab-admin');
  const atEl = document.getElementById('t-admin-title');
  if (atEl) atEl.innerHTML = t('t-admin-title-inner') + ' <span>Admin</span>';
  const pendSub = document.getElementById('t-pending-sub');
  if (pendSub) pendSub.innerHTML = t('t-pending-sub');
  const srch = document.getElementById('admin-search');
  if (srch) srch.placeholder = '🔍 Rechercher...';
  // Uniquement si les pages concernées sont actives
  try { renderObjectives(); } catch(e) {}
  const adminPage = document.getElementById('page-admin');
  if (adminPage && adminPage.classList.contains('active')) {
    try { renderTable(); } catch(e) {}
  }
  if (currentUser && currentUser.role !== 'admin') {
    try { updatePaymentCardStatus(); } catch(e) {}
  }
}

// ════════════════ NAVIGATION ════════════════
function showPage(name) {
  // Sécurité : bloquer page admin si pas admin connecté
  if (name === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
    name = 'login';
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const logoutBtn = document.getElementById('btn-logout-top');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', name === 'login' || name === 'register' || name === 'payment' || name === 'waiting');
  window.scrollTo(0, 0);
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-student').classList.toggle('active', tab === 'student');
  document.getElementById('tab-admin').classList.toggle('active', tab === 'admin');
  document.getElementById('student-switch').classList.toggle('hidden', tab === 'admin');
  document.getElementById('error-login').classList.remove('show');
}

// ════════════════ AUTH ════════════════
function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('error-login');
  errEl.classList.remove('show');

  // Validation
  if (!email && !pass) { showError(errEl, '⚠ Veuillez remplir tous les champs'); return; }
  if (!email) { showError(errEl, '⚠ L\'email est obligatoire'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showError(errEl, '⚠ Format email invalide (exemple : nom@email.com)'); return; }
  if (!pass) { showError(errEl, '⚠ Le mot de passe est obligatoire'); return; }
  if (pass.length < 6) { showError(errEl, '⚠ Mot de passe trop court'); return; }
  if (currentTab === 'admin') {
    if (email === ADMIN_CREDS.email && pass === ADMIN_CREDS.pass) {
      currentUser = { email: ADMIN_CREDS.email, role: 'admin', prenom: 'Admin', nom: '' };
      showToast('✅', t('toast-login-title'), t('toast-login-msg'));
      loadAdminDash();
    } else { showError(errEl, t('err-login')); }
    return;
  }
  const users = getUsers();
  const user = users.find(u => u.email === email && u.pass === pass);
  if (!user) { showError(errEl, t('err-login')); return; }
  currentUser = user;
  showToast('✅', t('toast-login-title'), t('toast-login-msg'));
  // Si l'inscription n'est pas encore payée, rediriger vers paiement
  if (!user.payInscription) {
    openPaymentPage('inscription');
  } else if (!user.activated) {
    // Paiement fait mais pas encore activé par l'admin
    showWaitingPage(user);
  } else {
    loadStudentDash(user);
  }
}

// ════════════════ VALIDATION HELPERS ════════════════
function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  // Marquer le champ en rouge
  const inputId = id.replace('err-', 'reg-');
  const input = document.getElementById(inputId);
  if (input) { input.classList.add('invalid'); input.classList.remove('valid'); }
}

function clearFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  const inputId = id.replace('err-', 'reg-');
  const input = document.getElementById(inputId);
  if (input && input.value.trim()) { input.classList.remove('invalid'); input.classList.add('valid'); }
}

function clearAllErrors() {
  ['err-prenom','err-nom','err-email','err-tel','err-niveau','err-adresse','err-pass','err-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('show'); el.textContent = ''; }
  });
  ['reg-prenom','reg-nom','reg-email','reg-tel','reg-niveau','reg-adresse','reg-pass','reg-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('invalid'); el.classList.remove('valid'); }
  });
}

function togglePass(inputId, eyeId) {
  const input = document.getElementById(inputId);
  const eye = document.getElementById(eyeId);
  if (!input) return;
  if (input.type === 'password') { input.type = 'text'; if (eye) eye.textContent = '🙈'; }
  else { input.type = 'password'; if (eye) eye.textContent = '👁'; }
}

function formatTel(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 2) v = v.slice(0,2) + ' ' + v.slice(2);
  if (v.length > 5) v = v.slice(0,5) + ' ' + v.slice(5);
  input.value = v;
}

function checkPassStrength() {
  const pass = document.getElementById('reg-pass').value;
  const fill = document.getElementById('pass-strength-fill');
  const txt = document.getElementById('pass-strength-txt');
  if (!fill || !txt) return;
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  const levels = [
    { w: '0%',   c: 'transparent', label: '' },
    { w: '25%',  c: '#e74c3c',     label: '⚠ Très faible' },
    { w: '50%',  c: '#e67e22',     label: '△ Faible' },
    { w: '75%',  c: '#f1c40f',     label: '◑ Moyen' },
    { w: '100%', c: '#2ecc71',     label: '✓ Fort' },
  ];
  const lvl = levels[score] || levels[0];
  fill.style.width = lvl.w;
  fill.style.background = lvl.c;
  txt.textContent = lvl.label;
  txt.style.color = lvl.c;
}

function doRegister() {
  clearAllErrors();
  const prenom  = document.getElementById('reg-prenom').value.trim();
  const nom     = document.getElementById('reg-nom').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const tel     = document.getElementById('reg-tel').value.trim();
  const niveau  = document.getElementById('reg-niveau').value;
  const adresse = document.getElementById('reg-adresse').value.trim();
  const pass    = document.getElementById('reg-pass').value;
  const pass2El = document.getElementById('reg-pass2');
  const pass2   = pass2El ? pass2El.value : pass;

  let hasError = false;

  // Prénom
  if (!prenom) { setFieldError('err-prenom', '⚠ Le prénom est obligatoire'); hasError = true; }
  else if (prenom.length < 2) { setFieldError('err-prenom', '⚠ Minimum 2 caractères'); hasError = true; }
  else if (!/^[A-Za-zÀ-ÿ\s\-]+$/.test(prenom)) { setFieldError('err-prenom', '⚠ Lettres uniquement (pas de chiffres)'); hasError = true; }

  // Nom
  if (!nom) { setFieldError('err-nom', '⚠ Le nom est obligatoire'); hasError = true; }
  else if (nom.length < 2) { setFieldError('err-nom', '⚠ Minimum 2 caractères'); hasError = true; }
  else if (!/^[A-Za-zÀ-ÿ\s\-]+$/.test(nom)) { setFieldError('err-nom', '⚠ Lettres uniquement (pas de chiffres)'); hasError = true; }

  // Email
  if (!email) { setFieldError('err-email', '⚠ L\'email est obligatoire'); hasError = true; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setFieldError('err-email', '⚠ Format invalide (exemple : nom@email.com)'); hasError = true; }

  // Téléphone
  const telRaw = tel.replace(/\s/g, '');
  if (!tel) { setFieldError('err-tel', '⚠ Le téléphone est obligatoire'); hasError = true; }
  else if (!/^\d{8}$/.test(telRaw)) { setFieldError('err-tel', '⚠ 8 chiffres requis (format Togo : 71 12 65 93)'); hasError = true; }

  // Niveau
  if (!niveau) { setFieldError('err-niveau', '⚠ Veuillez choisir votre niveau'); hasError = true; }

  // Adresse
  if (!adresse) { setFieldError('err-adresse', '⚠ L\'adresse est obligatoire'); hasError = true; }
  else if (adresse.length < 5) { setFieldError('err-adresse', '⚠ Adresse trop courte (minimum 5 caractères)'); hasError = true; }

  // Mot de passe
  if (!pass) { setFieldError('err-pass', '⚠ Le mot de passe est obligatoire'); hasError = true; }
  else if (pass.length < 8) { setFieldError('err-pass', '⚠ Minimum 8 caractères'); hasError = true; }
  else if (!/[A-Z]/.test(pass)) { setFieldError('err-pass', '⚠ Au moins 1 lettre majuscule requise'); hasError = true; }
  else if (!/[0-9]/.test(pass)) { setFieldError('err-pass', '⚠ Au moins 1 chiffre requis'); hasError = true; }

  // Confirmation mot de passe
  if (!pass2) { setFieldError('err-pass2', '⚠ Veuillez confirmer votre mot de passe'); hasError = true; }
  else if (pass !== pass2) { setFieldError('err-pass2', '⚠ Les mots de passe ne correspondent pas'); hasError = true; }

  if (hasError) return;

  // Email déjà utilisé
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    setFieldError('err-email', '⚠ Cet email est déjà utilisé');
    return;
  }

  const photo = document.getElementById('photo-preview').src || '';
  const newUser = {
    id: Date.now(),
    prenom, nom, email, tel, niveau, adresse, pass,
    photo: photo && photo.startsWith('data:') ? photo : '',
    date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB'),
    payInscription: false,
    payFormation: false,
    payMethod: '',
    payRef: '',
    activated: false,
    paymentSent: false
  };
  users.push(newUser);
  saveUsers(users);
  currentUser = newUser;
  showToast('🎉', t('toast-reg-title'), t('toast-reg-msg'));
  try {
    openPaymentPage('inscription');
  } catch(e) {
    console.error('openPaymentPage error:', e);
    showPage('payment');
  }
}

function logout() {
  currentUser = null;
  clearPayTimer();
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  showPage('login');
}

// ════════════════ PAGE PAIEMENT ════════════════
function openPaymentPage(type) {
  try {
    // Réinitialiser l'état
    payContext.type = type;
    payContext.amount = type === 'inscription' ? 10000 : 100000;
    selectedMethod = null;

    const getEl = (id) => document.getElementById(id);

    // Reset UI
    if (getEl('pay-main')) getEl('pay-main').style.display = 'block';
    if (getEl('pay-pending')) getEl('pay-pending').classList.remove('show');
    if (getEl('detail-yas')) getEl('detail-yas').classList.remove('show');
    if (getEl('detail-moov')) getEl('detail-moov').classList.remove('show');
    if (getEl('pm-btn-yas')) getEl('pm-btn-yas').classList.remove('selected');
    if (getEl('pm-btn-moov')) getEl('pm-btn-moov').classList.remove('selected');
    if (getEl('input-phone-yas')) getEl('input-phone-yas').value = '';
    if (getEl('input-phone-moov')) getEl('input-phone-moov').value = '';

    // Montant affiché
    const amtStr = type === 'inscription' ? '10 000 F' : '100 000 F';
    if (getEl('pay-amount-display')) getEl('pay-amount-display').textContent = amtStr;

    // Titre & sous-titre selon type
    if (type === 'formation') {
      if (getEl('t-pay-title')) getEl('t-pay-title').textContent = lang === 'fr' ? 'Frais de formation' : 'Training fee';
      if (getEl('t-pay-amount-sub')) getEl('t-pay-amount-sub').textContent = lang === 'fr' ? 'Frais de formation · AÏCHOLA MÉDIA' : 'Training fee · AÏCHOLA MÉDIA';
    } else {
      if (getEl('t-pay-title')) getEl('t-pay-title').textContent = t('t-pay-title');
      if (getEl('t-pay-amount-sub')) getEl('t-pay-amount-sub').textContent = t('t-pay-amount-sub');
    }

    // Générer référence unique : ACM-INS-XXXXXX-YYYYMMDD ou ACM-FOR-XXXXXX-YYYYMMDD
    const ref = generateRef(type);
    if (getEl('ref-display-yas')) getEl('ref-display-yas').textContent = ref;
    if (getEl('ref-display-moov')) getEl('ref-display-moov').textContent = ref;
    if (getEl('pending-ref-show')) getEl('pending-ref-show').textContent = ref;

    // Étapes
    if (type === 'formation') {
      if (getEl('step-dot-1')) { getEl('step-dot-1').textContent = '✓'; getEl('step-dot-1').className = 'pay-step-dot done'; }
      if (getEl('step-lbl-2')) getEl('step-lbl-2').textContent = lang === 'fr' ? 'Formation' : 'Training';
    } else {
      if (getEl('step-lbl-2')) getEl('step-lbl-2').textContent = t('step-lbl-2');
    }

    // Boutons + codes USSD + WhatsApp
    updatePayBtnText();
    updateUssdCodes();
    if (currentUser) updateWhatsAppLinks(currentUser, ref);

  } catch(e) {
    console.error('openPaymentPage init error:', e);
  }

  // showPage toujours appelé même en cas d'erreur partielle
  showPage('payment');
}

function updatePayBtnText() {
  const amtStr = payContext.amount === 10000 ? '10 000 F' : '100 000 F';
  const yasBtn = document.getElementById('btn-pay-yas');
  const moovBtn = document.getElementById('btn-pay-moov');
  if (yasBtn) yasBtn.textContent = 'J\'AI PAYÉ VIA YAS TOGO';
  if (moovBtn) moovBtn.textContent = 'J\'AI PAYÉ VIA MOOV MONEY';
  const s3 = document.getElementById('t-yas-step3');
  if (s3) s3.innerHTML = 'Bénéficiaire : <strong>' + MERCHANT_TEL + '</strong> · Montant : <strong>' + amtStr + '</strong>';
  const s3m = document.getElementById('t-moov-step3');
  if (s3m) s3m.innerHTML = 'Bénéficiaire : <strong>' + MERCHANT_TEL + '</strong> · Montant : <strong>' + amtStr + '</strong>';
}

function chooseMethod(method) {
  selectedMethod = method;
  document.getElementById('pm-btn-yas').classList.toggle('selected', method === 'yas');
  document.getElementById('pm-btn-moov').classList.toggle('selected', method === 'moov');
  document.getElementById('detail-yas').classList.toggle('show', method === 'yas');
  document.getElementById('detail-moov').classList.toggle('show', method === 'moov');
}

function initiatePay(method) {
  const phoneInput = document.getElementById('input-phone-' + method);
  if (!phoneInput.value.trim()) {
    showToast('⚠️', lang === 'fr' ? 'Numéro requis' : 'Number required', t('err-phone'));
    phoneInput.focus();
    return;
  }
  // Passer à l'écran d'attente
  document.getElementById('pay-main').style.display = 'none';
  document.getElementById('pay-pending').classList.add('show');
  document.getElementById('step-dot-2').className = 'pay-step-dot active';
  startPayTimer();
}

function startPayTimer() {
  clearPayTimer();
  let secs = 30; // 30 secondes
  updateTimerDisplay(secs);
  payTimer = setInterval(() => {
    secs--;
    updateTimerDisplay(secs);
    if (secs <= 0) {
      clearPayTimer();
      confirmPayDone();
    }
  }, 1000);
}

function updateTimerDisplay(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  const el = document.getElementById('pay-timer');
  if (el) el.textContent = m + ':' + sec;
}

function clearPayTimer() {
  if (payTimer) { clearInterval(payTimer); payTimer = null; }
}

function confirmPayDone() {
  clearPayTimer();
  const ref = document.getElementById('ref-display-' + (selectedMethod || 'yas')).textContent;
  const now = new Date();
  // Marquer le paiement dans le profil (en attente d'activation admin)
  const users = getUsers();
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx > -1) {
    if (payContext.type === 'inscription') {
      users[idx].payInscription = true;
      users[idx].payMethod = selectedMethod || 'yas';
      users[idx].payRef = ref;
      users[idx].payDate = now.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB');
      users[idx].activated = false;
      users[idx].paymentSent = true;
      users[idx].payTimestamp = Date.now(); // ← chronomètre 24h inscription
    } else {
      users[idx].payFormation = true;
      users[idx].payFormationMethod = selectedMethod || 'yas';
      users[idx].payFormationRef = ref;
      users[idx].payFormationDate = now.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB');
      users[idx].formationActivated = false; // admin doit activer avant accès cours
      users[idx].payFormationSent = true;
      users[idx].payFormationTimestamp = Date.now(); // ← chronomètre 24h formation
    }
    saveUsers(users);
    currentUser = users[idx];
  }
  showToast('📨', 'Paiement enregistré !', 'En attente de validation par l\'administrateur.');
  const dot2 = document.getElementById('step-dot-2');
  const line2 = document.getElementById('step-line-2');
  if (dot2) { dot2.className = 'pay-step-dot done'; dot2.textContent = '✓'; }
  if (line2) line2.classList.add('done');

  // Dans les deux cas (inscription ET formation) → page attente activation admin
  setTimeout(() => showWaitingPage(currentUser), 400);
}

function showSummaryPage(ref, dateObj) {
  const u = currentUser;
  const method = selectedMethod || 'yas';
  const isInscription = payContext.type === 'inscription';
  const amtStr = isInscription ? '10 000 F' : '100 000 F';
  const typeStr = isInscription
    ? (lang === 'fr' ? "Frais d'inscription" : 'Registration fee')
    : (lang === 'fr' ? 'Frais de formation' : 'Training fee');
  const dateStr = dateObj ? dateObj.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB') : new Date().toLocaleString();

  document.getElementById('receipt-date').textContent = dateStr;
  document.getElementById('receipt-name').textContent = u.prenom + ' ' + u.nom;
  document.getElementById('receipt-email').textContent = u.email;
  document.getElementById('receipt-tel').textContent = u.tel;
  document.getElementById('receipt-niveau').textContent = u.niveau;
  document.getElementById('receipt-amount').textContent = amtStr;
  document.getElementById('receipt-type').textContent = typeStr;
  document.getElementById('receipt-ref').textContent = ref;

  // Badge méthode
  const methodEl = document.getElementById('receipt-method-badge');
  if (method === 'yas') {
    methodEl.className = 'val method-yas';
    methodEl.textContent = '📱 YAS TOGO';
  } else {
    methodEl.className = 'val method-moov';
    methodEl.textContent = '💳 MOOV MONEY';
  }

  showPage('summary');
}

function downloadReceipt() {
  const u = currentUser;
  if (!u) return;
  const ref = document.getElementById('receipt-ref').textContent;
  const amt = document.getElementById('receipt-amount').textContent;
  const method = selectedMethod === 'moov' ? 'MOOV MONEY' : 'YAS TOGO';
  const dateStr = document.getElementById('receipt-date').textContent;

  const sep = '=======================================';
  const lines = [
    'RECU DE PAIEMENT - AICHOLA MEDIA',
    sep,
    'Centre de Formation Professionnelle',
    'Tel : +228 71 12 65 93',
    sep,
    '',
    'DATE         : ' + dateStr,
    'REFERENCE    : ' + ref,
    '',
    'ETUDIANT     : ' + u.prenom + ' ' + u.nom,
    'EMAIL        : ' + u.email,
    'TELEPHONE    : ' + u.tel,
    'NIVEAU       : ' + u.niveau,
    'ADRESSE      : ' + u.adresse,
    '',
    '---------------------------------------',
    "FRAIS D'INSCRIPTION",
    'MONTANT      : 10 000 F CFA',
    'VIA          : ' + method,
    'STATUT       : CONFIRME',
  ];

  if (u.payFormation) {
    const methodFormation = u.payFormationMethod === 'moov' ? 'MOOV MONEY' : 'YAS TOGO';
    lines.push('');
    lines.push('---------------------------------------');
    lines.push('FRAIS DE FORMATION');
    lines.push('MONTANT      : 100 000 F CFA');
    lines.push('REFERENCE    : ' + (u.payFormationRef || 'N/A'));
    lines.push('DATE         : ' + (u.payFormationDate || ''));
    lines.push('VIA          : ' + methodFormation);
    lines.push('STATUT       : CONFIRME');
    lines.push('');
    lines.push('---------------------------------------');
    lines.push('TOTAL PAYE   : 110 000 F CFA');
  }

  lines.push('---------------------------------------');
  lines.push('');
  lines.push('Merci pour votre confiance.');
  lines.push('Conservez ce document comme preuve de paiement.');
  lines.push('');
  lines.push('AICHOLA MEDIA - +228 71 12 65 93');
  lines.push(sep);

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Recu-AicholaMedia-' + ref + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥', 'Recu telecharge', 'Fichier enregistre sur votre appareil.');
}

function goToPayFormation() {
  // Afficher d'abord le choix du type de cours
  showPage('course-choice');
}

// ════ CHOIX TYPE DE COURS ════
let selectedCourseType = null;

function selectCourseType(type) {
  selectedCourseType = type;
  // Sauvegarder le choix dans le profil
  const users = getUsers();
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx > -1) { users[idx].courseType = type; saveUsers(users); currentUser = users[idx]; }
  // Aller payer la formation
  openPaymentPage('formation');
  document.getElementById('step-lbl-1').textContent = 'Inscription ✓';
  document.getElementById('step-lbl-2').textContent = 'Formation';
  document.getElementById('step-lbl-3').textContent = 'Accès complet';
}

// ════ PAGE COURS EN LIGNE ════
let onlineProgramme = [
  'Jour 1 : Introduction aux médias & outils de communication',
  'Jour 2 : Création de contenu (texte, image, vidéo)',
  'Jour 3 : Stratégie réseaux sociaux & community management',
  'Jour 4 : Marketing digital & publicité en ligne',
  'Jour 5 : Projet final & remise des attestations',
];

function showOnlinePage() {
  // Remplir le programme
  const list = document.getElementById('online-programme-list');
  if (list) {
    list.innerHTML = onlineProgramme.map((item, i) =>
      `<li style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:10px;">
        <span style="min-width:26px;height:26px;border-radius:50%;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;font-family:'Montserrat',sans-serif;font-weight:800;color:var(--gold);">${i+1}</span>
        <span style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;">${item}</span>
      </li>`
    ).join('');
  }
  renderOnlineModules();
  showPage('online');
}

// ════ PAGE COURS PRÉSENTIEL ════
// ⚙️ CONFIGUREZ ICI LA DATE ET LE LIEU DE LA FORMATION
const FORMATION_DATE = new Date('2026-09-01T08:00:00'); // ← Changez cette date
const FORMATION_LIEU = 'Lomé, Togo – Quartier Adidogomé';     // ← Changez le lieu
const FORMATION_SALLE = 'Salle de conférence AÏCHOLA MÉDIA';  // ← Changez la salle

let presentielTimer = null;

function showPresentielPage() {
  // Afficher lieu et salle
  const lieuEl = document.getElementById('presentiel-lieu');
  const salleEl = document.getElementById('presentiel-salle');
  const dateEl = document.getElementById('presentiel-date-display');
  if (lieuEl) lieuEl.textContent = FORMATION_LIEU;
  if (salleEl) salleEl.textContent = FORMATION_SALLE;
  if (dateEl) dateEl.textContent = 'Date de la formation : ' + FORMATION_DATE.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) + ' à 08h00';

  // Démarrer le countdown
  if (presentielTimer) clearInterval(presentielTimer);
  function tickPresentiel() {
    const now = Date.now();
    const target = FORMATION_DATE.getTime();
    const diff = Math.max(0, target - now);
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val).padStart(2,'0'); };
    set('cd-days', days); set('cd-hours', hours); set('cd-mins', mins); set('cd-secs', secs);
    // Couleur urgente si moins de 24h
    const grid = document.getElementById('presentiel-countdown-grid');
    if (grid) {
      const nums = grid.querySelectorAll('.countdown-num');
      nums.forEach(n => n.style.color = diff < 86400000 ? '#e74c3c' : 'var(--gold)');
    }
    if (diff <= 0) { clearInterval(presentielTimer); }
  }
  tickPresentiel();
  presentielTimer = setInterval(tickPresentiel, 1000);
  showPage('presentiel');
}

// ════ APRÈS PAIEMENT FORMATION ════
function afterFormationPayment() {
  // Rediriger vers la bonne page selon le choix du cours
  const type = selectedCourseType || (currentUser && currentUser.courseType);
  setTimeout(() => {
    if (type === 'online') { showOnlinePage(); }
    else if (type === 'presentiel') { showPresentielPage(); }
    else { loadStudentDash(currentUser); }
  }, 400);
}

// ════ TÉLÉCHARGER REÇU HTML MODERNE ════
function downloadReceiptFromDash() {
  const u = currentUser;
  if (!u) return;
  const ref    = u.payRef || 'N/A';
  const method = u.payMethod === 'moov' ? 'MOOV MONEY' : 'YAS TOGO';
  const methodColor = u.payMethod === 'moov' ? '#ffaa33' : '#4da6ff';
  const dateStr  = u.payDate || new Date().toLocaleDateString('fr-FR');
  const fullName = u.prenom + ' ' + u.nom;

  // Formation payment info
  const hasFormation = !!u.payFormation;
  const refFormation = u.payFormationRef || 'N/A';
  const methodFormation = u.payFormationMethod === 'moov' ? 'MOOV MONEY' : 'YAS TOGO';
  const methodFormationColor = u.payFormationMethod === 'moov' ? '#ffaa33' : '#4da6ff';
  const dateFormation = u.payFormationDate || '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reçu – ${fullName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0a0a0f; font-family:'Montserrat',sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:30px 20px; }
  .receipt { width:100%; max-width:520px; background:#0d0d1a; border-radius:24px; overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,0.7); position:relative; }
  .receipt::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#b8860b,#f5e17a,#d4af37,#b8860b); }
  .header { background:linear-gradient(135deg,#0d0d1a 0%,#111128 100%); padding:40px 36px 30px; text-align:center; border-bottom:1px solid rgba(212,175,55,0.15); }
  .logo-circle { width:70px; height:70px; border-radius:50%; background:linear-gradient(135deg,#b8860b,#f5e17a); display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 16px; box-shadow:0 8px 30px rgba(212,175,55,0.3); }
  .brand { font-family:'Playfair Display',serif; font-size:26px; font-weight:900; color:#d4af37; letter-spacing:1px; }
  .brand-sub { font-size:10px; color:rgba(255,255,255,0.4); letter-spacing:3px; text-transform:uppercase; margin-top:5px; }
  .confirmed-badge { display:inline-flex; align-items:center; gap:8px; margin-top:20px; padding:8px 20px; background:rgba(46,204,113,0.12); border:1px solid rgba(46,204,113,0.35); border-radius:20px; }
  .confirmed-dot { width:8px; height:8px; border-radius:50%; background:#2ecc71; box-shadow:0 0 8px #2ecc71; animation:pulse 2s infinite; }
  .confirmed-txt { font-size:11px; font-weight:700; color:#2ecc71; letter-spacing:2px; text-transform:uppercase; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .body { padding:32px 36px; }
  .receipt-title { text-align:center; margin-bottom:28px; }
  .receipt-title h2 { font-family:'Playfair Display',serif; font-size:22px; color:white; font-weight:700; }
  .receipt-title p { font-size:11px; color:rgba(255,255,255,0.35); margin-top:5px; letter-spacing:1px; }
  .meta-row { display:flex; justify-content:space-between; align-items:center; background:rgba(212,175,55,0.06); border:1px solid rgba(212,175,55,0.12); border-radius:12px; padding:14px 18px; margin-bottom:24px; }
  .meta-item label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(212,175,55,0.5); display:block; margin-bottom:5px; }
  .meta-item span { font-size:14px; font-weight:800; color:#d4af37; letter-spacing:1px; }
  .meta-item.right { text-align:right; }
  .meta-item.right span { font-size:12px; color:rgba(255,255,255,0.6); font-weight:600; }
  .section-title { font-size:9px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(212,175,55,0.5); margin-bottom:12px; padding-left:4px; }
  .student-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:20px; margin-bottom:20px; }
  .student-name { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; color:white; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.07); }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .info-item label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.3); display:block; margin-bottom:4px; }
  .info-item span { font-size:12px; color:rgba(255,255,255,0.75); font-weight:600; }
  .amount-card { background:linear-gradient(135deg,rgba(212,175,55,0.08),rgba(212,175,55,0.15)); border:1px solid rgba(212,175,55,0.25); border-radius:14px; padding:20px 24px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; }
  .amount-left label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(212,175,55,0.6); display:block; margin-bottom:6px; }
  .amount-left .type { font-size:12px; color:rgba(255,255,255,0.55); margin-top:5px; }
  .amount-left .ref-small { font-size:9px; color:rgba(255,255,255,0.3); margin-top:4px; letter-spacing:0.5px; }
  .amount-val { font-family:'Montserrat',sans-serif; font-size:36px; font-weight:800; color:#d4af37; letter-spacing:-1px; }
  .amount-unit { font-size:14px; font-weight:600; color:rgba(212,175,55,0.6); margin-left:4px; }
  .total-card { background:linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.22)); border:2px solid rgba(212,175,55,0.4); border-radius:14px; padding:16px 24px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; }
  .total-lbl { font-size:11px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(212,175,55,0.8); }
  .total-val { font-family:'Montserrat',sans-serif; font-size:28px; font-weight:800; color:#d4af37; }
  .total-unit { font-size:13px; font-weight:600; color:rgba(212,175,55,0.6); margin-left:4px; }
  .method-row { display:flex; align-items:center; gap:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px 18px; margin-bottom:20px; }
  .method-icon { width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:20px; }
  .method-label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:4px; }
  .method-name { font-size:13px; font-weight:800; color:${methodColor}; letter-spacing:1px; }
  .status-row { display:flex; align-items:center; justify-content:space-between; background:rgba(46,204,113,0.06); border:1px solid rgba(46,204,113,0.2); border-radius:12px; padding:14px 18px; margin-bottom:28px; }
  .status-lbl { font-size:11px; color:rgba(255,255,255,0.4); }
  .status-val { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:800; color:#2ecc71; letter-spacing:1px; }
  .footer { border-top:1px solid rgba(212,175,55,0.1); padding:20px 36px; background:rgba(0,0,0,0.2); text-align:center; }
  .footer p { font-size:11px; color:rgba(255,255,255,0.3); line-height:1.7; }
  .footer strong { color:rgba(212,175,55,0.6); }
  .print-btn { display:inline-block; margin-top:16px; padding:10px 24px; background:rgba(212,175,55,0.1); border:1px solid rgba(212,175,55,0.3); border-radius:8px; color:#d4af37; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; cursor:pointer; text-transform:uppercase; }
  @media print { body{background:white;} .receipt{box-shadow:none;} .print-btn{display:none;} }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="logo-circle">🎓</div>
    <div class="brand">AÏCHOLA MÉDIA</div>
    <div class="brand-sub">Centre de Formation Professionnelle</div>
    <div class="confirmed-badge">
      <div class="confirmed-dot"></div>
      <span class="confirmed-txt">Paiement Confirmé</span>
    </div>
  </div>
  <div class="body">
    <div class="receipt-title">
      <h2>Reçu de Paiement Officiel</h2>
      <p>Conservez ce document comme preuve de paiement</p>
    </div>
    <div class="meta-row">
      <div class="meta-item">
        <label>Référence</label>
        <span>${ref}</span>
      </div>
      <div class="meta-item right">
        <label>Date</label>
        <span>${dateStr}</span>
      </div>
    </div>
    <div class="section-title">Informations de l'étudiant</div>
    <div class="student-card">
      <div class="student-name">👤 ${fullName}</div>
      <div class="info-grid">
        <div class="info-item"><label>Email</label><span>${u.email}</span></div>
        <div class="info-item"><label>Téléphone</label><span>${u.tel}</span></div>
        <div class="info-item"><label>Niveau</label><span>${u.niveau}</span></div>
        <div class="info-item"><label>Adresse</label><span>${u.adresse}</span></div>
      </div>
    </div>
    <div class="section-title">Détail du paiement</div>
    <div class="amount-card">
      <div class="amount-left">
        <label>Montant payé</label>
        <div class="type">Frais d'inscription</div>
        <div class="ref-small">Réf : ${ref} · ${dateStr}</div>
      </div>
      <div>
        <span class="amount-val">10 000</span>
        <span class="amount-unit">F CFA</span>
      </div>
    </div>
    ${hasFormation ? `
    <div class="amount-card" style="background:linear-gradient(135deg,rgba(77,166,255,0.08),rgba(77,166,255,0.15));border-color:rgba(77,166,255,0.25);">
      <div class="amount-left">
        <label style="color:rgba(77,166,255,0.7);">Montant payé</label>
        <div class="type">Frais de formation</div>
        <div class="ref-small">Réf : ${refFormation} · ${dateFormation}</div>
      </div>
      <div>
        <span class="amount-val" style="color:#4da6ff;">100 000</span>
        <span class="amount-unit" style="color:rgba(77,166,255,0.6);">F CFA</span>
      </div>
    </div>
    <div class="total-card">
      <span class="total-lbl">TOTAL PAYÉ</span>
      <span class="total-val">110 000 <span class="total-unit">F CFA</span></span>
    </div>
    ` : ''}
    <div class="method-row">
      <div class="method-icon">${u.payMethod === 'moov' ? '💳' : '📱'}</div>
      <div>
        <div class="method-label">Mode de paiement · Inscription</div>
        <div class="method-name">${method}</div>
      </div>
    </div>
    ${hasFormation ? `
    <div class="method-row" style="border-color:rgba(77,166,255,0.15);">
      <div class="method-icon">${u.payFormationMethod === 'moov' ? '💳' : '📱'}</div>
      <div>
        <div class="method-label">Mode de paiement · Formation</div>
        <div class="method-name" style="color:${methodFormationColor};">${methodFormation}</div>
      </div>
    </div>
    ` : ''}
    <div class="status-row">
      <span class="status-lbl">Statut du paiement</span>
      <span class="status-val">✓ VALIDÉ PAR L'ADMINISTRATEUR</span>
    </div>
  </div>
  <div class="footer">
    <p>Merci pour votre confiance, <strong>${u.prenom}</strong> !<br>
    Pour toute question : <strong>+228 71 12 65 93</strong> (WhatsApp / Appel)<br>
    <strong>AÏCHOLA MÉDIA</strong> – Centre de Formation Professionnelle</p>
    <button class="print-btn" onclick="window.print()">🖨 IMPRIMER CE REÇU</button>
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'Recu-' + fullName.replace(' ', '-') + '-AicholaMedia.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥', 'Reçu téléchargé !', 'Ouvrez le fichier dans votre navigateur pour l\'imprimer.');
}

// ════════════════ PAGE ATTENTE ACTIVATION ════════════════
let waitingTimer = null;

function showWaitingPage(user) {
  document.getElementById('waiting-name').textContent = user.prenom + ' ' + user.nom;
  document.getElementById('waiting-email').textContent = user.email;
  // Afficher la référence du bon paiement (inscription ou formation)
  const ref = (payContext.type === 'formation')
    ? (user.payFormationRef || user.payRef || '—')
    : (user.payRef || '—');
  document.getElementById('waiting-ref').textContent = ref;
  updateWhatsAppLinks(user, ref);
  showPage('waiting');
  startWaitingCountdown(user);
}

function startWaitingCountdown(user) {
  if (waitingTimer) clearInterval(waitingTimer);

  const isFormation = payContext.type === 'formation';
  const tsKey = isFormation ? 'payFormationTimestamp' : 'payTimestamp';

  // Récupérer le timestamp depuis la base (données fraîches)
  const users = getUsers();
  const fresh = users.find(u => u.id === user.id);
  let payTimestamp = (fresh && fresh[tsKey]) ? fresh[tsKey] : Date.now();

  // Sauvegarder le timestamp s'il n'existe pas encore
  if (fresh && !fresh[tsKey]) {
    const idx = users.findIndex(u => u.id === user.id);
    users[idx][tsKey] = Date.now();
    payTimestamp = users[idx][tsKey];
    saveUsers(users);
  }

  const DURATION = 24 * 60 * 60 * 1000; // 24h en ms

  function tick() {
    const elapsed = Date.now() - payTimestamp;
    const remaining = Math.max(0, DURATION - elapsed);
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    const el = document.getElementById('waiting-countdown');
    if (el) {
      el.textContent =
        String(h).padStart(2,'0') + ':' +
        String(m).padStart(2,'0') + ':' +
        String(s).padStart(2,'0');
      // Changer couleur quand il reste moins d'1h
      el.style.color = remaining < 3600000 ? '#e74c3c' : 'var(--gold)';
    }
    if (remaining <= 0) clearInterval(waitingTimer);
  }

  tick();
  waitingTimer = setInterval(tick, 1000);
}

function checkActivationStatus() {
  if (!currentUser) return;
  const users = getUsers();
  const fresh = users.find(u => u.id === currentUser.id);
  if (!fresh) return;
  currentUser = fresh;

  // Si la formation a été payée, l'attente concerne l'activation de la FORMATION
  // (l'inscription est forcément déjà activée à ce stade, donc on ne doit pas
  // retomber sur le message d'inscription)
  if (fresh.payFormation) {
    if (fresh.formationActivated) {
      showToast('🎓', 'Accès formation accordé !', 'Vous pouvez maintenant accéder à votre formation.');
      setTimeout(() => loadStudentDash(fresh), 600);
    } else {
      showToast('⏳', 'Pas encore activé', 'Votre accès à la formation est en attente de validation.');
    }
    return;
  }
  // Vérifier inscription activée
  if (fresh.activated) {
    showToast('🎉', 'Accès activé !', 'Bienvenue dans votre espace étudiant !');
    setTimeout(() => loadStudentDash(fresh), 600);
  } else {
    showToast('⏳', 'Pas encore activé', 'Votre compte est en attente de validation.');
  }
}

function openWhatsApp() {
  const ref = currentUser ? (currentUser.payRef || '—') : '—';
  const name = currentUser ? currentUser.prenom + ' ' + currentUser.nom : '';
  const method = selectedMethod === 'moov' ? 'MOOV MONEY' : 'YAS TOGO';
  const amt = payContext.amount === 100000 ? '100 000 F' : '10 000 F';
  const msg = encodeURIComponent(
    `✅ Preuve de paiement – AÏCHOLA MÉDIA\n\n` +
    `👤 Étudiant : ${name}\n` +
    `📧 Email : ${currentUser ? currentUser.email : ''}\n` +
    `💰 Montant : ${amt}\n` +
    `📱 Via : ${method}\n` +
    `🔖 Référence : ${ref}\n\n` +
    `📸 Ci-joint ma capture d'écran de confirmation.`
  );
  window.open(`https://wa.me/22871126593?text=${msg}`, '_blank');
  return false;
}

function updateWhatsAppLinks(user, ref) {
  const name = user ? user.prenom + ' ' + user.nom : '';
  const method = selectedMethod === 'moov' ? 'MOOV MONEY' : 'YAS TOGO';
  const amt = payContext.amount === 100000 ? '100 000 F' : '10 000 F';
  const msg = encodeURIComponent(
    `✅ Preuve de paiement – AÏCHOLA MÉDIA\n\n` +
    `👤 Étudiant : ${name}\n📧 Email : ${user ? user.email : ''}\n` +
    `💰 Montant : ${amt}\n📱 Via : ${method}\n🔖 Référence : ${ref}\n\n` +
    `📸 Ci-joint ma capture d'écran de confirmation.`
  );
  const waUrl = `https://wa.me/22871126593?text=${msg}`;
  ['whatsapp-btn-yas','whatsapp-btn-moov','whatsapp-pending-btn','whatsapp-waiting-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = waUrl;
  });
}

function updateUssdCodes() {
  const amt = payContext.amount;
  const merchantRaw = MERCHANT_TEL.replace(/\s/g, '');
  const yasEl = document.getElementById('yas-ussd-display');
  const moovEl = document.getElementById('moov-ussd-display');
  if (yasEl) yasEl.textContent = `*145*1*${amt}*${merchantRaw}*CodeSecret#`;
  if (moovEl) moovEl.textContent = `*155*1*1*${merchantRaw}*${amt}*CodeSecret#`;
  // Mettre à jour step 3 textes
  const amtStr = amt === 10000 ? '10 000 F' : '100 000 F';
  const s3 = document.getElementById('t-yas-step3');
  if (s3) s3.innerHTML = `Bénéficiaire : <strong>${MERCHANT_TEL}</strong> · Montant : <strong>${amtStr}</strong>`;
  const s3m = document.getElementById('t-moov-step3');
  if (s3m) s3m.innerHTML = `Bénéficiaire : <strong>${MERCHANT_TEL}</strong> · Montant : <strong>${amtStr}</strong>`;
}

// ════════════════ ADMIN : ACTIVER / DÉSACTIVER ════════════════
function setActivation(userId, activate, type = 'inscription') {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;
  if (type === 'formation') {
    users[idx].formationActivated = activate;
  } else {
    users[idx].activated = activate;
  }
  saveUsers(users);
  renderTable(document.getElementById('admin-search').value);
  updateStats();
  const name = users[idx].prenom + ' ' + users[idx].nom;
  const label = type === 'formation' ? 'Formation' : 'Inscription';
  if (activate) {
    showToast('✅', name, label + ' — accès accordé');
  } else {
    showToast('🔒', name, label + ' — accès retiré');
  }
}

// ════════════════ DASHBOARDS ════════════════
function loadStudentDash(user) {
  document.getElementById('t-welcome-name').textContent =
    (lang === 'fr' ? 'Bienvenue, ' : 'Welcome, ') + user.prenom + ' ' + user.nom + ' !';
  const img = document.getElementById('student-avatar');
  const emoji = document.getElementById('student-avatar-emoji');
  if (user.photo) { img.src = user.photo; img.style.display = 'block'; emoji.style.display = 'none'; }
  else { img.style.display = 'none'; emoji.style.display = 'block'; }
  document.getElementById('d-email').textContent = user.email;
  document.getElementById('d-tel').textContent = user.tel;
  document.getElementById('d-adresse').textContent = user.adresse;
  document.getElementById('d-niveau').textContent = user.niveau;
  renderObjectives();
  updatePaymentCardStatus();
  applyTranslations();
  showPage('student');
}

function updatePaymentCardStatus() {
  if (!currentUser || currentUser.role === 'admin') return;
  const inscCard   = document.getElementById('card-inscription-status');
  if (!inscCard) return;
  const formCard   = document.getElementById('card-formation-status');
  const inscTxt    = document.getElementById('inscription-status-txt');
  const formTxt    = document.getElementById('formation-status-txt');
  const btnForm    = document.getElementById('btn-pay-formation-dash');
  const btnReceipt = document.getElementById('btn-download-receipt-dash');

  if (currentUser.activated) {
    inscCard.className = 'price-item paid';
    inscTxt.textContent = '✓ Validé';
    // Afficher le bouton télécharger reçu
    if (btnReceipt) btnReceipt.classList.remove('hidden');
  } else if (currentUser.payInscription) {
    inscCard.className = 'price-item unpaid';
    inscTxt.textContent = '⏳ En attente';
    if (btnReceipt) btnReceipt.classList.add('hidden');
  } else {
    inscCard.className = 'price-item unpaid';
    inscTxt.textContent = t('pay-non-inscrit');
    if (btnReceipt) btnReceipt.classList.add('hidden');
  }

  if (currentUser.formationActivated) {
    formCard.className = 'price-item paid';
    formTxt.textContent = '✓ Activé';
    if (btnForm) btnForm.classList.add('hidden');
    addCourseAccessButton();
  } else if (currentUser.payFormation) {
    formCard.className = 'price-item unpaid';
    formTxt.textContent = '⏳ En attente d\'activation';
    if (btnForm) btnForm.classList.add('hidden');
    removeCourseAccessButton();
  } else {
    formCard.className = 'price-item unpaid';
    formTxt.textContent = t('pay-formation-pending');
    if (currentUser.activated) {
      if (btnForm) btnForm.classList.remove('hidden');
    } else {
      if (btnForm) btnForm.classList.add('hidden');
    }
    removeCourseAccessButton();
  }
}

function addCourseAccessButton() {
  const existing = document.getElementById('btn-course-access');
  if (existing) return; // déjà présent
  const btnForm = document.getElementById('btn-pay-formation-dash');
  if (!btnForm) return;
  const btn = document.createElement('button');
  btn.id = 'btn-course-access';
  btn.style.cssText = 'width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,rgba(77,166,255,0.15),rgba(77,166,255,0.3));color:#4da6ff;font-family:Montserrat,sans-serif;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border:1px solid rgba(77,166,255,0.3);margin-top:12px;transition:all 0.3s;';
  btn.textContent = '🎓 ACCÉDER À MA FORMATION';
  btn.onclick = () => {
    // Sécurité : on revérifie depuis le stockage que l'accès est toujours activé
    const fresh = getUsers().find(u => u.id === currentUser.id);
    if (!fresh || !fresh.formationActivated) {
      showToast('🔒', 'Accès non disponible', 'Votre accès à la formation n\'est pas (ou plus) activé.');
      updatePaymentCardStatus();
      return;
    }
    const type = fresh.courseType;
    if (type === 'online') showOnlinePage();
    else if (type === 'presentiel') showPresentielPage();
    else showPage('course-choice');
  };
  btnForm.parentNode.insertBefore(btn, btnForm.nextSibling);
}

function removeCourseAccessButton() {
  const existing = document.getElementById('btn-course-access');
  if (existing) existing.remove();
}

function renderObjectives() {
  const list = document.getElementById('obj-list-student');
  if (!list) return;
  const objs = t('objectives');
  list.innerHTML = objs.map((o, i) =>
    `<li><div class="obj-num-dash">${String(i+1).padStart(2,'0')}</div>${o}</li>`
  ).join('');
}

function loadAdminDash() {
  updateStats();
  renderTable();
  renderModulesAdmin();
  applyTranslations();
  showPage('admin');
}

function updateStats() {
  const users = getUsers();
  document.getElementById('stat-total').textContent = users.length;
  const today = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB');
  document.getElementById('stat-today').textContent = users.filter(u => u.date === today).length;
  // "Payé" = seulement ceux que l'admin a activés
  document.getElementById('stat-paid').textContent = users.filter(u => u.activated).length;
  // "En attente" = paiement envoyé mais pas encore activé
  const pendingEl = document.getElementById('stat-pending-activation');
  if (pendingEl) pendingEl.textContent = users.filter(u => u.payInscription && !u.activated).length;
}

function renderTable(filter = '') {
  const users = getUsers().filter(u =>
    !filter ||
    (u.prenom + ' ' + u.nom).toLowerCase().includes(filter.toLowerCase()) ||
    u.email.toLowerCase().includes(filter.toLowerCase()) ||
    u.tel.includes(filter) ||
    (u.niveau || '').toLowerCase().includes(filter.toLowerCase())
  );
  const tbody = document.getElementById('students-tbody');
  const empty = document.getElementById('empty-table');
  const table = document.getElementById('students-table');
  if (users.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    table.style.display = 'none';
  } else {
    empty.classList.add('hidden');
    table.style.display = '';
    tbody.innerHTML = users.map(u => {
      // Le badge "Inscription" affiche "Payé" SEULEMENT si activé par l'admin
      const inscBadge = u.activated
        ? `<span class="badge-pay paid" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.3);">✅ Payé</span>`
        : u.payInscription
          ? `<span class="badge-pay unpaid" style="background:rgba(255,170,0,0.12);color:#ffaa00;border:1px solid rgba(255,170,0,0.3);">⏳ En attente</span>`
          : `<span class="badge-pay unpaid" style="background:rgba(231,76,60,0.12);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);">❌ Non payé</span>`;

      const formBadge = u.formationActivated
        ? `<span class="badge-pay paid" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.3);">✅ Activé</span>`
        : u.payFormation
          ? `<span class="badge-pay unpaid" style="background:rgba(255,170,0,0.12);color:#ffaa00;border:1px solid rgba(255,170,0,0.3);">⏳ En attente</span>`
          : `<span class="badge-pay unpaid" style="background:rgba(231,76,60,0.12);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);">❌ Non payé</span>`;

      // Boutons activation formation
      const canManageForm = u.payFormation;
      const activateFormBtn = canManageForm
        ? `<button onclick="setActivation(${u.id}, true, 'formation')" style="display:block;width:100%;margin-bottom:4px;padding:5px 0;border:none;border-radius:7px;cursor:pointer;font-size:10px;font-weight:800;font-family:'Montserrat',sans-serif;background:${u.formationActivated?'rgba(46,204,113,0.08)':'rgba(46,204,113,0.2)'};color:#2ecc71;border:1px solid rgba(46,204,113,0.4);opacity:${u.formationActivated?'0.4':'1'};" ${u.formationActivated?'disabled':''}>✅ ACTIVER</button>`
        : `<span style="font-size:10px;color:rgba(255,255,255,0.2);">—</span>`;
      const deactivateFormBtn = canManageForm
        ? `<button onclick="setActivation(${u.id}, false, 'formation')" style="display:block;width:100%;padding:5px 0;border:none;border-radius:7px;cursor:pointer;font-size:10px;font-weight:800;font-family:'Montserrat',sans-serif;background:${!u.formationActivated?'rgba(231,76,60,0.08)':'rgba(231,76,60,0.2)'};color:#e74c3c;border:1px solid rgba(231,76,60,0.4);opacity:${!u.formationActivated?'0.4':'1'};" ${!u.formationActivated?'disabled':''}>🔒 DÉSACT.</button>`
        : '';

      // Boutons Activer ET Désactiver séparément (toujours visibles si paiement envoyé)
      const canManage = u.payInscription;
      const activateBtn = canManage
        ? `<button onclick="setActivation(${u.id}, true)" style="
              display:block; width:100%; margin-bottom:5px; padding:6px 0; border:none; border-radius:7px; cursor:pointer;
              font-size:10px; font-weight:800; font-family:'Montserrat',sans-serif; letter-spacing:0.5px;
              background:${u.activated ? 'rgba(46,204,113,0.08)' : 'rgba(46,204,113,0.2)'};
              color:#2ecc71; border:1px solid rgba(46,204,113,0.4);
              opacity:${u.activated ? '0.45' : '1'}; transition:all 0.2s;"
              ${u.activated ? 'disabled title="Déjà activé"' : ''}>
              ✅ ACTIVER
            </button>`
        : '';
      const deactivateBtn = canManage
        ? `<button onclick="setActivation(${u.id}, false)" style="
              display:block; width:100%; margin-bottom:5px; padding:6px 0; border:none; border-radius:7px; cursor:pointer;
              font-size:10px; font-weight:800; font-family:'Montserrat',sans-serif; letter-spacing:0.5px;
              background:${!u.activated ? 'rgba(231,76,60,0.08)' : 'rgba(231,76,60,0.2)'};
              color:#e74c3c; border:1px solid rgba(231,76,60,0.4);
              opacity:${!u.activated ? '0.45' : '1'}; transition:all 0.2s;"
              ${!u.activated ? 'disabled title="Déjà désactivé"' : ''}>
              🔒 DÉSACTIVER
            </button>`
        : `<span style="font-size:10px;color:rgba(255,255,255,0.25);">—</span>`;

      const deleteBtn = `<button onclick="deleteStudent(${u.id})" style="
              display:block; width:100%; padding:6px 0; border:none; border-radius:7px; cursor:pointer;
              font-size:10px; font-weight:800; font-family:'Montserrat',sans-serif; letter-spacing:0.5px;
              background:rgba(150,30,30,0.2); color:#ff6b6b; border:1px solid rgba(255,107,107,0.3);
              transition:all 0.2s;" onmouseover="this.style.background='rgba(231,76,60,0.35)'" onmouseout="this.style.background='rgba(150,30,30,0.2)'">
              🗑 SUPPRIMER
            </button>`;

      return `
      <tr>
        <td><div class="td-avatar">${u.photo ? `<img src="${u.photo}" alt="">` : '🎓'}</div></td>
        <td><div class="td-name">${u.prenom} ${u.nom}</div></td>
        <td><div class="td-muted">${u.email}</div></td>
        <td>${u.tel}</td>
        <td><span class="badge-niveau">${u.niveau}</span></td>
        <td><div class="td-muted">${u.adresse}</div></td>
        <td style="text-align:center;">${inscBadge}</td>
        <td style="min-width:100px;">${activateBtn}${deactivateBtn}</td>
        <td style="text-align:center;">${formBadge}</td>
        <td style="min-width:100px;">${activateFormBtn}${deactivateFormBtn}</td>
        <td><div class="td-muted">${u.date}</div></td>
        <td style="min-width:110px;">${deleteBtn}</td>
      </tr>`;
    }).join('');
  }
  updateStats();
}

function filterTable() { renderTable(document.getElementById('admin-search').value); }

function deleteStudent(id) {
  const msg = lang === 'fr' ? 'Supprimer cet étudiant ?' : 'Delete this student?';
  if (!confirm(msg)) return;
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
  renderTable(document.getElementById('admin-search').value);
}

// ════════════════ PHOTO ════════════════
function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    preview.src = ev.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ════════════════ TOAST ════════════════
let toastTimer;
function showToast(icon, title, msg) {
  const el = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-msg').textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function showError(el, msg) { el.textContent = msg; el.classList.add('show'); }

// ════════════════ INIT ════════════════
// ════════════════ INIT ════════════════
window.addEventListener('load', () => {
  // Cache le loading dès que Firestore a répondu (ou après 5s max en filet de sécurité,
  // par ex. si la connexion internet est lente/coupée)
  function hideLoading() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.classList.add('hide');
    setTimeout(() => { try { el.parentNode.removeChild(el); } catch(e){} }, 600);
  }
  (function waitForData() {
    if (firestoreReady) { setTimeout(hideLoading, 400); return; }
    setTimeout(waitForData, 150);
  })();
  setTimeout(hideLoading, 5000); // filet de sécurité si pas de connexion internet

  // Onglet admin visible seulement si URL contient ?admin
  try {
    const adminTab = document.getElementById('tab-admin');
    if (adminTab) {
      const showAdmin = window.location.search.includes('admin') || window.location.hash.includes('admin');
      adminTab.style.display = showAdmin ? 'block' : 'none';
    }
  } catch(e) {}

  // Afficher la page login
  try { showPage('login'); } catch(e) { console.error(e); }
  try { applyTranslations(); } catch(e) { console.error(e); }

  // Initialiser le lien du groupe WhatsApp formation en ligne
  try {
    const groupLink = document.getElementById('whatsapp-group-link');
    if (groupLink) groupLink.href = WHATSAPP_GROUP_LINK;
  } catch(e) {}
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.page.active');
  if (!active) return;
  if (active.id === 'page-login') doLogin();
  if (active.id === 'page-register') doRegister();
});
