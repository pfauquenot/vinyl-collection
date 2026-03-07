// === Data — Valeurs exactes ===
const GOUT_LABELS = {
    '0': 'Déteste – Achat raté',
    '1': 'Tolère – peu de plaisir',
    '2': 'Apprécie – mais pas souvent',
    '3': 'Aime – plaisir occasionnel',
    '4': 'Aime – sympa régulièrement',
    '5': 'Adore – vraiment excellent',
    '6': 'Vibre – frissons, jamais lassé'
};

const AUDIO_LABELS = {
    '3': 'Moyen, limité',
    '4': 'Correct',
    '5': 'Bon équilibre',
    '6': 'Très bon rendu',
    '7': 'Excellent détail',
    '8': 'Superbe immersion',
    '9': 'Profond & détaillé',
    '10': 'Exceptionnel'
};

const ENERGIE_LABELS = {
    '1': 'Très doux / Introspectif',
    '2': 'Doux / Ambiance',
    '3': 'Modéré / Groovy',
    '4': 'Énergique / Dansant',
    '5': 'Intense / Expressif',
    '6': 'Très énervé / Explosif'
};

const ADMIN_EMAIL = 'pfauquenot@infortive.com';

// === Anthropic API ===
let cachedAnthropicApiKey = '';

async function loadAnthropicApiKey() {
    try {
        const doc = await db.collection('config').doc('anthropic').get();
        if (doc.exists && doc.data().apiKey) {
            cachedAnthropicApiKey = doc.data().apiKey;
        }
    } catch (err) {
        console.warn('Impossible de charger la clé API Anthropic:', err);
    }
}

function getAnthropicApiKey() {
    return cachedAnthropicApiKey;
}

let cachedIaPrompt = '';

async function loadIaPrompt() {
    try {
        const doc = await db.collection('config').doc('iaPrompt').get();
        if (doc.exists && doc.data().prompt) {
            cachedIaPrompt = doc.data().prompt;
        }
    } catch (err) {
        console.warn('Impossible de charger le prompt IA:', err);
    }
}

function getIaPrompt() {
    return cachedIaPrompt || IA_SYSTEM_PROMPT;
}

// === Firebase Config ===
const firebaseConfig = {
    apiKey: "AIzaSyBGOJmv2W9Pu1UjNPMvMaL2WfFa60U8G3E",
    authDomain: "vinyl-pfa.firebaseapp.com",
    projectId: "vinyl-pfa",
    storageBucket: "vinyl-pfa.firebasestorage.app",
    messagingSenderId: "701701275101",
    appId: "1:701701275101:web:554f07a45e05663e1b8a34"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence: multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence not available');
        }
    });

let currentUser = null;
let currentUserRole = 'user'; // 'admin', 'user', 'guest'
let discogsToken = '';
let vinyls = [];
let editingId = null;
let sortAsc = true;
let currentSort = 'artiste';
let selectedIds = new Set();
let unsubscribeVinyls = null;
let formGenres = []; // genre array for the current form
let filtersRestored = false;

// === DOM refs ===
const loginScreen = document.getElementById('loginScreen');
const appEl = document.getElementById('app');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfoEl = document.getElementById('userInfo');
const roleBadge = document.getElementById('roleBadge');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addBtn');
const vinylBody = document.getElementById('vinylBody');
const vinylTable = document.getElementById('vinylTable');
const emptyState = document.getElementById('emptyState');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const vinylForm = document.getElementById('vinylForm');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statsEl = document.getElementById('stats');
const filterCategorie = document.getElementById('filterCategorie');
const filterGenre = document.getElementById('filterGenre');
const filterGoût = document.getElementById('filterGoût');
const filterEnergie = document.getElementById('filterEnergie');
const filterClassé = document.getElementById('filterClassé');
const filterLabel = document.getElementById('filterLabel');
const resetFiltersBtn = document.getElementById('resetFilters');
const sortBySelect = document.getElementById('sortBy');
const sortDirBtn = document.getElementById('sortDir');
const csvInput = document.getElementById('csvInput');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const selectAllCb = document.getElementById('selectAll');
const coverZone = document.getElementById('coverZone');
const coverImg = document.getElementById('coverImg');
const coverPlaceholder = document.getElementById('coverPlaceholder');
const coverUrlInput = document.getElementById('coverUrl');
const galleryView = document.getElementById('galleryView');
const tableView = document.getElementById('tableView');
const viewTableBtn = document.getElementById('viewTable');
const viewGalleryBtn = document.getElementById('viewGallery');
const view3DBtn = document.getElementById('view3D');
const graph3dView = document.getElementById('graph3dView');
let currentView = 'gallery';
const coverSearchBtn = document.getElementById('coverSearchBtn');
const bulkDiscogsBtn = document.getElementById('bulkDiscogsBtn');
const discogsSearchBtn = document.getElementById('discogsSearchBtn');
const discogsUrlBtn = document.getElementById('discogsUrlBtn');
const discogsResults = document.getElementById('discogsResults');
const genreInput = document.getElementById('genreInput');
const genreTags = document.getElementById('genreTags');
const discogsUrlInput = document.getElementById('discogsUrl');
const discogsLink = document.getElementById('discogsLink');
const adminUsersBtn = document.getElementById('adminUsersBtn');
const clearDbBtn = document.getElementById('clearDbBtn');
const adminModal = document.getElementById('adminModal');
const adminModalClose = document.getElementById('adminModalClose');
const adminUsersList = document.getElementById('adminUsersList');
const tokenModal = document.getElementById('tokenModal');
const tokenModalClose = document.getElementById('tokenModalClose');
const tokenSaveBtn = document.getElementById('tokenSaveBtn');
const tokenCancelBtn = document.getElementById('tokenCancelBtn');
const discogsTokenInput = document.getElementById('discogsTokenInput');

// === Helpers ===
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const safeInt = s => { const n = parseInt(s); return isNaN(n) ? -1 : n; };

// === Auth ===
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    // If user previously enabled Drive backup, request scope to get fresh token
    try { if (localStorage.getItem('driveBackupEnabled') === 'true') provider.addScope('https://www.googleapis.com/auth/drive.file'); } catch (e) {}
    auth.signInWithPopup(provider)
        .then(result => {
            if (result.credential && result.credential.accessToken) {
                storeGoogleToken(result.credential.accessToken);
            }
        })
        .catch(err => {
            console.error('Login failed:', err);
            alert('Erreur de connexion: ' + err.message);
        });
}

function signOut() {
    auth.signOut();
}

function updateUserDisplay(user) {
    if (userInfoEl) {
        const photoHtml = user.photoURL
            ? `<img src="${user.photoURL}" alt="" class="user-avatar">`
            : `<span class="user-avatar-placeholder">${(user.displayName || user.email || '?')[0]}</span>`;
        userInfoEl.innerHTML = `${photoHtml} <span class="user-name">${esc(user.displayName || user.email)}</span>`;
    }
}

function updateRoleBadge() {
    if (currentUserRole === 'admin') {
        roleBadge.textContent = 'Admin';
        roleBadge.className = 'role-badge role-admin';
    } else if (currentUserRole === 'guest') {
        roleBadge.textContent = 'Invité';
        roleBadge.className = 'role-badge role-guest';
    } else {
        roleBadge.textContent = '';
        roleBadge.className = 'role-badge hidden';
    }
}

function applyRoleUI() {
    updateRoleBadge();

    // Guest: hide all write actions
    document.querySelectorAll('.guest-hidden').forEach(el => {
        if (currentUserRole === 'guest') {
            el.classList.add('hidden');
        } else {
            // Don't unhide bulkDeleteBtn unless there are selections
            if (el.id === 'bulkDeleteBtn' && selectedIds.size === 0) return;
            el.classList.remove('hidden');
        }
    });

    // Admin-only buttons
    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUserRole === 'admin') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

loginBtn.addEventListener('click', signInWithGoogle);
logoutBtn.addEventListener('click', signOut);

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appEl.classList.remove('hidden');

        // Determine role
        const isAdminUser = user.email === ADMIN_EMAIL;

        // Update user profile in Firestore
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            const data = userDoc.data();
            currentUserRole = data.role || (isAdminUser ? 'admin' : 'user');
            discogsToken = data.discogsToken || '';

            // Ensure admin email always has admin role
            if (isAdminUser && currentUserRole !== 'admin') {
                currentUserRole = 'admin';
            }

            // Always write role to ensure Firestore rules work
            await userDocRef.set({
                displayName: user.displayName || '',
                email: user.email || '',
                role: currentUserRole,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } else {
            // First login
            currentUserRole = isAdminUser ? 'admin' : 'user';
            await userDocRef.set({
                displayName: user.displayName || '',
                email: user.email || '',
                role: currentUserRole,
                discogsToken: '',
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        updateUserDisplay(user);
        applyRoleUI();
        subscribeToVinyls();
        await loadAnthropicApiKey();
        await loadIaPrompt();
        await migrateLocalStorageToFirestore();
        await initBackupScheduler();
    } else {
        currentUser = null;
        currentUserRole = 'user';
        discogsToken = '';
        if (backupIntervalId) { clearInterval(backupIntervalId); backupIntervalId = null; }
        if (unsubscribeVinyls) {
            unsubscribeVinyls();
            unsubscribeVinyls = null;
        }
        loginScreen.classList.remove('hidden');
        appEl.classList.add('hidden');
        vinyls = [];
        render();
    }
});

// === Firestore Operations ===
function getUserVinylsRef() {
    return db.collection('users').doc(currentUser.uid).collection('vinyls');
}

function subscribeToVinyls() {
    if (unsubscribeVinyls) unsubscribeVinyls();
    if (!currentUser) return;

    unsubscribeVinyls = getUserVinylsRef().onSnapshot(
        (snapshot) => {
            vinyls = snapshot.docs.map(doc => {
                const data = doc.data();
                // Backwards compat: use 'styles' if 'genre' not yet migrated
                if (data.styles && !data.genre) {
                    data.genre = data.styles;
                }
                return { id: doc.id, ...data };
            });
            // Auto-migrate: rename 'styles' field to 'genre'
            migrateStylesToGenre();
            populateGenreFilter();
            populateLabelFilter();
            if (!filtersRestored) { restoreDynamicFilters(); filtersRestored = true; }
            render();
        },
        (error) => {
            console.error('Firestore snapshot error:', error);
        }
    );
}

// Auto-migrate 'styles' field to 'genre' in Firestore
let migrationDone = false;
async function migrateStylesToGenre() {
    if (migrationDone || !currentUser) return;
    const toMigrate = vinyls.filter(v => v.styles && !v.genre);
    if (toMigrate.length === 0) { migrationDone = true; return; }
    console.log(`Migrating ${toMigrate.length} vinyls: styles → genre`);
    const ref = getUserVinylsRef();
    for (let i = 0; i < toMigrate.length; i += 500) {
        const batch = db.batch();
        toMigrate.slice(i, i + 500).forEach(v => {
            batch.update(ref.doc(v.id), { genre: v.styles });
        });
        await batch.commit();
    }
    migrationDone = true;
}

async function firestoreAddVinyl(vinyl) {
    if (!currentUser) return;
    const { id, ...data } = vinyl;
    await getUserVinylsRef().doc(id).set(data);
}

async function firestoreUpdateVinyl(id, data) {
    if (!currentUser) return;
    await getUserVinylsRef().doc(id).set(data, { merge: true });
}

async function firestoreDeleteVinyl(id) {
    if (!currentUser) return;
    await getUserVinylsRef().doc(id).delete();
}

async function firestoreDeleteMultiple(ids) {
    if (!currentUser) return;
    const batch = db.batch();
    const ref = getUserVinylsRef();
    ids.forEach(id => batch.delete(ref.doc(id)));
    await batch.commit();
}

async function firestoreBatchAdd(items) {
    if (!currentUser) return;
    const ref = getUserVinylsRef();
    for (let i = 0; i < items.length; i += 500) {
        const batch = db.batch();
        const chunk = items.slice(i, i + 500);
        chunk.forEach(v => {
            const { id, ...data } = v;
            batch.set(ref.doc(id), data, { merge: true });
        });
        await batch.commit();
    }
}

// === Migration localStorage -> Firestore ===
async function migrateLocalStorageToFirestore() {
    const localData = localStorage.getItem('vinyls');
    if (!localData || !currentUser) return;

    try {
        const localVinyls = JSON.parse(localData);
        if (!Array.isArray(localVinyls) || localVinyls.length === 0) return;

        const existing = await getUserVinylsRef().limit(1).get();
        if (!existing.empty) {
            if (!confirm(`Vous avez ${localVinyls.length} vinyle(s) en local et des données existantes dans le cloud. Voulez-vous fusionner les données locales dans le cloud ?`)) {
                localStorage.removeItem('vinyls');
                return;
            }
        }

        localVinyls.forEach(v => {
            if (!v.id) v.id = crypto.randomUUID();
        });

        await firestoreBatchAdd(localVinyls);
        alert(`Migration terminée ! ${localVinyls.length} vinyle(s) transféré(s) dans le cloud.`);
        localStorage.removeItem('vinyls');
    } catch (err) {
        console.error('Migration error:', err);
        alert('Erreur de migration. Vos données locales sont conservées.');
    }
}

// === Cover Art Search (Deezer JSONP) ===
let jsonpCounter = 0;

function deezerSearchJSONP(query, limit = 9) {
    return new Promise((resolve, reject) => {
        const cbName = '_dzCb' + (jsonpCounter++);
        const timeout = setTimeout(() => {
            delete window[cbName];
            if (script.parentNode) script.remove();
            reject(new Error('Timeout — vérifiez votre connexion internet'));
        }, 12000);

        window[cbName] = (data) => {
            clearTimeout(timeout);
            delete window[cbName];
            if (script.parentNode) script.remove();
            resolve(data);
        };

        const script = document.createElement('script');
        script.src = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=${limit}&output=jsonp&callback=${cbName}`;
        script.onerror = () => {
            clearTimeout(timeout);
            delete window[cbName];
            reject(new Error('Réseau indisponible'));
        };
        document.head.appendChild(script);
    });
}

async function searchCoverArt() {
    const artiste = document.getElementById('artiste').value.trim();
    const album = document.getElementById('album').value.trim();

    if (!artiste && !album) {
        alert('Remplissez au moins le champ Artiste ou Album pour chercher.');
        return;
    }

    const query = [artiste, album].filter(Boolean).join(' ');
    coverSearchBtn.textContent = '⏳ Recherche…';
    coverSearchBtn.classList.add('searching');

    const oldResults = document.querySelector('.cover-results');
    if (oldResults) oldResults.remove();

    try {
        const data = await deezerSearchJSONP(query, 9);
        const results = (data.data || []).filter(r => r.cover_big);

        if (results.length === 0) {
            alert('Aucune pochette trouvée pour cette recherche.');
            return;
        }

        const items = results.map(r => ({
            thumb: r.cover_medium || r.cover_big,
            cover: r.cover_xl || r.cover_big,
            artist: r.artist ? r.artist.name : '',
            albumName: r.title,
        }));

        if (artiste && album) {
            const albumLower = album.toLowerCase();
            const bestMatch = items.find(i =>
                i.albumName && i.albumName.toLowerCase().includes(albumLower)
            ) || items[0];
            applyCover(bestMatch.cover);
            return;
        }

        if (items.length === 1) {
            applyCover(items[0].cover);
            return;
        }

        const container = document.createElement('div');
        container.className = 'cover-results';
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'cover-result-item';
            el.innerHTML = `
                <img src="${esc(item.thumb)}" alt="${esc(item.albumName)}">
                <div class="cr-info">
                    <div class="cr-artist">${esc(item.artist)}</div>
                    <div class="cr-album">${esc(item.albumName)}</div>
                </div>`;
            el.addEventListener('click', () => {
                applyCover(item.cover);
                container.remove();
            });
            container.appendChild(el);
        });

        document.querySelector('.cover-col').appendChild(container);

    } catch (err) {
        alert('Erreur de recherche: ' + err.message);
    } finally {
        coverSearchBtn.textContent = '\u{1F50D} Pochette';
        coverSearchBtn.classList.remove('searching');
    }
}

function applyCover(url) {
    coverUrlInput.value = url;
    setCover(url);
}

coverSearchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    searchCoverArt();
});

// === Bulk cover search ===
const bulkCoverBtn = document.getElementById('bulkCoverBtn');

async function bulkSearchCovers() {
    const missing = vinyls.filter(v => !v.coverUrl && (v.artiste || v.album));
    if (missing.length === 0) {
        alert('Toutes les pochettes sont déjà renseignées !');
        return;
    }

    bulkCoverBtn.classList.add('searching');
    let found = 0;
    let errors = 0;

    for (let i = 0; i < missing.length; i++) {
        const v = missing[i];
        bulkCoverBtn.textContent = `⏳ ${i + 1}/${missing.length}…`;

        const query = [v.artiste, v.album].filter(Boolean).join(' ');

        try {
            const data = await deezerSearchJSONP(query, 5);
            const results = (data.data || []).filter(r => r.cover_big);

            if (results.length > 0) {
                const albumLower = (v.album || '').toLowerCase();
                const best = (albumLower
                    ? results.find(r => r.title && r.title.toLowerCase().includes(albumLower))
                    : null) || results[0];

                const coverUrl = best.cover_xl || best.cover_big;
                await firestoreUpdateVinyl(v.id, { coverUrl: coverUrl });
                found++;
            }
        } catch (e) {
            errors++;
        }

        if (i < missing.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    bulkCoverBtn.classList.remove('searching');
    bulkCoverBtn.innerHTML = '<span class="material-symbols-outlined">image_search</span> Pochettes auto';
    alert(`Terminé !\n✅ ${found} pochette${found > 1 ? 's' : ''} trouvée${found > 1 ? 's' : ''}\n⚠️ ${missing.length - found - errors} non trouvée${(missing.length - found - errors) > 1 ? 's' : ''}${errors > 0 ? '\n❌ ' + errors + ' erreur(s)' : ''}`);
}

bulkCoverBtn.addEventListener('click', bulkSearchCovers);

// === Discogs API ===

async function getDiscogsToken() {
    if (discogsToken) return discogsToken;

    // Try to load from Firestore
    if (currentUser) {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists && doc.data().discogsToken) {
            discogsToken = doc.data().discogsToken;
            return discogsToken;
        }
    }

    // Ask user for token
    return new Promise((resolve) => {
        tokenModal.classList.remove('hidden');
        discogsTokenInput.value = '';
        discogsTokenInput.focus();

        const save = async () => {
            const token = discogsTokenInput.value.trim();
            if (!token) {
                alert('Veuillez entrer un token valide.');
                return;
            }
            discogsToken = token;
            // Save to Firestore
            if (currentUser) {
                await db.collection('users').doc(currentUser.uid).set(
                    { discogsToken: token },
                    { merge: true }
                );
            }
            tokenModal.classList.add('hidden');
            cleanup();
            resolve(token);
        };

        const cancel = () => {
            tokenModal.classList.add('hidden');
            cleanup();
            resolve(null);
        };

        const cleanup = () => {
            tokenSaveBtn.removeEventListener('click', save);
            tokenCancelBtn.removeEventListener('click', cancel);
        };

        tokenSaveBtn.addEventListener('click', save);
        tokenCancelBtn.addEventListener('click', cancel);
    });
}

tokenModalClose.addEventListener('click', () => {
    tokenModal.classList.add('hidden');
});

async function discogsSearch(artist, album, token, options = {}) {
    const params = new URLSearchParams({
        type: 'release',
        per_page: '10'
    });
    if (artist) params.set('artist', artist);
    if (album) params.set('release_title', album);
    if (options.year) params.set('year', options.year);
    if (options.label) params.set('label', options.label);
    if (options.catno) params.set('catno', options.catno);

    const url = `https://api.discogs.com/database/search?${params.toString()}`;
    console.log('[Discogs] Requête:', url);

    const resp = await fetch(url, {
        headers: {
            'Authorization': `Discogs token=${token}`
        }
    });

    if (!resp.ok) {
        if (resp.status === 429) throw new Error('Rate limit Discogs atteint. Réessayez dans une minute.');
        if (resp.status === 401) {
            discogsToken = null;
            if (currentUser) {
                await db.collection('users').doc(currentUser.uid).set(
                    { discogsToken: firebase.firestore.FieldValue.delete() },
                    { merge: true }
                );
            }
            throw new Error('Token Discogs invalide ou expiré. Recréez un token sur discogs.com/settings/developers puis réessayez.');
        }
        throw new Error(`Erreur Discogs: ${resp.status}`);
    }

    const data = await resp.json();
    console.log('[Discogs] Résultats:', data.results ? data.results.length : 0);

    // Fallback: si aucun résultat et qu'on avait des paramètres restrictifs, relancer sans
    if ((!data.results || data.results.length === 0) && (options.year || options.label || options.catno)) {
        console.log('[Discogs] Aucun résultat, relance sans année/label/réf...');
        const fallbackParams = new URLSearchParams({ type: 'release', per_page: '10' });
        if (artist) fallbackParams.set('artist', artist);
        if (album) fallbackParams.set('release_title', album);
        const fallbackUrl = `https://api.discogs.com/database/search?${fallbackParams.toString()}`;
        const resp2 = await fetch(fallbackUrl, {
            headers: { 'Authorization': `Discogs token=${token}` }
        });
        if (resp2.ok) {
            const data2 = await resp2.json();
            console.log('[Discogs] Fallback résultats:', data2.results ? data2.results.length : 0);
            return data2;
        }
    }

    return data;
}

// Discogs search from form
async function searchDiscogs() {
    const artiste = document.getElementById('artiste').value.trim();
    const album = document.getElementById('album').value.trim();

    if (!artiste && !album) {
        alert('Remplissez au moins le champ Artiste ou Album pour chercher.');
        return;
    }

    const token = await getDiscogsToken();
    if (!token) return;

    discogsSearchBtn.textContent = '⏳ Recherche…';
    discogsSearchBtn.classList.add('searching');
    discogsResults.classList.remove('hidden');
    discogsResults.innerHTML = '<p class="discogs-loading">Recherche sur Discogs…</p>';

    const année = document.getElementById('année').value.trim();
    const label = document.getElementById('label').value.trim();
    const référence = document.getElementById('référence').value.trim();

    try {
        const data = await discogsSearch(artiste, album, token, {
            year: année, label: label, catno: référence
        });
        const results = data.results || [];

        if (results.length === 0) {
            discogsResults.innerHTML = '<p class="discogs-no-results">Aucun résultat sur Discogs.</p>';
            return;
        }

        // If both artist and album are specified, try to auto-select best match
        if (artiste && album) {
            const albumLower = album.toLowerCase();
            const artistLower = artiste.toLowerCase();
            const bestMatch = results.find(r => {
                const title = (r.title || '').toLowerCase();
                return title.includes(albumLower) && title.includes(artistLower);
            }) || results[0];

            applyDiscogsResult(bestMatch);
            discogsResults.classList.add('hidden');
            discogsResults.innerHTML = '';
            return;
        }

        // Show results grid for user to pick
        discogsResults.innerHTML = '';
        results.forEach(r => {
            const el = document.createElement('div');
            el.className = 'discogs-result-item';
            const imgUrl = r.cover_image || r.thumb || '';
            const styles = [...(r.genre || []), ...(r.style || [])].join(', ');
            el.innerHTML = `
                <img src="${esc(imgUrl)}" alt="" onerror="this.src=''">
                <div class="dr-info">
                    <div class="dr-title">${esc(r.title || '')}</div>
                    <div class="dr-styles">${esc(styles)}</div>
                    <div class="dr-year">${esc(r.year || '')}</div>
                </div>`;
            el.addEventListener('click', () => {
                applyDiscogsResult(r);
                discogsResults.classList.add('hidden');
                discogsResults.innerHTML = '';
            });
            discogsResults.appendChild(el);
        });

    } catch (err) {
        discogsResults.innerHTML = `<p class="discogs-error">Erreur: ${esc(err.message)}</p>`;
    } finally {
        discogsSearchBtn.textContent = '\u{1F50D} Discogs';
        discogsSearchBtn.classList.remove('searching');
    }
}

function applyDiscogsResult(result) {
    // Apply genre (combine Discogs genre + style)
    const newGenres = [...(result.genre || []), ...(result.style || [])];
    formGenres = [...new Set(newGenres)];
    renderGenreTags();

    // Apply cover if not already set
    if (result.cover_image && !coverUrlInput.value) {
        applyCover(result.cover_image);
    }

    // Apply Discogs URL
    const discogsUri = result.uri
        ? `https://www.discogs.com${result.uri}`
        : (result.resource_url || '');
    discogsUrlInput.value = discogsUri;
    updateDiscogsLink();
}

discogsSearchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    searchDiscogs();
});

discogsUrlBtn.addEventListener('click', (e) => {
    e.preventDefault();
    discogsUrlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    discogsUrlInput.focus();
});

// Discogs URL link
discogsUrlInput.addEventListener('input', updateDiscogsLink);

function updateDiscogsLink() {
    const url = discogsUrlInput.value.trim();
    if (url && url.startsWith('http')) {
        discogsLink.href = url;
        discogsLink.classList.remove('hidden');
    } else {
        discogsLink.classList.add('hidden');
    }
}

// === Bulk Discogs Search ===
async function bulkSearchDiscogs() {
    const token = await getDiscogsToken();
    if (!token) return;

    const missing = vinyls.filter(v =>
        ((!v.genre || v.genre.length === 0) || !v.discogsUrl) && (v.artiste || v.album)
    );

    if (missing.length === 0) {
        alert('Tous les vinyles ont déjà des infos Discogs complètes !');
        return;
    }

    if (!confirm(`Chercher sur Discogs pour ${missing.length} vinyle(s) ?\n(Genre, pochette, lien Discogs)\nCela peut prendre quelques minutes.`)) return;

    bulkDiscogsBtn.classList.add('searching');
    let found = 0;
    let errors = 0;

    for (let i = 0; i < missing.length; i++) {
        const v = missing[i];
        bulkDiscogsBtn.textContent = `⏳ ${i + 1}/${missing.length}…`;

        try {
            const data = await discogsSearch(v.artiste || '', v.album || '', token, {
                year: v.année || '', label: v.label || '', catno: v.référence || ''
            });
            const results = data.results || [];

            if (results.length > 0) {
                const albumLower = (v.album || '').toLowerCase();
                const artistLower = (v.artiste || '').toLowerCase();

                const best = results.find(r => {
                    const title = (r.title || '').toLowerCase();
                    return title.includes(albumLower) && title.includes(artistLower);
                }) || results[0];

                const update = {};
                const genres = [...(best.genre || []), ...(best.style || [])];
                if (genres.length > 0 && (!v.genre || v.genre.length === 0)) {
                    update.genre = genres;
                }
                if (best.uri && !v.discogsUrl) {
                    update.discogsUrl = `https://www.discogs.com${best.uri}`;
                }
                if (best.cover_image && !v.coverUrl) {
                    update.coverUrl = best.cover_image;
                }

                if (Object.keys(update).length > 0) {
                    await firestoreUpdateVinyl(v.id, update);
                    found++;
                }
            }
        } catch (e) {
            errors++;
            console.error(`Discogs error for ${v.artiste} - ${v.album}:`, e.message);
        }

        // Rate limit: 1 second between requests
        if (i < missing.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    bulkDiscogsBtn.classList.remove('searching');
    bulkDiscogsBtn.innerHTML = '<span class="material-symbols-outlined">album</span> Discogs auto';
    alert(`Terminé !\n✅ ${found} vinyle${found > 1 ? 's' : ''} enrichi${found > 1 ? 's' : ''}\n⚠️ ${missing.length - found - errors} non trouvé${(missing.length - found - errors) > 1 ? 's' : ''}${errors > 0 ? '\n❌ ' + errors + ' erreur(s)' : ''}`);
}

bulkDiscogsBtn.addEventListener('click', bulkSearchDiscogs);

// === Styles Tag Input ===
function renderGenreTags() {
    genreTags.innerHTML = formGenres.map((s, i) =>
        `<span class="tag tag-style">${esc(s)} <button type="button" class="tag-remove" data-idx="${i}">&times;</button></span>`
    ).join('');

    genreTags.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            formGenres.splice(parseInt(btn.dataset.idx), 1);
            renderGenreTags();
        });
    });
}

genreInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = genreInput.value.trim();
        if (val && !formGenres.includes(val)) {
            formGenres.push(val);
            renderGenreTags();
        }
        genreInput.value = '';
    }
    if (e.key === 'Backspace' && genreInput.value === '' && formGenres.length > 0) {
        formGenres.pop();
        renderGenreTags();
    }
});

// === Populate filter dropdowns ===
function populateFilters() {
    const cats = ['Jazz', "Jazz TBM", "Jazz Eighty Eight's", 'Pop / Rock', 'Afrique',
        'Brésil', 'Latin', 'OST', 'Blues', 'Electronique', 'Classique'];
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        filterCategorie.appendChild(opt);
    });

    Object.entries(GOUT_LABELS).forEach(([k, v]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${k} – ${v}`;
        filterGoût.appendChild(opt);
    });

    Object.entries(ENERGIE_LABELS).forEach(([k, v]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${k} – ${v}`;
        filterEnergie.appendChild(opt);
    });
}

function populateGenreFilter() {
    const currentVal = filterGenre.value;
    // Collect all unique styles from vinyls
    const allStyles = new Set();
    vinyls.forEach(v => {
        (v.genre || []).forEach(s => allStyles.add(s));
    });

    // Keep only the first option, remove the rest
    while (filterGenre.options.length > 1) {
        filterGenre.remove(1);
    }

    [...allStyles].sort().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        filterGenre.appendChild(opt);
    });

    // Restore selection if still valid
    if (currentVal && allStyles.has(currentVal)) {
        filterGenre.value = currentVal;
    }
}

function populateLabelFilter() {
    const currentVal = filterLabel.value;
    const allLabels = new Set();
    vinyls.forEach(v => { if (v.label) allLabels.add(v.label); });
    while (filterLabel.options.length > 1) filterLabel.remove(1);

    [...allLabels].sort((a, b) => a.localeCompare(b, 'fr')).forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = l;
        filterLabel.appendChild(opt);
    });

    if (currentVal && allLabels.has(currentVal)) filterLabel.value = currentVal;
}

function saveFilters() {
    try {
        localStorage.setItem('vinylFilters', JSON.stringify({
            categorie: filterCategorie.value,
            genre: filterGenre.value,
            goût: filterGoût.value,
            energie: filterEnergie.value,
            classé: filterClassé.value,
            label: filterLabel.value,
            sort: currentSort,
            sortAsc: sortAsc,
        }));
    } catch(e) {}
}

function restoreFilters() {
    try {
        const saved = JSON.parse(localStorage.getItem('vinylFilters'));
        if (!saved) return;
        if (saved.categorie) filterCategorie.value = saved.categorie;
        if (saved.goût) filterGoût.value = saved.goût;
        if (saved.energie) filterEnergie.value = saved.energie;
        if (saved.classé) filterClassé.value = saved.classé;
        if (saved.sort) currentSort = saved.sort;
        if (saved.sortAsc !== undefined) sortAsc = saved.sortAsc;
        sortBySelect.value = currentSort;
        sortDirBtn.textContent = sortAsc ? '↑' : '↓';
    } catch(e) {}
}

function restoreDynamicFilters() {
    try {
        const saved = JSON.parse(localStorage.getItem('vinylFilters'));
        if (!saved) return;
        if (saved.genre) filterGenre.value = saved.genre;
        if (saved.label) filterLabel.value = saved.label;
    } catch(e) {}
}

function restoreView() {
    try {
        const saved = localStorage.getItem('vinylView');
        if (saved === 'table') {
            currentView = 'table';
            viewTableBtn.classList.add('active');
            viewGalleryBtn.classList.remove('active');
            view3DBtn.classList.remove('active');
        } else if (saved === '3d') {
            currentView = '3d';
            view3DBtn.classList.add('active');
            viewTableBtn.classList.remove('active');
            viewGalleryBtn.classList.remove('active');
        }
    } catch(e) {}
}

// === Render ===
function getFilteredAndSorted() {
    const search = searchInput.value.toLowerCase().trim();
    const catFilter = filterCategorie.value;
    const styleFilter = filterGenre.value;
    const goutFilter = filterGoût.value;
    const energieFilter = filterEnergie.value;
    const classéFilter = filterClassé.value;
    const labelFilter = filterLabel.value;

    let list = vinyls.filter(v => {
        if (search) {
            const hay = [v.artiste, v.album, v.label, v.référence, v.acheté, v.lieu, v.avisIA, v.commentaire,
                ...(v.categorie || []), ...(v.genre || [])]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        if (catFilter && !(v.categorie || []).includes(catFilter)) return false;
        if (styleFilter && !(v.genre || []).includes(styleFilter)) return false;
        if (goutFilter && v.goût !== goutFilter) return false;
        if (energieFilter && v.energie !== energieFilter) return false;
        if (classéFilter && v.classé !== classéFilter) return false;
        if (labelFilter && v.label !== labelFilter) return false;
        return true;
    });

    list.sort((a, b) => {
        let va, vb;
        switch (currentSort) {
            case 'artiste': va = (a.artiste || '').toLowerCase(); vb = (b.artiste || '').toLowerCase(); break;
            case 'album': va = (a.album || '').toLowerCase(); vb = (b.album || '').toLowerCase(); break;
            case 'année': va = parseInt(a.année) || 0; vb = parseInt(b.année) || 0; break;
            case 'goût': va = safeInt(a.goût); vb = safeInt(b.goût); break;
            case 'audio': va = safeInt(a.audio); vb = safeInt(b.audio); break;
            case 'energie': va = safeInt(a.energie); vb = safeInt(b.energie); break;
            case 'prix': va = parseFloat(a.prix) || 0; vb = parseFloat(b.prix) || 0; break;
            case 'nb': va = parseInt(a.nb) || 0; vb = parseInt(b.nb) || 0; break;
            case 'classé': va = a.classé || ''; vb = b.classé || ''; break;
            case 'dateAjout': va = a.dateAjout || ''; vb = b.dateAjout || ''; break;
            default: va = (a.artiste || '').toLowerCase(); vb = (b.artiste || '').toLowerCase();
        }
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        // Secondary sort: artiste then album alphabetically
        const artA = (a.artiste || '').toLowerCase();
        const artB = (b.artiste || '').toLowerCase();
        if (artA < artB) return -1;
        if (artA > artB) return 1;
        const albA = (a.album || '').toLowerCase();
        const albB = (b.album || '').toLowerCase();
        if (albA < albB) return -1;
        if (albA > albB) return 1;
        return 0;
    });

    return list;
}

function updateHeaderHeight() {
    const h = document.querySelector('header');
    if (h) document.documentElement.style.setProperty('--header-height', h.offsetHeight + 'px');
}
window.addEventListener('resize', updateHeaderHeight);

function render() {
    updateHeaderHeight();
    const list = getFilteredAndSorted();

    statsEl.textContent = `${vinyls.length} vinyle${vinyls.length > 1 ? 's' : ''} · ${list.length} affiché${list.length > 1 ? 's' : ''}`;

    if (list.length === 0) {
        vinylTable.classList.add('hidden');
        galleryView.classList.add('hidden');
        graph3dView.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.querySelector('p').textContent =
            vinyls.length === 0 ? 'Aucun vinyle. Commencez par en ajouter un !' : 'Aucun résultat pour ces filtres.';
        return;
    }

    emptyState.classList.add('hidden');

    if (currentView === 'gallery') {
        vinylTable.classList.add('hidden');
        tableView.classList.add('hidden');
        graph3dView.classList.add('hidden');
        galleryView.classList.remove('hidden');
        document.body.classList.add('gallery-mode');
        document.body.classList.remove('table-mode');
        renderGallery(list);
    } else if (currentView === '3d') {
        vinylTable.classList.add('hidden');
        tableView.classList.add('hidden');
        galleryView.classList.add('hidden');
        graph3dView.classList.remove('hidden');
        document.body.classList.remove('gallery-mode');
        document.body.classList.remove('table-mode');
        // Attendre que le conteneur ait ses dimensions après display
        requestAnimationFrame(() => render3DGraph(list));
    } else {
        galleryView.classList.add('hidden');
        graph3dView.classList.add('hidden');
        vinylTable.classList.remove('hidden');
        tableView.classList.remove('hidden');
        document.body.classList.add('table-mode');
        document.body.classList.remove('gallery-mode');
        renderTable(list);
    }
    updateSortIndicator();
}

function updateSortIndicator() {
    document.querySelectorAll('.vinyl-table thead th[data-sort]').forEach(th => {
        if (th.dataset.sort === currentSort) {
            th.classList.add('th-sorted');
            th.setAttribute('data-sort-dir', sortAsc ? ' ↑' : ' ↓');
        } else {
            th.classList.remove('th-sorted');
            th.removeAttribute('data-sort-dir');
        }
    });
    sortBySelect.value = currentSort;
    sortDirBtn.textContent = sortAsc ? '↑' : '↓';
}

function renderGallery(list) {
    galleryView.innerHTML = list.map(v => {
        const imgHtml = v.coverUrl
            ? `<img src="${esc(v.coverUrl)}" alt="${esc(v.album)}" loading="lazy">`
            : `<span class="gallery-no-img">♫</span>`;

        const stylesHtml = (v.genre || []).length > 0
            ? `<div class="g-styles">${(v.genre || []).slice(0, 3).map(s => `<span class="tag tag-style-sm">${esc(s)}</span>`).join(' ')}</div>`
            : '';

        return `<div class="gallery-card" data-id="${v.id}">
            <div class="gallery-card-img">${imgHtml}</div>
            <div class="gallery-card-info">
                <div class="g-artist">${esc(v.artiste)}</div>
                <div class="g-album">${esc(v.album)}</div>
                <div class="g-year-row">
                    ${v.année ? `<span class="g-year">${esc(v.année)}</span>` : ''}
                    <span class="g-ratings">
                        <span class="g-rating"><span class="material-symbols-outlined">favorite</span>${v.goût && v.goût !== '0' ? v.goût : '–'}</span>
                        <span class="g-rating"><span class="material-symbols-outlined">headphones</span>${v.audio && v.audio !== '0' ? v.audio : '–'}</span>
                        <span class="g-rating"><span class="material-symbols-outlined">bolt</span>${v.energie && v.energie !== '0' ? v.energie : '–'}</span>
                    </span>
                </div>
                ${stylesHtml}
            </div>
        </div>`;
    }).join('');

    galleryView.querySelectorAll('.gallery-card').forEach(card => {
        card.addEventListener('click', () => openEdit(card.dataset.id));
    });
}

function renderTable(list) {
    const isGuest = currentUserRole === 'guest';

    vinylBody.innerHTML = list.map(v => {
        const cats = (v.categorie || []).map(c => `<span class="tag tag-categorie">${esc(c)}</span>`).join(' ');
        const stylesHtml = (v.genre || []).map(s => `<span class="tag tag-style">${esc(s)}</span>`).join(' ');

        const classéBadge = v.classé === 'Oui'
            ? '<span class="badge-classé classé-oui">Oui</span>'
            : '<span class="badge-classé classé-non">Non</span>';

        const goutText = v.goût !== '' && v.goût != null && GOUT_LABELS[v.goût] ? `${v.goût} – ${GOUT_LABELS[v.goût]}` : '';
        const audioText = v.audio !== '' && v.audio != null && AUDIO_LABELS[v.audio] ? `${v.audio} – ${AUDIO_LABELS[v.audio]}` : '';
        const energieText = v.energie !== '' && v.energie != null && ENERGIE_LABELS[v.energie] ? `${v.energie} – ${ENERGIE_LABELS[v.energie]}` : '';

        const discogsHtml = v.discogsUrl
            ? `<a href="${esc(v.discogsUrl)}" target="_blank" class="discogs-table-link" title="Voir sur Discogs" onclick="event.stopPropagation()">↗</a>`
            : '';

        return `<tr data-id="${v.id}">
            ${isGuest ? '' : `<td class="cell-center cell-check"><input type="checkbox" class="row-select" data-id="${v.id}" ${selectedIds.has(v.id) ? 'checked' : ''}></td>`}
            <td>${cats}</td>
            <td class="cell-center">${classéBadge}</td>
            <td class="cell-artiste">${esc(v.artiste)}</td>
            <td class="cell-album">${esc(v.album)}</td>
            <td class="cell-center">${esc(v.année)}</td>
            <td>${esc(v.label)}</td>
            <td>${esc(v.référence)}</td>
            <td class="cell-styles">${stylesHtml}</td>
            <td class="cell-gout">${esc(goutText)}</td>
            <td class="cell-audio">${esc(audioText)}</td>
            <td class="cell-energie">${esc(energieText)}</td>
            <td class="cell-center">${v.nb && v.nb !== '0' ? v.nb : ''}</td>
            <td class="cell-num">${v.prix ? cleanPrix(v.prix) + ' €' : ''}</td>
            <td>${esc(v.acheté)}</td>
            <td>${esc(v.lieu)}</td>
            <td class="cell-comment" title="${esc(v.avisIA)}">${esc(v.avisIA)}</td>
            <td class="cell-comment" title="${esc(v.commentaire)}">${esc(v.commentaire)}</td>
            <td class="cell-center">${discogsHtml}</td>
        </tr>`;
    }).join('');

    vinylBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('row-select')) return;
            openEdit(row.dataset.id);
        });
    });

    vinylBody.querySelectorAll('.row-select').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedIds.add(cb.dataset.id);
            } else {
                selectedIds.delete(cb.dataset.id);
            }
            updateBulkDelete();
        });
    });

    updateBulkDelete();
}

function updateBulkDelete() {
    if (currentUserRole === 'guest') return;
    if (selectedIds.size > 0) {
        bulkDeleteBtn.classList.remove('hidden');
        bulkDeleteBtn.textContent = `Supprimer (${selectedIds.size})`;
    } else {
        bulkDeleteBtn.classList.add('hidden');
    }
    const checkboxes = vinylBody.querySelectorAll('.row-select');
    selectAllCb.checked = checkboxes.length > 0 && selectedIds.size === checkboxes.length;
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function cleanPrix(val) {
    if (!val) return '';
    return String(val).replace(/[€\s]/g, '').replace(',', '.');
}

// === Modal ===
function openModal() {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    editingId = null;
    vinylForm.reset();
    deleteBtn.classList.add('hidden');
    formGenres = [];
    renderGenreTags();
    discogsResults.classList.add('hidden');
    discogsResults.innerHTML = '';
    discogsLink.classList.add('hidden');
    const oldResults = document.querySelector('.cover-results');
    if (oldResults) oldResults.remove();
    // Reset IA result zone
    const iaZone = document.getElementById('iaResultZone');
    iaZone.innerHTML = '';
    iaZone.classList.add('hidden');
    const iaBtn = document.getElementById('iaAnalyseBtn');
    iaBtn.textContent = '🤖 Analyse IA';
    iaBtn.disabled = false;
}

// === Analyse IA (Anthropic API) ===

const IA_SYSTEM_PROMPT = `Tu es un expert vinyl jazz qui évalue des albums pour Pierre, audiophile français.
SYSTÈME DE NOTATION :
1) Déteste – achat raté
2) Tolère – peu de plaisir
3) Apprécie – mais pas souvent
4) Aime – plaisir occasionnel
4.5) Aime – sympa régulièrement
5) Adore – vraiment excellent
6) Vibre – frissons, jamais lassé
CATALOGUE DE RÉFÉRENCE DE PIERRE :
NOTE 6 :
Astrud Gilberto - Look To The Rainbow | Barney Wilen - French Ballads | Barney Wilen - La Note Bleue | Cannonball Adderley - Somethin' Else | Duke Jordan Trio - So Nice Duke | Isao Suzuki Trio/Quartet - Blow Up | João Gilberto - Amoroso | Kenny Drew - By Request | Kenny Drew Trio - Dream | Miles Davis - Ascenseur pour l'échafaud | Miles Davis - Birth of the Blue | Miles Davis - Tutu | Nina Simone - I Put A Spell On You | Paolo Conte - Concerti | Paolo Conte - Paolo Conte | Paolo Conte - Parole D'Amore Scritte A Macchina | Paolo Fresu/Galliano - Mare Nostrum I/II/III/IV | Quincy Jones - Big Band Bossa Nova | Stan Getz & João Gilberto - Getz/Gilberto | Stan Getz & Charlie Byrd - Jazz Samba | Dave Brubeck Quartet - Time Out | The Eagles - Hotel California | Three Blind Mice Vol.1 (compil) | Tsuyoshi Yamamoto Trio - Midnight Sugar | Tsuyoshi Yamamoto Trio - Misty | Michel Jonasz - La Fabuleuse Histoire De Mister Swing | Maria Bethânia/Vinicius/Toquinho
NOTE 5 :
Ayako Hosokawa - To Mr. Wonderful & No Tears | Barney Wilen - Grenoble '88, Inside Nitty Gritty, New York Romance, Un Témoin Dans La Ville, Les Liaisons Dangereuses, French Story | Ben Webster - Duke's In Bed!, Stardust, The Soul Of Ben Webster | Benny Golson - Gone With Golson | Beth Carvalho - De Pé No Chão | Bobby Hutcherson - In The Vanguard | Buena Vista Social Club | Cannonball Adderley - Coast To Coast | Chet Baker - Chet, Chet Is Back | Danielsson/Fresu - Summerwind | Ella Fitzgerald & Joe Pass - Fitzgerald & Pass Again | Ella Fitzgerald & Louis Armstrong - Ella And Louis | Eva Cassidy - Live At Blues Alley | Grady Tate - Sings All Love | Henri Salvador - Chambre Avec Vue | Hugh Masekela - Hope | Ibrahim Malhouf - S3NS | Jacintha - Autumn Leaves, Here's To Ben (45RPM) | Jan Lundgren - Potsdamer Platz | Jimmy Smith - The Cat | João Gilberto - Chega De Saudade | John Coltrane - Coltrane Plays The Blues, Giant Steps | Johnny Hartman - Once In Every Life | Kenny Burrell - Kenny Burrell | Kenny Drew - This Is New, Fantasia, Pal Joey, The Lullaby | Lee Konitz Quartet - Jazz Nocturne | Lhasa de Sela - (4 albums) | Madeleine Peyroux - Careless Love | Manu Chao - Clandestino | Marlena Shaw - Live In Tokyo | Miles Davis - 1958 Miles, Bags Groove, Decoy, In A Silent Way, Kind Of Blue, Nefertiti, Seven Steps To Heaven, Sketches Of Spain, Steamin', Walkin' | Oliver Nelson - Blues And The Abstract Truth | Peggy Lee - Black Coffee | Sarah Vaughan - A Celebration Of Duke | Shirley Horn - Softly | Shoji Yokouchi Trio - Greensleeves | Sonny Rollins - Saxophone Colossus, Sonny Rollins, Way Out West | Stan Getz/Albert Dailey - Poetry | New York Trio - Begin The Beguine
NOTE 4.5 :
Archie Shepp & Horace Parlan - Trouble In Mind | Art Farmer - Portrait | Art Pepper - Meets The Rhythm Section | Avishai Cohen - Playing The Room | Barney Wilen - Barney, Live In Tokyo 91, Montreal Duets | Cannonball - Cannonball's Bossa Nova | Kunihiko Sugano Trio - Love Is A Many Splendored Thing | Masaru Imada - Piano, Green Caterpillar | Miles Davis - Miles '54 | Dave Brubeck - Jazz At Oberlin | The John Wright Trio - South Side Soul | Dexter Gordon - Go | Egberto Gismonti - Sol Do Meio Dia
NOTE 4 :
(nombreux albums hard bop, standards, big band, électrique modéré)
NOTE 3 :
Al Di Meola/McLaughlin/De Lucia - Friday Night in San Francisco | Archie Shepp - Fire Music | John Coltrane - Ballads | Nina Simone - Pastel Blues | Manhattan Jazz Quintet - Live At Pit Inn
PROFIL SYNTHÉTIQUE :
- Fort attrait pour : bossa nova, jazz modal acoustique, piano trio japonais (Three Blind Mice label), vocal jazz intimiste, Barney Wilen, Miles Davis acoustique, Paolo Conte/Fresu/Galliano
- Qualité sonore audiophile très importante (pressings japonais, 45RPM appréciés)
- Acoustique >> électrique
- Mélodie et ambiance >> dissonance et avant-garde
- Free jazz et fusion trop électrique = note basse
FORMAT DE RÉPONSE pour chaque album :
**NOTE PRÉDICTIVE : X/6**
**Confiance : XX%**
**Achat recommandé : oui / occasion / non**
**Pourquoi :** [2-3 phrases comparant avec son catalogue, mentionnant des albums similaires qu'il possède]`;

function parseMarkdown(md) {
    let html = esc(md);
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // List items
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    // Paragraphs — lines not already wrapped
    html = html.replace(/^(?!<[hul]|<li)(.+)$/gm, '<p>$1</p>');
    // Clean up extra newlines
    html = html.replace(/\n/g, '');
    return html;
}

async function lancerAnalyseIA() {
    const iaBtn = document.getElementById('iaAnalyseBtn');
    const iaZone = document.getElementById('iaResultZone');

    const artiste = document.getElementById('artiste').value.trim();
    const album = document.getElementById('album').value.trim();
    const année = document.getElementById('année').value;
    const label = document.getElementById('label').value.trim();
    const référence = document.getElementById('référence').value.trim();

    if (!artiste || !album) {
        iaZone.classList.remove('hidden');
        iaZone.innerHTML = '<p class="ia-error">Veuillez renseigner au moins l\'artiste et l\'album.</p>';
        return;
    }

    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
        iaZone.classList.remove('hidden');
        iaZone.innerHTML = '<p class="ia-error">Clé API Anthropic non configurée.<br>Un administrateur doit la renseigner via le menu ☰ &gt; Clé API Anthropic.</p>';
        return;
    }

    // Spinner state
    iaBtn.disabled = true;
    iaBtn.textContent = '⏳ Analyse en cours...';
    iaZone.classList.remove('hidden');
    iaZone.innerHTML = '<div class="ia-spinner"><div class="spinner"></div> Analyse en cours…</div>';

    const userMessage = `Artiste: ${artiste}, Album: ${album}, Année: ${année}, Label: ${label}, Référence: ${référence}`;

    try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                system: getIaPrompt(),
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        if (!resp.ok) {
            const errBody = await resp.text();
            throw new Error(`Erreur API (${resp.status}): ${errBody}`);
        }

        const data = await resp.json();
        const texte = data.content?.[0]?.text || 'Aucune réponse reçue.';

        iaZone.innerHTML = parseMarkdown(texte);

        // Save result in avisIA hidden field
        document.getElementById('avisIA').value = texte;

    } catch (err) {
        console.error('Erreur analyse IA:', err);
        let message = 'Erreur lors de l\'analyse IA.';
        if (err.message.includes('401')) {
            message = 'Clé API Anthropic invalide. Vérifiez votre configuration.';
        } else if (err.message.includes('429')) {
            message = 'Trop de requêtes. Réessayez dans quelques instants.';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            message = 'Erreur réseau. Vérifiez votre connexion internet.';
        } else {
            message = err.message;
        }
        iaZone.innerHTML = `<p class="ia-error">${esc(message)}</p>`;
    } finally {
        iaBtn.disabled = false;
        iaBtn.textContent = '🤖 Analyse IA';
    }
}

function setCover(url) {
    if (url) {
        coverImg.onload = () => {
            coverImg.classList.remove('hidden');
            coverPlaceholder.classList.add('hidden');
        };
        coverImg.onerror = () => {
            coverImg.classList.add('hidden');
            coverPlaceholder.classList.remove('hidden');
            coverPlaceholder.textContent = '⚠ Image non trouvée';
        };
        coverImg.src = url;
        coverImg.classList.remove('hidden');
        coverPlaceholder.classList.add('hidden');
        coverPlaceholder.textContent = '+ Photo';
    } else {
        coverImg.src = '';
        coverImg.classList.add('hidden');
        coverPlaceholder.classList.remove('hidden');
        coverPlaceholder.textContent = '+ Photo';
    }
}

function openAdd() {
    if (currentUserRole === 'guest') return;
    editingId = null;
    modalTitle.textContent = 'Ajouter un vinyle';
    vinylForm.reset();
    deleteBtn.classList.add('hidden');
    setCover('');
    coverUrlInput.value = '';
    coverUrlInput.classList.add('hidden');
    formGenres = [];
    renderGenreTags();
    discogsUrlInput.value = '';
    discogsLink.classList.add('hidden');
    discogsResults.classList.add('hidden');
    discogsResults.innerHTML = '';
    openModal();
}

function openEdit(id) {
    const v = vinyls.find(x => x.id === id);
    if (!v) return;

    // Guest can view but not edit - open in read-only mode
    editingId = id;
    modalTitle.textContent = currentUserRole === 'guest' ? 'Détail du vinyle' : 'Modifier le vinyle';

    if (currentUserRole !== 'guest') {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    document.querySelectorAll('input[name="categorie"]').forEach(cb => {
        cb.checked = (v.categorie || []).includes(cb.value);
    });
    document.getElementById('classé').value = v.classé || 'Non';
    document.getElementById('artiste').value = v.artiste || '';
    document.getElementById('album').value = v.album || '';
    document.getElementById('année').value = v.année || '';
    document.getElementById('label').value = v.label || '';
    document.getElementById('référence').value = v.référence || '';
    document.getElementById('goût').value = v.goût || '';
    document.getElementById('audio').value = v.audio || '';
    document.getElementById('energie').value = v.energie || '';
    document.getElementById('nb').value = v.nb || '0';
    document.getElementById('prix').value = cleanPrix(v.prix);
    document.getElementById('acheté').value = v.acheté || '';
    document.getElementById('lieu').value = v.lieu || '';
    document.getElementById('avisIA').value = v.avisIA || '';
    // Afficher l'avis IA existant s'il y en a un
    const iaZone = document.getElementById('iaResultZone');
    if (v.avisIA) {
        iaZone.innerHTML = parseMarkdown(v.avisIA);
        iaZone.classList.remove('hidden');
    } else {
        iaZone.innerHTML = '';
        iaZone.classList.add('hidden');
    }
    document.getElementById('commentaire').value = v.commentaire || '';

    // Styles
    formGenres = [...(v.genre || [])];
    renderGenreTags();

    // Discogs URL
    discogsUrlInput.value = v.discogsUrl || '';
    updateDiscogsLink();

    setCover(v.coverUrl || '');
    coverUrlInput.value = v.coverUrl || '';
    coverUrlInput.classList.add('hidden');

    // Disable form inputs for guest
    const formInputs = vinylForm.querySelectorAll('input, select, textarea, button[type="submit"]');
    formInputs.forEach(el => {
        if (currentUserRole === 'guest') {
            el.disabled = true;
        } else {
            el.disabled = false;
        }
    });
    // Keep cancel button, close button and IA button enabled
    cancelBtn.disabled = false;
    modalClose.disabled = false;
    document.getElementById('iaAnalyseBtn').disabled = false;

    openModal();
}

function getFormData() {
    const cats = [];
    document.querySelectorAll('input[name="categorie"]:checked').forEach(cb => cats.push(cb.value));

    return {
        categorie: cats,
        classé: document.getElementById('classé').value,
        artiste: document.getElementById('artiste').value.trim(),
        album: document.getElementById('album').value.trim(),
        année: document.getElementById('année').value,
        label: document.getElementById('label').value.trim(),
        référence: document.getElementById('référence').value.trim(),
        goût: document.getElementById('goût').value,
        audio: document.getElementById('audio').value,
        energie: document.getElementById('energie').value,
        nb: document.getElementById('nb').value,
        prix: document.getElementById('prix').value,
        acheté: document.getElementById('acheté').value.trim(),
        lieu: document.getElementById('lieu').value,
        avisIA: document.getElementById('avisIA').value.trim(),
        commentaire: document.getElementById('commentaire').value.trim(),
        coverUrl: coverUrlInput.value.trim(),
        genre: [...formGenres],
        discogsUrl: discogsUrlInput.value.trim(),
    };
}

// === Events ===
addBtn.addEventListener('click', openAdd);
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
document.querySelector('#modal .modal-overlay')?.addEventListener('click', closeModal);
document.getElementById('iaAnalyseBtn').addEventListener('click', lancerAnalyseIA);

vinylForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentUserRole === 'guest') return;
    const data = getFormData();

    try {
        if (editingId) {
            await firestoreUpdateVinyl(editingId, data);
        } else {
            data.id = crypto.randomUUID();
            data.dateAjout = new Date().toISOString();
            await firestoreAddVinyl(data);
        }
        closeModal();
    } catch (err) {
        console.error('Save error:', err);
        alert('Erreur lors de la sauvegarde: ' + err.message);
    }
});

deleteBtn.addEventListener('click', async () => {
    if (!editingId || currentUserRole === 'guest') return;
    if (!confirm('Supprimer ce vinyle ?')) return;
    try {
        await firestoreDeleteVinyl(editingId);
        closeModal();
    } catch (err) {
        alert('Erreur lors de la suppression: ' + err.message);
    }
});

// Search clear button
const searchClearBtn = document.getElementById('searchClearBtn');
const debouncedRender = debounce(() => { selectedIds.clear(); render(); }, 200);
searchInput.addEventListener('input', () => {
    searchClearBtn.classList.toggle('hidden', searchInput.value === '');
    debouncedRender();
});
searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.classList.add('hidden');
    searchInput.focus();
    selectedIds.clear();
    render();
});

// Filters & search
function onFilterChange() { selectedIds.clear(); saveFilters(); render(); }
filterCategorie.addEventListener('change', onFilterChange);
filterGenre.addEventListener('change', onFilterChange);
filterGoût.addEventListener('change', onFilterChange);
filterEnergie.addEventListener('change', onFilterChange);
filterClassé.addEventListener('change', onFilterChange);
filterLabel.addEventListener('change', onFilterChange);

sortBySelect.addEventListener('change', () => {
    currentSort = sortBySelect.value;
    saveFilters();
    render();
});

sortDirBtn.addEventListener('click', () => {
    sortAsc = !sortAsc;
    saveFilters();
    render();
});

// Column header sort
document.querySelectorAll('.vinyl-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (currentSort === col) {
            sortAsc = !sortAsc;
        } else {
            currentSort = col;
            sortAsc = true;
        }
        saveFilters();
        render();
    });
});

// Reset filters
resetFiltersBtn.addEventListener('click', () => {
    filterCategorie.value = '';
    filterGenre.value = '';
    filterGoût.value = '';
    filterEnergie.value = '';
    filterClassé.value = '';
    filterLabel.value = '';
    searchInput.value = '';
    searchClearBtn.classList.add('hidden');
    currentSort = 'artiste';
    sortAsc = true;
    selectedIds.clear();
    saveFilters();
    render();
});

// Cover photo
coverZone.addEventListener('click', () => {
    coverUrlInput.classList.toggle('hidden');
    if (!coverUrlInput.classList.contains('hidden')) {
        coverUrlInput.focus();
    }
});

document.getElementById('coverUrlBtn').addEventListener('click', (e) => {
    e.preventDefault();
    coverUrlInput.classList.remove('hidden');
    coverUrlInput.focus();
    coverUrlInput.placeholder = 'Collez l\'URL de l\'image ici';
});

coverUrlInput.addEventListener('input', () => {
    setCover(coverUrlInput.value.trim());
});

coverUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        coverUrlInput.classList.add('hidden');
    }
});

// View toggle
viewTableBtn.addEventListener('click', () => {
    currentView = 'table';
    viewTableBtn.classList.add('active');
    viewGalleryBtn.classList.remove('active');
    view3DBtn.classList.remove('active');
    try { localStorage.setItem('vinylView', 'table'); } catch(e) {}
    render();
});

viewGalleryBtn.addEventListener('click', () => {
    currentView = 'gallery';
    viewGalleryBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
    view3DBtn.classList.remove('active');
    try { localStorage.setItem('vinylView', 'gallery'); } catch(e) {}
    render();
});

view3DBtn.addEventListener('click', () => {
    currentView = '3d';
    view3DBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
    viewGalleryBtn.classList.remove('active');
    try { localStorage.setItem('vinylView', '3d'); } catch(e) {}
    render();
});

// Select all checkbox
selectAllCb.addEventListener('change', () => {
    const checkboxes = vinylBody.querySelectorAll('.row-select');
    checkboxes.forEach(cb => {
        if (selectAllCb.checked) {
            selectedIds.add(cb.dataset.id);
            cb.checked = true;
        } else {
            selectedIds.delete(cb.dataset.id);
            cb.checked = false;
        }
    });
    updateBulkDelete();
});

// Bulk delete
bulkDeleteBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0 || currentUserRole === 'guest') return;
    if (!confirm(`Supprimer ${selectedIds.size} vinyle(s) ?`)) return;
    try {
        await firestoreDeleteMultiple([...selectedIds]);
        selectedIds.clear();
    } catch (err) {
        alert('Erreur lors de la suppression groupée: ' + err.message);
    }
});

// === Reset Discogs Token ===
document.getElementById('resetDiscogsTokenBtn').addEventListener('click', async () => {
    const currentToken = discogsToken || '';
    const display = currentToken ? currentToken.substring(0, 8) + '...' : '(aucun)';
    const newToken = prompt('Token Discogs actuel: ' + display + '\nEntrez un nouveau token (ou vide pour supprimer):\n\nCréez un token sur: discogs.com/settings/developers', currentToken);
    if (newToken === null) return; // cancel
    if (newToken.trim() === '') {
        discogsToken = null;
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).set(
                { discogsToken: firebase.firestore.FieldValue.delete() },
                { merge: true }
            );
        }
        alert('Token Discogs supprimé.');
    } else {
        discogsToken = newToken.trim();
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).set(
                { discogsToken: discogsToken },
                { merge: true }
            );
        }
        alert('Token Discogs mis à jour !');
    }
});

// === Admin: Clear Database ===
clearDbBtn.addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;

    if (!confirm('⚠️ ATTENTION: Voulez-vous vraiment vider toute la base de données ?\nCette action est irréversible !')) return;
    if (!confirm('\u{1F6A8} DERNIERE CONFIRMATION: Tous les vinyles seront définitivement supprimés. Continuer ?')) return;

    try {
        clearDbBtn.classList.add('searching');
        clearDbBtn.textContent = '⏳ Suppression…';

        const snapshot = await getUserVinylsRef().get();
        const ids = snapshot.docs.map(d => d.id);

        for (let i = 0; i < ids.length; i += 500) {
            const batch = db.batch();
            const chunk = ids.slice(i, i + 500);
            chunk.forEach(id => batch.delete(getUserVinylsRef().doc(id)));
            await batch.commit();
        }

        alert(`Base vidée ! ${ids.length} vinyle(s) supprimé(s).`);
    } catch (err) {
        alert('Erreur: ' + err.message);
    } finally {
        clearDbBtn.classList.remove('searching');
        clearDbBtn.innerHTML = '<span class="material-symbols-outlined">delete_sweep</span> Vider la base';
    }
});

// === Admin: Manage Users ===
adminUsersBtn.addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;
    adminModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    await loadAdminUsers();
});

adminModalClose.addEventListener('click', () => {
    adminModal.classList.add('hidden');
    document.body.style.overflow = '';
});

document.querySelector('#adminModal .modal-overlay')?.addEventListener('click', () => {
    adminModal.classList.add('hidden');
    document.body.style.overflow = '';
});

async function loadAdminUsers() {
    adminUsersList.innerHTML = '<p>Chargement…</p>';
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

        if (users.length === 0) {
            adminUsersList.innerHTML = '<p>Aucun utilisateur trouvé.</p>';
            return;
        }

        adminUsersList.innerHTML = users.map(u => `
            <div class="admin-user-row" data-uid="${u.uid}">
                <div class="admin-user-info">
                    <strong>${esc(u.displayName || 'Sans nom')}</strong>
                    <span class="admin-user-email">${esc(u.email || '')}</span>
                </div>
                <select class="admin-role-select" data-uid="${u.uid}">
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="user" ${u.role === 'user' || !u.role ? 'selected' : ''}>Utilisateur</option>
                    <option value="guest" ${u.role === 'guest' ? 'selected' : ''}>Invité</option>
                </select>
            </div>
        `).join('');

        adminUsersList.querySelectorAll('.admin-role-select').forEach(sel => {
            sel.addEventListener('change', async () => {
                const uid = sel.dataset.uid;
                const newRole = sel.value;
                try {
                    await db.collection('users').doc(uid).set({ role: newRole }, { merge: true });
                    // If changing own role (unlikely for admin but just in case)
                    if (uid === currentUser.uid) {
                        currentUserRole = newRole;
                        applyRoleUI();
                    }
                } catch (err) {
                    alert('Erreur: ' + err.message);
                    await loadAdminUsers(); // Reload to show correct state
                }
            });
        });
    } catch (err) {
        adminUsersList.innerHTML = `<p>Erreur: ${esc(err.message)}</p>`;
    }
}

// === Admin: Clé API Anthropic ===
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyModalClose = document.getElementById('apiKeyModalClose');
const adminApiKeyInput = document.getElementById('adminApiKeyInput');
const adminApiKeyToggle = document.getElementById('adminApiKeyToggle');
const adminApiKeySave = document.getElementById('adminApiKeySave');
const adminApiKeyStatus = document.getElementById('adminApiKeyStatus');

document.getElementById('adminApiKeyBtn').addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;
    apiKeyModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    adminApiKeyStatus.textContent = '';
    // Charger la clé actuelle
    try {
        const doc = await db.collection('config').doc('anthropic').get();
        adminApiKeyInput.value = (doc.exists && doc.data().apiKey) ? doc.data().apiKey : '';
    } catch (err) {
        adminApiKeyInput.value = '';
    }
});

apiKeyModalClose.addEventListener('click', () => {
    apiKeyModal.classList.add('hidden');
    document.body.style.overflow = '';
});

document.querySelector('#apiKeyModal .modal-overlay')?.addEventListener('click', () => {
    apiKeyModal.classList.add('hidden');
    document.body.style.overflow = '';
});

adminApiKeyToggle.addEventListener('click', () => {
    const isPassword = adminApiKeyInput.type === 'password';
    adminApiKeyInput.type = isPassword ? 'text' : 'password';
    adminApiKeyToggle.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
});

adminApiKeySave.addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;
    const key = adminApiKeyInput.value.trim();
    adminApiKeySave.disabled = true;
    adminApiKeyStatus.textContent = 'Enregistrement…';
    adminApiKeyStatus.className = 'admin-apikey-status';
    try {
        await db.collection('config').doc('anthropic').set({ apiKey: key });
        cachedAnthropicApiKey = key;
        adminApiKeyStatus.textContent = key ? '✓ Clé enregistrée' : '✓ Clé supprimée';
        adminApiKeyStatus.classList.add('admin-apikey-success');
    } catch (err) {
        adminApiKeyStatus.textContent = 'Erreur : ' + err.message;
        adminApiKeyStatus.classList.add('admin-apikey-error');
    } finally {
        adminApiKeySave.disabled = false;
    }
});

// === Admin: Prompt IA ===
const iaPromptModal = document.getElementById('iaPromptModal');
const iaPromptModalClose = document.getElementById('iaPromptModalClose');
const iaPromptTextarea = document.getElementById('iaPromptTextarea');
const iaPromptSave = document.getElementById('iaPromptSave');
const iaPromptReset = document.getElementById('iaPromptReset');
const iaPromptStatus = document.getElementById('iaPromptStatus');

document.getElementById('adminIaPromptBtn').addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;
    iaPromptModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    iaPromptStatus.textContent = '';
    // Charger le prompt actuel
    try {
        const doc = await db.collection('config').doc('iaPrompt').get();
        iaPromptTextarea.value = (doc.exists && doc.data().prompt) ? doc.data().prompt : IA_SYSTEM_PROMPT;
    } catch (err) {
        iaPromptTextarea.value = IA_SYSTEM_PROMPT;
    }
});

iaPromptModalClose.addEventListener('click', () => {
    iaPromptModal.classList.add('hidden');
    document.body.style.overflow = '';
});

document.querySelector('#iaPromptModal .modal-overlay')?.addEventListener('click', () => {
    iaPromptModal.classList.add('hidden');
    document.body.style.overflow = '';
});

iaPromptReset.addEventListener('click', () => {
    iaPromptTextarea.value = IA_SYSTEM_PROMPT;
});

iaPromptSave.addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;
    const prompt = iaPromptTextarea.value.trim();
    iaPromptSave.disabled = true;
    iaPromptStatus.textContent = 'Enregistrement…';
    iaPromptStatus.className = 'admin-apikey-status';
    try {
        if (prompt === IA_SYSTEM_PROMPT || !prompt) {
            await db.collection('config').doc('iaPrompt').delete();
            cachedIaPrompt = '';
            iaPromptStatus.textContent = '✓ Prompt réinitialisé (par défaut)';
        } else {
            await db.collection('config').doc('iaPrompt').set({ prompt });
            cachedIaPrompt = prompt;
            iaPromptStatus.textContent = '✓ Prompt enregistré';
        }
        iaPromptStatus.classList.add('admin-apikey-success');
    } catch (err) {
        iaPromptStatus.textContent = 'Erreur : ' + err.message;
        iaPromptStatus.classList.add('admin-apikey-error');
    } finally {
        iaPromptSave.disabled = false;
    }
});

// === Actualiser prompt IA ===
function buildCatalogueFromVinyls() {
    const byNote = {};
    for (const v of vinyls) {
        const note = v.goût;
        if (note === '' || note == null) continue;
        if (!byNote[note]) byNote[note] = [];
        byNote[note].push(`${v.artiste} - ${v.album}`);
    }
    const notes = Object.keys(byNote).sort((a, b) => parseFloat(b) - parseFloat(a));
    if (notes.length === 0) return '';
    let result = 'CATALOGUE DE RÉFÉRENCE DE PIERRE :\n';
    for (const note of notes) {
        const label = GOUT_LABELS[note] || '';
        result += `NOTE ${note} (${label}) :\n`;
        result += byNote[note].sort().join(' | ') + '\n';
    }
    return result;
}

async function genererProfilSynthétique(catalogueText) {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) return '';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 800,
            system: `Tu es un analyste musical. On te donne le catalogue de vinyles de Pierre avec ses notes (0=Déteste, 6=Vibre/frissons). Génère un PROFIL SYNTHÉTIQUE concis de ses goûts musicaux en bullet points (commençant par "- "). Identifie : genres/styles préférés, artistes récurrents dans les notes hautes, patterns (acoustique vs électrique, époques, labels, etc.), ce qu'il n'aime pas (notes basses). Sois précis et factuel, base-toi uniquement sur les données. Pas de titre, juste les bullet points.`,
            messages: [{ role: 'user', content: catalogueText }]
        })
    });
    if (!resp.ok) throw new Error(`Erreur API (${resp.status})`);
    const data = await resp.json();
    return data.content?.[0]?.text || '';
}

document.getElementById('updatePromptBtn').addEventListener('click', async () => {
    if (currentUserRole !== 'admin') return;
    const btn = document.getElementById('updatePromptBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Actualisation…';

    try {
        const catalogueText = buildCatalogueFromVinyls();
        if (!catalogueText) {
            alert('Aucun vinyle noté dans la base.');
            return;
        }

        // Get current prompt
        let prompt = getIaPrompt();

        // Generate new profile via Anthropic
        let profilText = '';
        try {
            profilText = await genererProfilSynthétique(catalogueText);
        } catch (err) {
            console.warn('Impossible de générer le profil IA:', err);
        }

        // Replace CATALOGUE section
        const catalogueRegex = /CATALOGUE DE RÉFÉRENCE[^\n]*:\n[\s\S]*?(?=PROFIL SYNTHÉTIQUE|FORMAT DE RÉPONSE)/;
        const profilRegex = /PROFIL SYNTHÉTIQUE[^\n]*:\n[\s\S]*?(?=FORMAT DE RÉPONSE)/;

        if (catalogueRegex.test(prompt)) {
            prompt = prompt.replace(catalogueRegex, catalogueText);
        } else {
            // Insert before FORMAT DE RÉPONSE if no existing catalogue section
            const formatIdx = prompt.indexOf('FORMAT DE RÉPONSE');
            if (formatIdx !== -1) {
                prompt = prompt.substring(0, formatIdx) + catalogueText + '\n' + prompt.substring(formatIdx);
            } else {
                prompt += '\n' + catalogueText;
            }
        }

        // Replace PROFIL SYNTHÉTIQUE section
        if (profilText) {
            const newProfil = 'PROFIL SYNTHÉTIQUE :\n' + profilText + '\n';
            if (profilRegex.test(prompt)) {
                prompt = prompt.replace(profilRegex, newProfil);
            } else {
                const formatIdx = prompt.indexOf('FORMAT DE RÉPONSE');
                if (formatIdx !== -1) {
                    prompt = prompt.substring(0, formatIdx) + newProfil + prompt.substring(formatIdx);
                }
            }
        }

        // Open prompt modal with updated content
        iaPromptModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        iaPromptTextarea.value = prompt;
        iaPromptStatus.textContent = profilText
            ? '✓ Catalogue et profil actualisés. Vérifiez et enregistrez.'
            : '✓ Catalogue actualisé (profil non régénéré). Vérifiez et enregistrez.';
        iaPromptStatus.className = 'admin-apikey-status admin-apikey-success';

    } catch (err) {
        alert('Erreur lors de l\'actualisation : ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">refresh</span> Actualiser prompt IA';
    }
});

// === Styles Manager ===
const manageStylesBtn = document.getElementById('manageStylesBtn');
const stylesModal = document.getElementById('stylesModal');
const stylesModalClose = document.getElementById('stylesModalClose');
const stylesFilterInput = document.getElementById('stylesFilterInput');
const stylesCount = document.getElementById('stylesCount');
const stylesManagerList = document.getElementById('stylesManagerList');

manageStylesBtn.addEventListener('click', () => {
    if (currentUserRole === 'guest') return;
    stylesModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    stylesFilterInput.value = '';
    loadGenreManager();
});

stylesModalClose.addEventListener('click', closeGenreModal);
document.querySelector('#stylesModal .modal-overlay')?.addEventListener('click', closeGenreModal);

function closeGenreModal() {
    stylesModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function getGenreMap() {
    const map = new Map();
    vinyls.forEach(v => {
        (v.genre || []).forEach(s => {
            if (!map.has(s)) map.set(s, []);
            map.get(s).push(v.id);
        });
    });
    return map;
}

function loadGenreManager(filterText) {
    const map = getGenreMap();
    const filter = (filterText || '').toLowerCase().trim();

    let entries = [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'fr'));

    if (filter) {
        entries = entries.filter(([name]) => name.toLowerCase().includes(filter));
    }

    stylesCount.textContent = `${entries.length} genre${entries.length > 1 ? 's' : ''} (${map.size} total)`;

    if (entries.length === 0) {
        stylesManagerList.innerHTML = filter
            ? '<p class="styles-empty">Aucun genre correspondant.</p>'
            : '<p class="styles-empty">Aucun genre dans la collection.</p>';
        return;
    }

    stylesManagerList.innerHTML = entries.map(([name, ids]) => `
        <div class="style-row" data-style="${esc(name)}">
            <div class="style-row-info">
                <span class="tag tag-style">${esc(name)}</span>
                <button class="btn btn-small style-show-albums" data-style="${esc(name)}" title="Filtrer par ce style"><span class="material-symbols-outlined">visibility</span> ${ids.length} album${ids.length > 1 ? 's' : ''}</button>
            </div>
            <div class="style-row-actions">
                <button class="btn btn-small style-rename-btn" data-style="${esc(name)}" title="Renommer ou fusionner">✎ Renommer</button>
                <button class="btn btn-small btn-danger style-delete-btn" data-style="${esc(name)}" title="Supprimer ce style de tous les vinyles">✕</button>
            </div>
        </div>
    `).join('');

    // Attach rename handlers
    stylesManagerList.querySelectorAll('.style-rename-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const oldName = btn.dataset.style;
            const allStyles = [...map.keys()].sort();
            const newName = prompt(`Renommer "${oldName}" en :\n\n(Si le nouveau nom existe déjà, les deux genres seront fusionnés)`, oldName);
            if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
            await renameGenre(oldName, newName.trim());
        });
    });

    // Attach delete handlers
    stylesManagerList.querySelectorAll('.style-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const styleName = btn.dataset.style;
            const count = map.get(styleName)?.length || 0;
            if (!confirm(`Supprimer le style "${styleName}" de ${count} vinyle${count > 1 ? 's' : ''} ?`)) return;
            await deleteGenre(styleName);
        });
    });

    // Attach "show albums" handlers on count buttons
    stylesManagerList.querySelectorAll('.style-show-albums').forEach(btn => {
        btn.addEventListener('click', () => {
            const styleName = btn.dataset.style;
            closeGenreModal();
            // Set the style filter and trigger render
            filterGenre.value = styleName;
            render();
        });
    });
}

stylesFilterInput.addEventListener('input', () => {
    loadGenreManager(stylesFilterInput.value);
});

async function deleteGenre(styleName) {
    const affected = vinyls.filter(v => (v.genre || []).includes(styleName));
    if (affected.length === 0) return;

    const updates = affected.map(v => ({
        id: v.id,
        genre: (v.genre || []).filter(s => s !== styleName)
    }));

    try {
        await batchUpdateVinylGenres(updates);
        loadGenreManager(stylesFilterInput.value);
    } catch (err) {
        alert('Erreur: ' + err.message);
    }
}

async function renameGenre(oldName, newName) {
    const map = getGenreMap();
    const isFusion = map.has(newName);

    if (isFusion) {
        const oldCount = map.get(oldName)?.length || 0;
        const newCount = map.get(newName)?.length || 0;
        if (!confirm(`Le genre "${newName}" existe déjà (${newCount} album${newCount > 1 ? 's' : ''}).\nFusionner "${oldName}" (${oldCount}) dans "${newName}" ?`)) return;
    }

    const affected = vinyls.filter(v => (v.genre || []).includes(oldName));
    if (affected.length === 0) return;

    const updates = affected.map(v => {
        let newStyles = (v.genre || []).map(s => s === oldName ? newName : s);
        // Remove duplicates (in case of fusion)
        newStyles = [...new Set(newStyles)];
        return { id: v.id, genre: newStyles };
    });

    try {
        await batchUpdateVinylGenres(updates);
        loadGenreManager(stylesFilterInput.value);
    } catch (err) {
        alert('Erreur: ' + err.message);
    }
}

async function batchUpdateVinylGenres(updates) {
    if (!currentUser) return;
    const ref = getUserVinylsRef();
    for (let i = 0; i < updates.length; i += 500) {
        const batch = db.batch();
        updates.slice(i, i + 500).forEach(u => {
            batch.set(ref.doc(u.id), { genre: u.genre }, { merge: true });
        });
        await batch.commit();
    }
}

// === CSV Import ===
csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const text = evt.target.result;
        const imported = parseCSV(text);
        if (imported.length === 0) {
            alert('Aucune fiche trouvée dans le CSV.');
            return;
        }
        try {
            await firestoreBatchAdd(imported);
            alert(`${imported.length} vinyle(s) importé(s).`);
        } catch (err) {
            alert('Erreur lors de l\'import: ' + err.message);
        }
    };
    reader.readAsText(file, 'UTF-8');
    csvInput.value = '';
});

function parseCSV(text) {
    const lines = parseCSVLines(text);
    if (lines.length < 2) return [];

    const rawHeaders = lines[0].map(h => h.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    const headerMap = {};
    const fieldAliases = {
        'categorie': ['categorie', 'categories', 'cat', 'rangement', 'rangements'],
        'classe': ['classe', 'class'],
        'artiste': ['artiste', 'artist', 'artistes'],
        'album': ['album', 'titre', 'title'],
        'annee': ['annee', 'année', 'year', 'an'],
        'label': ['label', 'maison'],
        'reference': ['reference', 'ref', 'ref.'],
        'gout': ['gout', 'goût', 'note'],
        'audio': ['audio', 'son', 'qualite'],
        'energie': ['energie', 'energy', 'nrj'],
        'nb': ['nb', 'ecoutes', 'nombre', 'nb ecoutes'],
        'prix': ['prix', 'price', 'cout'],
        'achete': ['achete', 'achat', 'ou', 'magasin', 'achete ou'],
        'lieu': ['lieu', 'location', 'emplacement'],
        'avisia': ['avisia', 'avis ia', 'avis_ia', 'ia'],
        'commentaire': ['commentaire', 'comment', 'notes', 'remarque'],
        'coverurl': ['coverurl', 'pochette', 'cover', 'image', 'photo', 'artwork', 'url cover'],
        'genre': ['genre', 'genres', 'styles', 'style', 'sous-genre', 'sous genre', 'sub-genre'],
        'discogsurl': ['discogsurl', 'discogs', 'discogs url', 'lien discogs', 'discogs link']
    };

    rawHeaders.forEach((h, i) => {
        for (const [field, aliases] of Object.entries(fieldAliases)) {
            if (aliases.includes(h)) {
                headerMap[field] = i;
                break;
            }
        }
    });

    // Diagnostic : colonnes non reconnues
    const unmapped = rawHeaders.filter((h, i) =>
        !Object.values(headerMap).includes(i)
    );
    if (unmapped.length > 0) {
        console.warn('CSV Import — colonnes non reconnues:', unmapped);
    }
    console.log('CSV Import — délimiteur:', JSON.stringify(detectCSVDelimiter(text)),
        '| colonnes:', lines[0].length,
        '| lignes:', lines.length - 1,
        '| headerMap:', JSON.stringify(headerMap));

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i];
        if (cols.length === 0 || cols.every(c => c.trim() === '')) continue;

        const get = (field) => {
            const idx = headerMap[field];
            return idx !== undefined && cols[idx] !== undefined ? cols[idx].trim() : '';
        };

        // Diagnostic sur la première ligne de données
        if (i === 1) {
            console.log('CSV Import — 1ère ligne, nb colonnes:', cols.length,
                '| prix brut:', JSON.stringify(get('prix')),
                '| artiste:', JSON.stringify(get('artiste')));
        }

        const artiste = get('artiste');
        const album = get('album');
        if (!artiste && !album) continue;

        const catStr = get('categorie');
        const categorie = catStr ? catStr.split(/[;,|]/).map(c => c.trim()).filter(Boolean) : [];

        const genreStr = get('genre');
        const genre = genreStr ? genreStr.split(/[;,|]/).map(s => s.trim()).filter(Boolean) : [];

        const goutVal = get('gout').match(/\d+/)?.[0] || '';
        const audioVal = get('audio').match(/\d+/)?.[0] || '';
        const energieVal = get('energie').match(/\d+/)?.[0] || '';

        results.push({
            id: crypto.randomUUID(),
            dateAjout: new Date().toISOString(),
            categorie,
            classé: get('classe') || 'Non',
            artiste,
            album,
            année: get('annee'),
            label: get('label'),
            référence: get('reference'),
            goût: goutVal,
            audio: audioVal,
            energie: energieVal,
            nb: get('nb') || '0',
            prix: cleanPrix(get('prix')),
            acheté: get('achete'),
            lieu: get('lieu'),
            avisIA: get('avisia'),
            commentaire: get('commentaire'),
            coverUrl: get('coverurl'),
            genre,
            discogsUrl: get('discogsurl'),
        });
    }
    return results;
}

function detectCSVDelimiter(text) {
    // Analyse la première ligne (hors quotes) pour détecter le délimiteur
    let inQuotes = false;
    let semicolons = 0, commas = 0, tabs = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (inQuotes) continue;
        if (ch === '\n' || ch === '\r') break;
        if (ch === ';') semicolons++;
        else if (ch === ',') commas++;
        else if (ch === '\t') tabs++;
    }
    if (semicolons >= commas && semicolons >= tabs) return ';';
    if (tabs >= commas) return '\t';
    return ',';
}

function parseCSVLines(text) {
    const delimiter = detectCSVDelimiter(text);
    const lines = [];
    let current = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                current.push(field);
                field = '';
            } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                current.push(field);
                field = '';
                lines.push(current);
                current = [];
                if (ch === '\r') i++;
            } else if (ch === '\r') {
                current.push(field);
                field = '';
                lines.push(current);
                current = [];
            } else {
                field += ch;
            }
        }
    }
    if (field || current.length > 0) {
        current.push(field);
        lines.push(current);
    }
    return lines;
}

// === Backup & Versioning ===
let googleAccessToken = null;
let tokenExpiry = 0;
let backupSettings = { frequency: 'manual', lastBackup: null, driveEnabled: false, driveFolderId: null };
const DRIVE_FOLDER_NAME = 'Vinylthèque Backup';
const MAX_DRIVE_BACKUPS = 30;
const MAX_FIRESTORE_SNAPSHOTS = 10;

// -- Google token management --
function storeGoogleToken(accessToken) {
    googleAccessToken = accessToken;
    tokenExpiry = Date.now() + 3500000; // ~58 min
    try {
        sessionStorage.setItem('gdriveToken', accessToken);
        sessionStorage.setItem('gdriveTokenExpiry', String(tokenExpiry));
    } catch (e) {}
}

function restoreGoogleToken() {
    try {
        const t = sessionStorage.getItem('gdriveToken');
        const exp = parseInt(sessionStorage.getItem('gdriveTokenExpiry') || '0');
        if (t && Date.now() < exp) {
            googleAccessToken = t;
            tokenExpiry = exp;
            return true;
        }
    } catch (e) {}
    return false;
}

function isGoogleTokenValid() {
    return googleAccessToken && Date.now() < tokenExpiry;
}

async function ensureDriveToken() {
    if (isGoogleTokenValid()) return true;
    return await authorizeDrive();
}

async function authorizeDrive() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
        const result = await currentUser.reauthenticateWithPopup(provider);
        if (result.credential && result.credential.accessToken) {
            storeGoogleToken(result.credential.accessToken);
            backupSettings.driveEnabled = true;
            try { localStorage.setItem('driveBackupEnabled', 'true'); } catch (e) {}
            await saveBackupSettings();
            updateDriveStatusUI(true);
            return true;
        }
    } catch (err) {
        console.error('Drive auth error:', err);
        if (err.code !== 'auth/popup-closed-by-user') {
            alert('Erreur d\'autorisation Google Drive : ' + err.message);
        }
    }
    return false;
}

// -- Google Drive API helpers --
async function driveFetch(url, options = {}) {
    const headers = { 'Authorization': 'Bearer ' + googleAccessToken, ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        googleAccessToken = null;
        tokenExpiry = 0;
        return null;
    }
    return res;
}

async function driveGetOrCreateFolder() {
    // Check cached folder
    if (backupSettings.driveFolderId) {
        const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + backupSettings.driveFolderId + '?fields=id,trashed');
        if (res && res.ok) {
            const data = await res.json();
            if (!data.trashed) return backupSettings.driveFolderId;
        }
        backupSettings.driveFolderId = null;
    }
    // Search existing
    const q = encodeURIComponent("name='" + DRIVE_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const searchRes = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)');
    if (searchRes && searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
            backupSettings.driveFolderId = data.files[0].id;
            await saveBackupSettings();
            return data.files[0].id;
        }
    }
    // Create folder
    const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
    if (createRes && createRes.ok) {
        const data = await createRes.json();
        backupSettings.driveFolderId = data.id;
        await saveBackupSettings();
        return data.id;
    }
    return null;
}

async function driveUploadBackup(jsonData, fileName) {
    const folderId = await driveGetOrCreateFolder();
    if (!folderId) return null;

    const metadata = { name: fileName, mimeType: 'application/json', parents: [folderId] };
    const boundary = '---backup_boundary_' + Date.now();
    const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
        jsonData + '\r\n--' + boundary + '--';

    const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body
    });
    if (res && res.ok) return await res.json();
    return null;
}

async function driveListBackups() {
    if (!backupSettings.driveFolderId) return [];
    const q = encodeURIComponent("'" + backupSettings.driveFolderId + "' in parents and trashed=false");
    const res = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=50');
    if (res && res.ok) {
        const data = await res.json();
        return data.files || [];
    }
    return [];
}

async function driveDownloadBackup(fileId) {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media');
    if (res && res.ok) return await res.json();
    return null;
}

async function driveDeleteFile(fileId) {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + fileId, { method: 'DELETE' });
    return res && res.ok;
}

async function driveCleanupOldBackups() {
    const files = await driveListBackups();
    if (files.length > MAX_DRIVE_BACKUPS) {
        const toDelete = files.slice(MAX_DRIVE_BACKUPS);
        for (const file of toDelete) {
            await driveDeleteFile(file.id);
        }
    }
}

// -- Firestore snapshots (versioning local) --
function getSnapshotsRef() {
    return db.collection('users').doc(currentUser.uid).collection('snapshots');
}

async function createFirestoreSnapshot(type) {
    if (!currentUser || vinyls.length === 0) return null;
    const data = JSON.stringify(vinyls);
    if (data.length > 800000) {
        console.warn('Snapshot trop volumineux pour Firestore (' + Math.round(data.length / 1024) + ' Ko)');
        return null;
    }
    const ref = await getSnapshotsRef().add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: type,
        count: vinyls.length,
        data: data
    });
    await cleanupFirestoreSnapshots();
    return ref.id;
}

async function getFirestoreSnapshots() {
    if (!currentUser) return [];
    const snapshot = await getSnapshotsRef().orderBy('timestamp', 'desc').limit(MAX_FIRESTORE_SNAPSHOTS).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function restoreFromData(dataArray, source) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
        alert('Données de sauvegarde invalides.');
        return;
    }
    if (!confirm('Restaurer ' + dataArray.length + ' vinyle(s) depuis ' + source + ' ?\nLes données actuelles seront remplacées.\n\nUn point de restauration sera créé avant.')) return;

    // Create safety snapshot before restore
    await createFirestoreSnapshot('auto');

    // Clear current data
    const currentDocs = await getUserVinylsRef().get();
    const currentIds = currentDocs.docs.map(d => d.id);
    for (let i = 0; i < currentIds.length; i += 500) {
        const batch = db.batch();
        currentIds.slice(i, i + 500).forEach(id => batch.delete(getUserVinylsRef().doc(id)));
        await batch.commit();
    }

    // Import backup data
    dataArray.forEach(v => { if (!v.id) v.id = crypto.randomUUID(); });
    await firestoreBatchAdd(dataArray);
    alert('Restauration terminée ! ' + dataArray.length + ' vinyle(s) restauré(s).');
}

async function cleanupFirestoreSnapshots() {
    const snapshots = await getSnapshotsRef().orderBy('timestamp', 'desc').get();
    if (snapshots.size > MAX_FIRESTORE_SNAPSHOTS) {
        const toDelete = snapshots.docs.slice(MAX_FIRESTORE_SNAPSHOTS);
        for (let i = 0; i < toDelete.length; i += 500) {
            const batch = db.batch();
            toDelete.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }
}

// -- Backup settings persistence --
async function loadBackupSettings() {
    if (!currentUser) return;
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists && doc.data().backupSettings) {
        Object.assign(backupSettings, doc.data().backupSettings);
    }
}

async function saveBackupSettings() {
    if (!currentUser) return;
    await db.collection('users').doc(currentUser.uid).set({ backupSettings }, { merge: true });
}

// -- Backup scheduling --
let backupIntervalId = null;

async function initBackupScheduler() {
    await loadBackupSettings();
    restoreGoogleToken();
    updateBackupUI();
    checkAndRunBackup();
    if (backupIntervalId) clearInterval(backupIntervalId);
    backupIntervalId = setInterval(checkAndRunBackup, 30 * 60 * 1000);
}

async function checkAndRunBackup() {
    if (backupSettings.frequency === 'manual') return;
    if (!backupSettings.lastBackup) {
        await runAutomaticBackup();
        return;
    }
    const lastBackup = typeof backupSettings.lastBackup === 'string' ? new Date(backupSettings.lastBackup) : (backupSettings.lastBackup.toDate ? backupSettings.lastBackup.toDate() : new Date(backupSettings.lastBackup));
    const diffHours = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
    if (backupSettings.frequency === 'daily' && diffHours >= 24) {
        await runAutomaticBackup();
    } else if (backupSettings.frequency === 'weekly' && diffHours >= 168) {
        await runAutomaticBackup();
    }
}

async function runAutomaticBackup() {
    try {
        await createFirestoreSnapshot('auto');

        if (backupSettings.driveEnabled && isGoogleTokenValid()) {
            const jsonData = JSON.stringify(vinyls, null, 2);
            const now = new Date();
            const fileName = 'vinyles_' + now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 5).replace(':', 'h') + '.json';
            await driveUploadBackup(jsonData, fileName);
            await driveCleanupOldBackups();
        }

        backupSettings.lastBackup = new Date().toISOString();
        await saveBackupSettings();
        updateBackupUI();
        console.log('Backup automatique effectué');
    } catch (err) {
        console.error('Erreur backup auto:', err);
    }
}

async function runManualDriveBackup() {
    if (!(await ensureDriveToken())) {
        alert('Impossible de se connecter à Google Drive.');
        return;
    }
    try {
        const jsonData = JSON.stringify(vinyls, null, 2);
        const now = new Date();
        const fileName = 'vinyles_' + now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 5).replace(':', 'h') + '.json';

        await createFirestoreSnapshot('manual');
        const result = await driveUploadBackup(jsonData, fileName);
        if (result) {
            await driveCleanupOldBackups();
            backupSettings.lastBackup = new Date().toISOString();
            await saveBackupSettings();
            updateBackupUI();
            alert('Sauvegarde envoyée sur Google Drive !\nFichier : ' + fileName);
            await refreshBackupList();
        } else {
            alert('Erreur lors de l\'envoi sur Google Drive.');
        }
    } catch (err) {
        console.error('Manual backup error:', err);
        alert('Erreur de sauvegarde : ' + err.message);
    }
}

// -- Backup UI --
function updateDriveStatusUI(connected) {
    const statusEl = document.getElementById('driveStatus');
    const connectBtn = document.getElementById('driveConnectBtn');
    const backupNowBtn = document.getElementById('driveBackupNowBtn');
    if (!statusEl) return;

    if (connected) {
        statusEl.innerHTML = '<span class="backup-status-dot connected"></span><span>Connecté</span>';
        connectBtn.textContent = 'Reconnecter';
        connectBtn.classList.remove('btn-primary');
        connectBtn.classList.add('btn-secondary');
        backupNowBtn.classList.remove('hidden');
    } else {
        statusEl.innerHTML = '<span class="backup-status-dot disconnected"></span><span>Non connecté</span>';
        connectBtn.textContent = 'Connecter Google Drive';
        connectBtn.classList.add('btn-primary');
        connectBtn.classList.remove('btn-secondary');
        backupNowBtn.classList.add('hidden');
    }
}

function updateBackupUI() {
    const freqEl = document.getElementById('backupFrequency');
    const lastInfoEl = document.getElementById('lastBackupInfo');
    if (!freqEl) return;

    freqEl.value = backupSettings.frequency;

    if (backupSettings.lastBackup) {
        const d = typeof backupSettings.lastBackup === 'string' ? new Date(backupSettings.lastBackup) : (backupSettings.lastBackup.toDate ? backupSettings.lastBackup.toDate() : new Date(backupSettings.lastBackup));
        lastInfoEl.textContent = 'Dernière sauvegarde : ' + d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else {
        lastInfoEl.textContent = 'Aucune sauvegarde effectuée';
    }

    updateDriveStatusUI(backupSettings.driveEnabled && isGoogleTokenValid());
}

async function refreshBackupList() {
    const listEl = document.getElementById('backupList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="backup-empty">Chargement...</p>';

    const items = [];

    // Firestore snapshots
    try {
        const snapshots = await getFirestoreSnapshots();
        snapshots.forEach(s => {
            const ts = s.timestamp && s.timestamp.toDate ? s.timestamp.toDate() : (s.timestamp ? new Date(s.timestamp) : new Date());
            items.push({ source: 'firestore', id: s.id, date: ts, count: s.count, subType: s.type });
        });
    } catch (e) { console.error('Erreur chargement snapshots:', e); }

    // Drive backups
    if (backupSettings.driveEnabled && isGoogleTokenValid()) {
        try {
            const driveFiles = await driveListBackups();
            driveFiles.forEach(f => {
                items.push({ source: 'drive', id: f.id, date: new Date(f.createdTime), name: f.name, size: f.size });
            });
        } catch (e) { console.error('Erreur chargement Drive:', e); }
    }

    items.sort((a, b) => b.date - a.date);

    if (items.length === 0) {
        listEl.innerHTML = '<p class="backup-empty">Aucune sauvegarde disponible</p>';
        return;
    }

    listEl.innerHTML = items.map(item => {
        const dateStr = item.date.toLocaleDateString('fr-FR') + ' ' + item.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        if (item.source === 'drive') {
            const sizeKB = item.size ? Math.round(item.size / 1024) : '?';
            return '<div class="backup-item" data-source="drive" data-id="' + esc(item.id) + '">' +
                '<div class="backup-item-info">' +
                    '<div class="backup-item-date">' + esc(dateStr) + ' <span class="backup-item-type backup-type-drive">Drive</span></div>' +
                    '<div class="backup-item-meta">' + esc(item.name) + ' · ' + sizeKB + ' Ko</div>' +
                '</div>' +
                '<div class="backup-item-actions">' +
                    '<button class="btn btn-small backup-restore-btn" title="Restaurer"><span class="material-symbols-outlined">restore</span></button>' +
                    '<button class="btn btn-small backup-download-btn" title="Télécharger"><span class="material-symbols-outlined">download</span></button>' +
                    '<button class="btn btn-small backup-delete-btn" title="Supprimer"><span class="material-symbols-outlined">delete</span></button>' +
                '</div></div>';
        } else {
            const typeLabel = item.subType === 'auto' ? 'Auto' : 'Manuel';
            const typeClass = item.subType === 'auto' ? 'backup-type-auto' : 'backup-type-manual';
            return '<div class="backup-item" data-source="firestore" data-id="' + esc(item.id) + '">' +
                '<div class="backup-item-info">' +
                    '<div class="backup-item-date">' + esc(dateStr) + ' <span class="backup-item-type ' + typeClass + '">' + typeLabel + '</span></div>' +
                    '<div class="backup-item-meta">' + item.count + ' vinyle(s) · Local</div>' +
                '</div>' +
                '<div class="backup-item-actions">' +
                    '<button class="btn btn-small backup-restore-btn" title="Restaurer"><span class="material-symbols-outlined">restore</span></button>' +
                    '<button class="btn btn-small backup-delete-btn" title="Supprimer"><span class="material-symbols-outlined">delete</span></button>' +
                '</div></div>';
        }
    }).join('');

    // Event delegation for backup actions
    listEl.querySelectorAll('.backup-restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = e.target.closest('.backup-item');
            const source = item.dataset.source;
            const id = item.dataset.id;
            if (source === 'firestore') {
                const doc = await getSnapshotsRef().doc(id).get();
                if (!doc.exists) { alert('Snapshot introuvable.'); return; }
                const data = JSON.parse(doc.data().data);
                await restoreFromData(data, 'le snapshot local');
            } else {
                if (!(await ensureDriveToken())) { alert('Token Drive expiré. Reconnectez Google Drive.'); return; }
                const data = await driveDownloadBackup(id);
                await restoreFromData(data, 'Google Drive');
            }
        });
    });

    listEl.querySelectorAll('.backup-download-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = e.target.closest('.backup-item');
            const id = item.dataset.id;
            if (!(await ensureDriveToken())) { alert('Token Drive expiré. Reconnectez Google Drive.'); return; }
            const data = await driveDownloadBackup(id);
            if (data) {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const meta = item.querySelector('.backup-item-meta');
                a.download = meta ? meta.textContent.split('·')[0].trim() : 'backup.json';
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert('Erreur de téléchargement.');
            }
        });
    });

    listEl.querySelectorAll('.backup-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Supprimer cette sauvegarde ?')) return;
            const item = e.target.closest('.backup-item');
            const source = item.dataset.source;
            const id = item.dataset.id;
            if (source === 'drive') {
                if (!(await ensureDriveToken())) { alert('Token Drive expiré.'); return; }
                await driveDeleteFile(id);
            } else {
                await getSnapshotsRef().doc(id).delete();
            }
            await refreshBackupList();
        });
    });
}

// -- Backup event listeners --
document.getElementById('backupBtn').addEventListener('click', async () => {
    document.getElementById('backupModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateBackupUI();
    await refreshBackupList();
});

document.getElementById('backupModalClose').addEventListener('click', () => {
    document.getElementById('backupModal').classList.add('hidden');
    document.body.style.overflow = '';
});

document.querySelector('#backupModal .modal-overlay').addEventListener('click', () => {
    document.getElementById('backupModal').classList.add('hidden');
    document.body.style.overflow = '';
});

document.getElementById('driveConnectBtn').addEventListener('click', async () => {
    await authorizeDrive();
    await refreshBackupList();
});

document.getElementById('driveBackupNowBtn').addEventListener('click', runManualDriveBackup);

document.getElementById('snapshotBtn').addEventListener('click', async () => {
    const id = await createFirestoreSnapshot('manual');
    if (id) {
        alert('Point de restauration créé !');
        await refreshBackupList();
    } else {
        alert('Erreur : collection vide ou trop volumineuse pour un snapshot local.\nUtilisez Google Drive pour les grandes collections.');
    }
});

document.getElementById('backupFrequency').addEventListener('change', async (e) => {
    backupSettings.frequency = e.target.value;
    await saveBackupSettings();
    updateBackupUI();
    if (backupSettings.frequency !== 'manual') {
        checkAndRunBackup();
    }
});

// === Export CSV ===
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    const headers = ['Classé', 'Rangement', 'Artiste', 'Album', 'Année', 'Label', 'Référence', 'Goût', 'Audio', 'Énergie', 'Nb', 'Prix', 'Acheté', 'Commentaire', 'Lieu', 'Genre', 'Discogs', 'Image', 'Avis IA'];

    function csvEscape(val) {
        if (!val) return '';
        const str = String(val);
        if (str.includes(';') || str.includes(',') || str.includes('\t') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    const rows = vinyls.map(v => {
        const goutText = v.goût && GOUT_LABELS[v.goût] ? `${v.goût} – ${GOUT_LABELS[v.goût]}` : v.goût || '';
        const audioText = v.audio && AUDIO_LABELS[v.audio] ? `${v.audio} – ${AUDIO_LABELS[v.audio]}` : v.audio || '';
        const energieText = v.energie && ENERGIE_LABELS[v.energie] ? `${v.energie} – ${ENERGIE_LABELS[v.energie]}` : v.energie || '';
        return [
            v.classé || '',
            (v.categorie || []).join(', '),
            v.artiste || '',
            v.album || '',
            v.année || '',
            v.label || '',
            v.référence || '',
            goutText,
            audioText,
            energieText,
            v.nb || '',
            v.prix || '',
            v.acheté || '',
            v.commentaire || '',
            v.lieu || '',
            (v.genre || []).join(', '),
            v.discogsUrl || '',
            v.coverUrl || '',
            v.avisIA || ''
        ].map(csvEscape).join(';');
    });

    const csv = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinyles_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// === Export / Import JSON ===
document.getElementById('exportBtn').addEventListener('click', () => {
    const data = JSON.stringify(vinyls, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinyles_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('jsonImport').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const imported = JSON.parse(evt.target.result);
            if (!Array.isArray(imported)) {
                alert('Fichier JSON invalide.');
                return;
            }
            imported.forEach(v => {
                if (!v.id) v.id = crypto.randomUUID();
            });
            await firestoreBatchAdd(imported);
            alert(`Import terminé ! ${imported.length} vinyle(s) importé(s)/mis à jour.`);
        } catch (err) {
            alert('Erreur de lecture du fichier JSON.');
        }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
});

// Keyboard: Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!modal.classList.contains('hidden')) {
            closeModal();
        } else if (!stylesModal.classList.contains('hidden')) {
            closeGenreModal();
        } else if (!apiKeyModal.classList.contains('hidden')) {
            apiKeyModal.classList.add('hidden');
            document.body.style.overflow = '';
        } else if (!iaPromptModal.classList.contains('hidden')) {
            iaPromptModal.classList.add('hidden');
            document.body.style.overflow = '';
        } else if (!adminModal.classList.contains('hidden')) {
            adminModal.classList.add('hidden');
            document.body.style.overflow = '';
        } else if (!document.getElementById('backupModal').classList.contains('hidden')) {
            document.getElementById('backupModal').classList.add('hidden');
            document.body.style.overflow = '';
        } else if (!tokenModal.classList.contains('hidden')) {
            tokenModal.classList.add('hidden');
        } else if (!document.getElementById('graph3dPopup').classList.contains('hidden')) {
            closeGraph3dPopup();
        }
    }
});

// === Hamburger Menu ===
const hamburgerBtn = document.getElementById('hamburgerBtn');
const hamburgerDropdown = document.getElementById('hamburgerDropdown');

hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hamburgerDropdown.classList.toggle('open');
});

// Close on click outside
document.addEventListener('click', (e) => {
    if (hamburgerDropdown.classList.contains('open') && !e.target.closest('.hamburger-menu')) {
        hamburgerDropdown.classList.remove('open');
    }
});

// Close after clicking any item (buttons and labels)
hamburgerDropdown.querySelectorAll('.hamburger-item').forEach(item => {
    item.addEventListener('click', () => {
        // Small delay for file inputs to register
        setTimeout(() => hamburgerDropdown.classList.remove('open'), 100);
    });
});

// === Vue 3D — Graphe par genre ===
let scene3d = null;
let camera3d = null;
let renderer3d = null;
let controls3d = null;
let graph3dAnimId = null;
let graph3dNodes = [];
let graph3dEdges = [];
let graph3dLineMesh = null;
let raycaster3d = null;
let mouse3d = null;
let graph3dInitialized = false;
let graph3dVinylsHash = '';

// Placeholder canvas pour les pochettes manquantes
function createPlaceholderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#FF6533';
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♫', 64, 64);
    return new THREE.CanvasTexture(canvas);
}

let placeholderTex = null;

function getPlaceholderTexture() {
    if (!placeholderTex) placeholderTex = createPlaceholderTexture();
    return placeholderTex;
}

function init3DScene() {
    const container = graph3dView;
    // Nettoyage si déjà initialisé
    if (renderer3d) {
        if (graph3dAnimId) cancelAnimationFrame(graph3dAnimId);
        renderer3d.dispose();
        container.innerHTML = '';
    }

    scene3d = new THREE.Scene();
    scene3d.background = new THREE.Color(0x0a0a12);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || (window.innerHeight - 200);
    camera3d = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
    camera3d.position.set(0, 0, 120);

    renderer3d = new THREE.WebGLRenderer({ antialias: true });
    renderer3d.setSize(w, h);
    renderer3d.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer3d.domElement);

    controls3d = new THREE.OrbitControls(camera3d, renderer3d.domElement);
    controls3d.enableDamping = true;
    controls3d.dampingFactor = 0.08;
    controls3d.minDistance = 10;
    controls3d.maxDistance = 500;

    raycaster3d = new THREE.Raycaster();
    mouse3d = new THREE.Vector2();

    // Lumière ambiante douce
    scene3d.add(new THREE.AmbientLight(0xffffff, 1));

    graph3dInitialized = true;
}

function buildGraph(list) {
    // Nettoyer les anciens nœuds et arêtes
    graph3dNodes.forEach(n => {
        scene3d.remove(n.mesh);
        if (n.mesh.material.map && n.mesh.material.map !== getPlaceholderTexture()) {
            n.mesh.material.map.dispose();
        }
        n.mesh.material.dispose();
        n.mesh.geometry.dispose();
    });
    if (graph3dLineMesh) {
        scene3d.remove(graph3dLineMesh);
        graph3dLineMesh.geometry.dispose();
        graph3dLineMesh.material.dispose();
        graph3dLineMesh = null;
    }
    graph3dNodes = [];
    graph3dEdges = [];

    if (list.length === 0) return;

    const nodeSize = 3;
    const geo = new THREE.PlaneGeometry(nodeSize, nodeSize);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';

    // Créer les nœuds
    list.forEach((v, i) => {
        let mat;
        if (v.coverUrl) {
            const tex = textureLoader.load(v.coverUrl, undefined, undefined, () => {
                // Fallback si le chargement échoue
                mat.map = getPlaceholderTexture();
                mat.needsUpdate = true;
            });
            tex.colorSpace = THREE.SRGBColorSpace;
            mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
        } else {
            mat = new THREE.MeshBasicMaterial({ map: getPlaceholderTexture(), side: THREE.DoubleSide });
        }

        const mesh = new THREE.Mesh(geo.clone(), mat);

        // Position initiale aléatoire en sphère
        const spread = Math.cbrt(list.length) * 12;
        mesh.position.set(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread
        );

        scene3d.add(mesh);
        graph3dNodes.push({
            mesh,
            vinyl: v,
            vx: 0, vy: 0, vz: 0  // vélocité pour force-directed
        });
    });

    // Créer les arêtes (genre en commun)
    for (let i = 0; i < list.length; i++) {
        const genresA = list[i].genre || [];
        if (genresA.length === 0) continue;
        for (let j = i + 1; j < list.length; j++) {
            const genresB = list[j].genre || [];
            if (genresB.length === 0) continue;
            const shared = genresA.some(g => genresB.includes(g));
            if (shared) {
                graph3dEdges.push([i, j]);
            }
        }
    }

    updateEdgeGeometry();
}

function updateEdgeGeometry() {
    if (graph3dLineMesh) {
        scene3d.remove(graph3dLineMesh);
        graph3dLineMesh.geometry.dispose();
        graph3dLineMesh.material.dispose();
    }
    if (graph3dEdges.length === 0) return;

    const positions = new Float32Array(graph3dEdges.length * 6);
    graph3dEdges.forEach(([i, j], idx) => {
        const pi = graph3dNodes[i].mesh.position;
        const pj = graph3dNodes[j].mesh.position;
        positions[idx * 6] = pi.x;
        positions[idx * 6 + 1] = pi.y;
        positions[idx * 6 + 2] = pi.z;
        positions[idx * 6 + 3] = pj.x;
        positions[idx * 6 + 4] = pj.y;
        positions[idx * 6 + 5] = pj.z;
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x0A505C,
        transparent: true,
        opacity: 0.3
    });
    graph3dLineMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene3d.add(graph3dLineMesh);
}

// Simulation force-directed
let forceIterations = 0;
const MAX_FORCE_ITERATIONS = 300;

function stepForceLayout() {
    if (forceIterations >= MAX_FORCE_ITERATIONS) return;
    forceIterations++;

    const nodes = graph3dNodes;
    const n = nodes.length;
    if (n < 2) return;

    const repulsionStrength = 200;
    const attractionStrength = 0.008;
    const damping = 0.85;
    const maxSpeed = 2;

    // Répulsion entre tous les nœuds
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const pi = nodes[i].mesh.position;
            const pj = nodes[j].mesh.position;
            let dx = pi.x - pj.x;
            let dy = pi.y - pj.y;
            let dz = pi.z - pj.z;
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 0.5) dist = 0.5;
            const force = repulsionStrength / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            const fz = (dz / dist) * force;
            nodes[i].vx += fx;
            nodes[i].vy += fy;
            nodes[i].vz += fz;
            nodes[j].vx -= fx;
            nodes[j].vy -= fy;
            nodes[j].vz -= fz;
        }
    }

    // Attraction sur les arêtes
    graph3dEdges.forEach(([i, j]) => {
        const pi = nodes[i].mesh.position;
        const pj = nodes[j].mesh.position;
        const dx = pj.x - pi.x;
        const dy = pj.y - pi.y;
        const dz = pj.z - pi.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const idealDist = 15;
        const force = (dist - idealDist) * attractionStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        nodes[i].vx += fx;
        nodes[i].vy += fy;
        nodes[i].vz += fz;
        nodes[j].vx -= fx;
        nodes[j].vy -= fy;
        nodes[j].vz -= fz;
    });

    // Centrage léger vers l'origine
    const centerForce = 0.01;
    nodes.forEach(node => {
        node.vx -= node.mesh.position.x * centerForce;
        node.vy -= node.mesh.position.y * centerForce;
        node.vz -= node.mesh.position.z * centerForce;
    });

    // Appliquer vélocité avec damping
    nodes.forEach(node => {
        node.vx *= damping;
        node.vy *= damping;
        node.vz *= damping;
        // Limiter la vitesse
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy + node.vz * node.vz);
        if (speed > maxSpeed) {
            node.vx = (node.vx / speed) * maxSpeed;
            node.vy = (node.vy / speed) * maxSpeed;
            node.vz = (node.vz / speed) * maxSpeed;
        }
        node.mesh.position.x += node.vx;
        node.mesh.position.y += node.vy;
        node.mesh.position.z += node.vz;
    });

    // Mettre à jour les arêtes
    if (graph3dLineMesh && graph3dEdges.length > 0) {
        const pos = graph3dLineMesh.geometry.attributes.position.array;
        graph3dEdges.forEach(([i, j], idx) => {
            const pi = nodes[i].mesh.position;
            const pj = nodes[j].mesh.position;
            pos[idx * 6] = pi.x;
            pos[idx * 6 + 1] = pi.y;
            pos[idx * 6 + 2] = pi.z;
            pos[idx * 6 + 3] = pj.x;
            pos[idx * 6 + 4] = pj.y;
            pos[idx * 6 + 5] = pj.z;
        });
        graph3dLineMesh.geometry.attributes.position.needsUpdate = true;
    }
}

function animate3D() {
    graph3dAnimId = requestAnimationFrame(animate3D);
    stepForceLayout();
    // Faire face à la caméra (billboard)
    graph3dNodes.forEach(n => n.mesh.quaternion.copy(camera3d.quaternion));
    controls3d.update();
    renderer3d.render(scene3d, camera3d);
}

function render3DGraph(list) {
    // Vérifier que Three.js est disponible
    if (typeof THREE === 'undefined') {
        graph3dView.innerHTML = '<p style="color:#fff;text-align:center;padding:40px">Chargement de Three.js en cours…</p>';
        return;
    }

    // Hash pour détecter les changements
    const hash = list.map(v => v.id).sort().join(',');
    if (hash === graph3dVinylsHash && graph3dInitialized) return;
    graph3dVinylsHash = hash;

    if (!graph3dInitialized) {
        init3DScene();
    }

    forceIterations = 0;
    buildGraph(list);

    if (!graph3dAnimId) {
        animate3D();
    }
}

// Redimensionnement du canvas 3D
window.addEventListener('resize', () => {
    if (!renderer3d || currentView !== '3d') return;
    const container = graph3dView;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || (window.innerHeight - 200);
    camera3d.aspect = w / h;
    camera3d.updateProjectionMatrix();
    renderer3d.setSize(w, h);
});

// Clic sur un nœud 3D — raycasting
graph3dView.addEventListener('click', (e) => {
    if (!renderer3d || graph3dNodes.length === 0) return;
    const rect = renderer3d.domElement.getBoundingClientRect();
    mouse3d.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse3d.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster3d.setFromCamera(mouse3d, camera3d);
    const meshes = graph3dNodes.map(n => n.mesh);
    const intersects = raycaster3d.intersectObjects(meshes);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const node = graph3dNodes.find(n => n.mesh === hit);
        if (node) openGraph3dPopup(node.vinyl);
    }
});

// Popup 3D
function openGraph3dPopup(vinyl) {
    const popup = document.getElementById('graph3dPopup');
    const coverEl = document.getElementById('graph3dPopupCover');
    const artistEl = document.getElementById('graph3dPopupArtist');
    const albumEl = document.getElementById('graph3dPopupAlbum');
    const ratingsEl = document.getElementById('graph3dPopupRatings');
    const iaBtn = document.getElementById('graph3dPopupIaBtn');
    const iaText = document.getElementById('graph3dPopupIaText');

    // Pochette
    if (vinyl.coverUrl) {
        coverEl.src = vinyl.coverUrl;
        coverEl.style.display = '';
    } else {
        coverEl.src = '';
        coverEl.style.display = 'none';
    }

    artistEl.textContent = vinyl.artiste || '';
    albumEl.textContent = vinyl.album || '';

    // Notes
    const gVal = vinyl.goût || '';
    const aVal = vinyl.audio || '';
    const eVal = vinyl.energie || '';
    ratingsEl.innerHTML = `
        <div class="graph3d-popup-rating">
            <div class="graph3d-popup-rating-value">
                <span class="material-symbols-outlined">favorite</span>
                ${gVal || '–'}
            </div>
            <div class="graph3d-popup-rating-label">${GOUT_LABELS[gVal] || ''}</div>
        </div>
        <div class="graph3d-popup-rating">
            <div class="graph3d-popup-rating-value">
                <span class="material-symbols-outlined">headphones</span>
                ${aVal || '–'}
            </div>
            <div class="graph3d-popup-rating-label">${AUDIO_LABELS[aVal] || ''}</div>
        </div>
        <div class="graph3d-popup-rating">
            <div class="graph3d-popup-rating-value">
                <span class="material-symbols-outlined">bolt</span>
                ${eVal || '–'}
            </div>
            <div class="graph3d-popup-rating-label">${ENERGIE_LABELS[eVal] || ''}</div>
        </div>
    `;

    // Avis IA
    if (vinyl.avisIA && vinyl.avisIA.trim()) {
        iaBtn.classList.remove('hidden');
        iaText.innerHTML = parseMarkdown(vinyl.avisIA);
        iaText.classList.add('hidden');
    } else {
        iaBtn.classList.add('hidden');
        iaText.classList.add('hidden');
    }

    popup.classList.remove('hidden');
}

function closeGraph3dPopup() {
    document.getElementById('graph3dPopup').classList.add('hidden');
}

// Événements popup 3D
document.querySelector('.graph3d-popup-overlay').addEventListener('click', closeGraph3dPopup);
document.querySelector('.graph3d-popup-close').addEventListener('click', closeGraph3dPopup);
document.getElementById('graph3dPopupIaBtn').addEventListener('click', () => {
    const iaText = document.getElementById('graph3dPopupIaText');
    iaText.classList.toggle('hidden');
});

// === Service Worker ===
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// === Init ===
populateFilters();
restoreFilters();
restoreView();
document.getElementById('année').max = new Date().getFullYear() + 1;
// Auth state listener handles loading vinyls and rendering
