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
    auth.signInWithPopup(provider).catch(err => {
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
        await migrateLocalStorageToFirestore();
    } else {
        currentUser = null;
        currentUserRole = 'user';
        discogsToken = '';
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
            const hay = [v.artiste, v.album, v.label, v.référence, v.acheté, v.commentaire,
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
        return 0;
    });

    return list;
}

function render() {
    const list = getFilteredAndSorted();

    statsEl.textContent = `${vinyls.length} vinyle${vinyls.length > 1 ? 's' : ''} · ${list.length} affiché${list.length > 1 ? 's' : ''}`;

    if (list.length === 0) {
        vinylTable.classList.add('hidden');
        galleryView.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.querySelector('p').textContent =
            vinyls.length === 0 ? 'Aucun vinyle. Commencez par en ajouter un !' : 'Aucun résultat pour ces filtres.';
        return;
    }

    emptyState.classList.add('hidden');

    if (currentView === 'gallery') {
        vinylTable.classList.add('hidden');
        tableView.classList.add('hidden');
        galleryView.classList.remove('hidden');
        renderGallery(list);
    } else {
        galleryView.classList.add('hidden');
        vinylTable.classList.remove('hidden');
        tableView.classList.remove('hidden');
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
                ${v.année ? `<div class="g-year">${esc(v.année)}</div>` : ''}
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
            <td class="cell-num">${v.prix ? v.prix + ' €' : ''}</td>
            <td>${esc(v.acheté)}</td>
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
    document.getElementById('prix').value = v.prix || '';
    document.getElementById('acheté').value = v.acheté || '';
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
    // Keep cancel button enabled
    cancelBtn.disabled = false;
    modalClose.disabled = false;

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
    try { localStorage.setItem('vinylView', 'table'); } catch(e) {}
    render();
});

viewGalleryBtn.addEventListener('click', () => {
    currentView = 'gallery';
    viewGalleryBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
    try { localStorage.setItem('vinylView', 'gallery'); } catch(e) {}
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
        'categorie': ['categorie', 'categories', 'cat', 'genre'],
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
        'achete': ['achete', 'achat', 'ou', 'magasin'],
        'commentaire': ['commentaire', 'comment', 'notes', 'remarque'],
        'coverurl': ['coverurl', 'pochette', 'cover', 'image', 'photo', 'artwork'],
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

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i];
        if (cols.length === 0 || cols.every(c => c.trim() === '')) continue;

        const get = (field) => {
            const idx = headerMap[field];
            return idx !== undefined && cols[idx] !== undefined ? cols[idx].trim() : '';
        };

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
            prix: get('prix'),
            acheté: get('achete'),
            commentaire: get('commentaire'),
            coverUrl: get('coverurl'),
            genre,
            discogsUrl: get('discogsurl'),
        });
    }
    return results;
}

function parseCSVLines(text) {
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
            } else if (ch === ',' || ch === ';' || ch === '\t') {
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

// === Export CSV ===
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    const headers = ['Catégorie', 'Classé', 'Artiste', 'Album', 'Année', 'Label', 'Référence', 'Genre', 'Goût', 'Audio', 'Énergie', 'Nb', 'Prix', 'Acheté', 'Commentaire', 'Pochette', 'Discogs URL'];

    function csvEscape(val) {
        if (!val) return '';
        const str = String(val);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    const rows = vinyls.map(v => {
        const goutText = v.goût && GOUT_LABELS[v.goût] ? `${v.goût} – ${GOUT_LABELS[v.goût]}` : v.goût || '';
        const audioText = v.audio && AUDIO_LABELS[v.audio] ? `${v.audio} – ${AUDIO_LABELS[v.audio]}` : v.audio || '';
        const energieText = v.energie && ENERGIE_LABELS[v.energie] ? `${v.energie} – ${ENERGIE_LABELS[v.energie]}` : v.energie || '';
        return [
            (v.categorie || []).join(', '),
            v.classé || '',
            v.artiste || '',
            v.album || '',
            v.année || '',
            v.label || '',
            v.référence || '',
            (v.genre || []).join(', '),
            goutText,
            audioText,
            energieText,
            v.nb || '',
            v.prix || '',
            v.acheté || '',
            v.commentaire || '',
            v.coverUrl || '',
            v.discogsUrl || ''
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
        } else if (!adminModal.classList.contains('hidden')) {
            adminModal.classList.add('hidden');
            document.body.style.overflow = '';
        } else if (!tokenModal.classList.contains('hidden')) {
            tokenModal.classList.add('hidden');
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

// === Init ===
populateFilters();
restoreFilters();
restoreView();
document.getElementById('année').max = new Date().getFullYear() + 1;
// Auth state listener handles loading vinyls and rendering
