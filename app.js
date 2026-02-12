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

let vinyls = [];
let editingId = null;
let sortAsc = true;
let currentSort = 'artiste';
let selectedIds = new Set();

// === Storage ===
function loadVinyls() {
    try {
        const data = localStorage.getItem('vinyls');
        vinyls = data ? JSON.parse(data) : [];
    } catch {
        vinyls = [];
    }
}

function saveVinyls() {
    localStorage.setItem('vinyls', JSON.stringify(vinyls));
}

// === DOM refs ===
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
const filterGoût = document.getElementById('filterGoût');
const filterEnergie = document.getElementById('filterEnergie');
const filterClassé = document.getElementById('filterClassé');
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

// === Cover Art Search (Deezer JSONP — works from file://, no CORS, no token) ===
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

    // Remove previous results
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

        // If artist AND album are filled, auto-pick the best match
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

        // Show results picker as grid
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
        coverSearchBtn.textContent = '🔍 Pochette';
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

// === Discogs enrichment ===
const discogsEnrichBtn = document.getElementById('discogsEnrichBtn');

function getDiscogsToken() {
    return localStorage.getItem('discogsToken') || '';
}

function setDiscogsToken(token) {
    localStorage.setItem('discogsToken', token.trim());
}

function promptDiscogsToken() {
    const current = getDiscogsToken();
    const token = prompt(
        'Token Discogs requis.\n\n' +
        '1. Allez sur https://www.discogs.com/settings/developers\n' +
        '2. Cliquez "Generate new token"\n' +
        '3. Collez le token ci-dessous :',
        current
    );
    if (token === null) return null; // cancelled
    if (!token.trim()) return null;
    setDiscogsToken(token);
    return token.trim();
}

async function discogsFetch(fullUrl) {
    if (location.protocol === 'file:') {
        throw new Error(
            'Discogs nécessite un serveur local.\n' +
            'Lancez dans le Terminal :\n' +
            '  python3 -m http.server 8000\n' +
            'puis ouvrez http://localhost:8000'
        );
    }
    // Direct fetch — Discogs API supports CORS from http/https origins
    return fetch(fullUrl);
}

async function discogsGet(url) {
    const token = getDiscogsToken();
    if (!token) throw new Error('Token Discogs manquant.');
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = url + sep + 'token=' + encodeURIComponent(token);

    let r = await discogsFetch(fullUrl);

    if (r.status === 401 || r.status === 403) {
        throw new Error('Token Discogs invalide ou expiré.');
    }
    if (r.status === 429) {
        // rate limited — wait and retry once
        await new Promise(res => setTimeout(res, 3000));
        r = await discogsFetch(fullUrl);
        if (!r.ok) throw new Error('Trop de requêtes Discogs. Réessayez dans quelques secondes.');
    }
    if (!r.ok) {
        let msg = 'Erreur Discogs (HTTP ' + r.status + ')';
        try { const j = await r.json(); if (j.message) msg = j.message; } catch (_) {}
        throw new Error(msg);
    }
    return r.json();
}

// Map Discogs genres/styles to app categories
const DISCOGS_CATEGORY_MAP = {
    'jazz': 'Jazz',
    'rock': 'Pop / Rock',
    'pop': 'Pop / Rock',
    'indie rock': 'Pop / Rock',
    'punk': 'Pop / Rock',
    'new wave': 'Pop / Rock',
    'electronic': 'Electronique',
    'electro': 'Electronique',
    'house': 'Electronique',
    'techno': 'Electronique',
    'ambient': 'Electronique',
    'synth-pop': 'Electronique',
    'blues': 'Blues',
    'classical': 'Classique',
    'baroque': 'Classique',
    'romantic': 'Classique',
    'latin': 'Latin',
    'salsa': 'Latin',
    'bossa nova': 'Latin',
    'cumbia': 'Latin',
    'bossanova': 'Latin',
    'samba': 'Brésil',
    'mpb': 'Brésil',
    'brazilian': 'Brésil',
    'afrobeat': 'Afrique',
    'african': 'Afrique',
    'highlife': 'Afrique',
    'soukous': 'Afrique',
    'soundtrack': 'OST',
    'score': 'OST',
    'stage & screen': 'OST',
};

function mapDiscogsCategories(genres, styles) {
    const all = [...(genres || []), ...(styles || [])].map(s => s.toLowerCase());
    const mapped = new Set();
    for (const tag of all) {
        if (DISCOGS_CATEGORY_MAP[tag]) {
            mapped.add(DISCOGS_CATEGORY_MAP[tag]);
        }
    }
    return [...mapped];
}

async function enrichFromDiscogs() {
    // Always ensure we have a token — prompt if missing or empty
    let token = getDiscogsToken();
    if (!token) {
        token = promptDiscogsToken();
        if (!token) return;
    }

    const artiste = document.getElementById('artiste').value.trim();
    const album = document.getElementById('album').value.trim();

    if (!artiste && !album) {
        alert('Remplissez au moins le champ Artiste ou Album.');
        return;
    }

    discogsEnrichBtn.textContent = '⏳ Recherche…';
    discogsEnrichBtn.classList.add('searching');

    // Remove previous Discogs results
    const oldResults = document.querySelector('.discogs-results');
    if (oldResults) oldResults.remove();

    try {
        const query = [artiste, album].filter(Boolean).join(' ');
        const data = await discogsGet(
            'https://api.discogs.com/database/search?type=release&per_page=8&q=' +
            encodeURIComponent(query)
        );

        const results = (data.results || []).filter(r => r.id);

        if (results.length === 0) {
            alert('Aucun résultat Discogs pour cette recherche.');
            return;
        }

        // If artist AND album filled, try auto-pick best match
        if (artiste && album && results.length > 0) {
            const albumLower = album.toLowerCase();
            const artistLower = artiste.toLowerCase();
            const best = results.find(r =>
                (r.title || '').toLowerCase().includes(albumLower) &&
                (r.title || '').toLowerCase().includes(artistLower)
            );
            if (best) {
                await applyDiscogsRelease(best.id);
                return;
            }
        }

        // Show picker
        const container = document.createElement('div');
        container.className = 'discogs-results';

        results.forEach(r => {
            const el = document.createElement('div');
            el.className = 'discogs-result-item';
            const thumb = r.cover_image || r.thumb || '';
            const titleParts = (r.title || '').split(' - ');
            const rArtist = titleParts[0] || '';
            const rAlbum = titleParts.slice(1).join(' - ') || '';
            const rYear = r.year || '';
            const rFormats = (r.format || []).join(', ');
            const rLabel = (r.label || []).join(', ');

            el.innerHTML = `
                <img src="${esc(thumb)}" alt="" class="discogs-result-thumb">
                <div class="discogs-result-info">
                    <div class="discogs-result-artist">${esc(rArtist)}</div>
                    <div class="discogs-result-album">${esc(rAlbum)}</div>
                    <div class="discogs-result-meta">${esc(rYear)}${rLabel ? ' · ' + esc(rLabel) : ''}${rFormats ? ' · ' + esc(rFormats) : ''}</div>
                </div>`;

            el.addEventListener('click', async () => {
                container.querySelectorAll('.discogs-result-item').forEach(e =>
                    e.classList.add('searching')
                );
                el.textContent = '⏳ Chargement…';
                await applyDiscogsRelease(r.id);
                container.remove();
            });
            container.appendChild(el);
        });

        document.querySelector('.cover-col').appendChild(container);

    } catch (err) {
        if (err.message.includes('invalide') || err.message.includes('manquant')) {
            // Bad or missing token — clear and re-prompt
            setDiscogsToken('');
            const newToken = promptDiscogsToken();
            if (newToken) {
                discogsEnrichBtn.textContent = '🎵 Discogs';
                discogsEnrichBtn.classList.remove('searching');
                return enrichFromDiscogs();
            }
        }
        alert('Erreur Discogs : ' + err.message);
    } finally {
        discogsEnrichBtn.textContent = '🎵 Discogs';
        discogsEnrichBtn.classList.remove('searching');
    }
}

async function applyDiscogsRelease(releaseId) {
    try {
        const release = await discogsGet('https://api.discogs.com/releases/' + releaseId);

        // Artist
        const artists = (release.artists || []).map(a => a.name.replace(/\s*\(\d+\)$/, '').trim());
        const artistStr = artists.join(', ');
        const artistField = document.getElementById('artiste');
        if (!artistField.value.trim()) artistField.value = artistStr;

        // Album
        const albumField = document.getElementById('album');
        if (!albumField.value.trim()) albumField.value = release.title || '';

        // Year — fill even if empty in form
        const yearField = document.getElementById('année');
        if (!yearField.value && release.year) yearField.value = release.year;

        // Label
        const labelField = document.getElementById('label');
        if (!labelField.value.trim()) {
            const labels = (release.labels || []).map(l => l.name);
            labelField.value = [...new Set(labels)].join(', ');
        }

        // Reference (catno)
        const refField = document.getElementById('référence');
        if (!refField.value.trim()) {
            const catnos = (release.labels || []).map(l => l.catno).filter(c => c && c !== 'none');
            refField.value = [...new Set(catnos)].join(', ');
        }

        // Categories — map Discogs genres/styles to app categories
        const genres = release.genres || [];
        const styles = release.styles || [];
        const mappedCats = mapDiscogsCategories(genres, styles);

        if (mappedCats.length > 0) {
            document.querySelectorAll('input[name="categorie"]').forEach(cb => {
                if (mappedCats.includes(cb.value)) cb.checked = true;
            });
        }

        // Comment — append Discogs genres/styles + country if comment is empty
        const commentField = document.getElementById('commentaire');
        if (!commentField.value.trim()) {
            const parts = [];
            if (genres.length) parts.push('Genres: ' + genres.join(', '));
            if (styles.length) parts.push('Styles: ' + styles.join(', '));
            if (release.country) parts.push('Pays: ' + release.country);
            commentField.value = parts.join(' · ');
        }

        // Cover — prefer large image
        const images = release.images || [];
        const primaryImg = images.find(i => i.type === 'primary') || images[0];
        if (primaryImg && primaryImg.uri) {
            coverUrlInput.value = primaryImg.uri;
            setCover(primaryImg.uri);
        }

    } catch (err) {
        alert('Erreur lors du chargement de la release Discogs : ' + err.message);
    }
}

discogsEnrichBtn.addEventListener('click', (e) => {
    e.preventDefault();
    enrichFromDiscogs();
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
                const idx = vinyls.findIndex(x => x.id === v.id);
                if (idx !== -1) {
                    vinyls[idx].coverUrl = coverUrl;
                    found++;
                }
            }
        } catch (e) {
            errors++;
        }

        // Save after each successful cover find
        saveVinyls();
        // Update display every 5 vinyls
        if ((i + 1) % 5 === 0) {
            render();
        }

        // Small delay between JSONP calls
        if (i < missing.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    saveVinyls();
    render();
    bulkCoverBtn.classList.remove('searching');
    bulkCoverBtn.textContent = '🔍 Pochettes auto';
    alert(`Terminé !\n✅ ${found} pochette${found > 1 ? 's' : ''} trouvée${found > 1 ? 's' : ''}\n⚠️ ${missing.length - found - errors} non trouvée${(missing.length - found - errors) > 1 ? 's' : ''}${errors > 0 ? '\n❌ ' + errors + ' erreur(s)' : ''}`);
}

bulkCoverBtn.addEventListener('click', bulkSearchCovers);

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

// === Render ===
function getFilteredAndSorted() {
    const search = searchInput.value.toLowerCase().trim();
    const catFilter = filterCategorie.value;
    const goutFilter = filterGoût.value;
    const energieFilter = filterEnergie.value;
    const classéFilter = filterClassé.value;

    let list = vinyls.filter(v => {
        if (search) {
            const hay = [v.artiste, v.album, v.label, v.référence, v.acheté, v.commentaire,
                ...(v.categorie || [])]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        if (catFilter && !(v.categorie || []).includes(catFilter)) return false;
        if (goutFilter && v.goût !== goutFilter) return false;
        if (energieFilter && v.energie !== energieFilter) return false;
        if (classéFilter && v.classé !== classéFilter) return false;
        return true;
    });

    list.sort((a, b) => {
        let va, vb;
        switch (currentSort) {
            case 'artiste': va = (a.artiste || '').toLowerCase(); vb = (b.artiste || '').toLowerCase(); break;
            case 'album': va = (a.album || '').toLowerCase(); vb = (b.album || '').toLowerCase(); break;
            case 'année': va = parseInt(a.année) || 0; vb = parseInt(b.année) || 0; break;
            case 'goût': va = parseInt(a.goût) ?? -1; vb = parseInt(b.goût) ?? -1; break;
            case 'audio': va = parseInt(a.audio) ?? -1; vb = parseInt(b.audio) ?? -1; break;
            case 'energie': va = parseInt(a.energie) ?? -1; vb = parseInt(b.energie) ?? -1; break;
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

    // Stats
    const totalPrix = vinyls.reduce((s, v) => s + (parseFloat(v.prix) || 0), 0);
    statsEl.textContent = `${vinyls.length} vinyle${vinyls.length > 1 ? 's' : ''} · ${totalPrix.toFixed(0)} € · ${list.length} affiché${list.length > 1 ? 's' : ''}`;

    if (list.length === 0) {
        vinylTable.classList.add('hidden');
        galleryView.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.querySelector('p').textContent =
            vinyls.length === 0 ? 'Aucun vinyle. Commencez par en ajouter un !' : 'Aucun résultat pour ces filtres.';
        return;
    }

    emptyState.classList.add('hidden');

    // Show/hide views
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
}

function renderGallery(list) {
    galleryView.innerHTML = list.map(v => {
        const imgHtml = v.coverUrl
            ? `<img src="${esc(v.coverUrl)}" alt="${esc(v.album)}">`
            : `<span class="gallery-no-img">♫</span>`;

        return `<div class="gallery-card" data-id="${v.id}">
            <div class="gallery-card-img">${imgHtml}</div>
            <div class="gallery-card-info">
                <div class="g-artist">${esc(v.artiste)}</div>
                <div class="g-album">${esc(v.album)}</div>
                ${v.année ? `<div class="g-year">${esc(v.année)}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    galleryView.querySelectorAll('.gallery-card').forEach(card => {
        card.addEventListener('click', () => openEdit(card.dataset.id));
    });
}

function renderTable(list) {

    vinylBody.innerHTML = list.map(v => {
        const cats = (v.categorie || []).map(c => `<span class="tag tag-categorie">${esc(c)}</span>`).join(' ');

        const classéBadge = v.classé === 'Oui'
            ? '<span class="badge-classé classé-oui">Oui</span>'
            : '<span class="badge-classé classé-non">Non</span>';

        const goutText = v.goût !== '' && v.goût != null && GOUT_LABELS[v.goût] ? `${v.goût} – ${GOUT_LABELS[v.goût]}` : '';
        const audioText = v.audio !== '' && v.audio != null && AUDIO_LABELS[v.audio] ? `${v.audio} – ${AUDIO_LABELS[v.audio]}` : '';
        const energieText = v.energie !== '' && v.energie != null && ENERGIE_LABELS[v.energie] ? `${v.energie} – ${ENERGIE_LABELS[v.energie]}` : '';

        return `<tr data-id="${v.id}">
            <td class="cell-center cell-check"><input type="checkbox" class="row-select" data-id="${v.id}" ${selectedIds.has(v.id) ? 'checked' : ''}></td>
            <td>${cats}</td>
            <td class="cell-center">${classéBadge}</td>
            <td class="cell-artiste">${esc(v.artiste)}</td>
            <td class="cell-album">${esc(v.album)}</td>
            <td class="cell-center">${esc(v.année)}</td>
            <td>${esc(v.label)}</td>
            <td>${esc(v.référence)}</td>
            <td class="cell-gout">${esc(goutText)}</td>
            <td class="cell-audio">${esc(audioText)}</td>
            <td class="cell-energie">${esc(energieText)}</td>
            <td class="cell-center">${v.nb && v.nb !== '0' ? v.nb : ''}</td>
            <td class="cell-num">${v.prix ? v.prix + ' €' : ''}</td>
            <td>${esc(v.acheté)}</td>
            <td class="cell-comment" title="${esc(v.commentaire)}">${esc(v.commentaire)}</td>
        </tr>`;
    }).join('');

    // Attach click on rows (skip if clicking checkbox)
    vinylBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('row-select')) return;
            openEdit(row.dataset.id);
        });
    });

    // Attach checkbox change
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
    if (selectedIds.size > 0) {
        bulkDeleteBtn.classList.remove('hidden');
        bulkDeleteBtn.textContent = `Supprimer (${selectedIds.size})`;
    } else {
        bulkDeleteBtn.classList.add('hidden');
    }
    // Update select all checkbox
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
        // Show immediately (onload will confirm)
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
    editingId = null;
    modalTitle.textContent = 'Ajouter un vinyle';
    vinylForm.reset();
    deleteBtn.classList.add('hidden');
    setCover('');
    coverUrlInput.value = '';
    coverUrlInput.classList.add('hidden');
    openModal();
}

function openEdit(id) {
    const v = vinyls.find(x => x.id === id);
    if (!v) return;
    editingId = id;
    modalTitle.textContent = 'Modifier le vinyle';
    deleteBtn.classList.remove('hidden');

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

    setCover(v.coverUrl || '');
    coverUrlInput.value = v.coverUrl || '';
    coverUrlInput.classList.add('hidden');

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
    };
}

// === Events ===
addBtn.addEventListener('click', openAdd);
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
document.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

vinylForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getFormData();

    if (editingId) {
        const idx = vinyls.findIndex(v => v.id === editingId);
        if (idx !== -1) {
            vinyls[idx] = { ...vinyls[idx], ...data };
        }
    } else {
        data.id = crypto.randomUUID();
        data.dateAjout = new Date().toISOString();
        vinyls.push(data);
    }

    saveVinyls();
    render();
    closeModal();
});

deleteBtn.addEventListener('click', () => {
    if (!editingId) return;
    if (!confirm('Supprimer ce vinyle ?')) return;
    vinyls = vinyls.filter(v => v.id !== editingId);
    saveVinyls();
    render();
    closeModal();
});

// Filters & search
searchInput.addEventListener('input', render);
filterCategorie.addEventListener('change', render);
filterGoût.addEventListener('change', render);
filterEnergie.addEventListener('change', render);
filterClassé.addEventListener('change', render);

sortBySelect.addEventListener('change', () => {
    currentSort = sortBySelect.value;
    render();
});

sortDirBtn.addEventListener('click', () => {
    sortAsc = !sortAsc;
    sortDirBtn.textContent = sortAsc ? '↑' : '↓';
    render();
});

// Column header sort
document.querySelectorAll('.vinyl-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (currentSort === col) {
            sortAsc = !sortAsc;
            sortDirBtn.textContent = sortAsc ? '↑' : '↓';
        } else {
            currentSort = col;
            sortBySelect.value = col;
            sortAsc = true;
            sortDirBtn.textContent = '↑';
        }
        render();
    });
});

// Cover photo
coverZone.addEventListener('click', () => {
    coverUrlInput.classList.toggle('hidden');
    if (!coverUrlInput.classList.contains('hidden')) {
        coverUrlInput.focus();
    }
});

// Manual URL button
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
    render();
});

viewGalleryBtn.addEventListener('click', () => {
    currentView = 'gallery';
    viewGalleryBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
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
bulkDeleteBtn.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} vinyle(s) ?`)) return;
    vinyls = vinyls.filter(v => !selectedIds.has(v.id));
    selectedIds.clear();
    saveVinyls();
    render();
});

// === CSV Import ===
csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target.result;
        const imported = parseCSV(text);
        if (imported.length === 0) {
            alert('Aucune fiche trouvée dans le CSV.');
            return;
        }
        vinyls.push(...imported);
        saveVinyls();
        render();
        alert(`${imported.length} vinyle(s) importé(s).`);
    };
    reader.readAsText(file, 'UTF-8');
    csvInput.value = '';
});

function parseCSV(text) {
    const lines = parseCSVLines(text);
    if (lines.length < 2) return [];

    // Normalize headers
    const rawHeaders = lines[0].map(h => h.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    const headerMap = {};
    const fieldNames = ['categorie', 'classe', 'artiste', 'album', 'annee', 'label',
        'reference', 'gout', 'audio', 'energie', 'nb', 'prix', 'achete', 'commentaire'];
    const fieldAliases = {
        'categorie': ['categorie', 'categories', 'cat', 'genre', 'genres', 'styles', 'style'],
        'classe': ['classe', 'class'],
        'artiste': ['artiste', 'artist', 'artistes'],
        'album': ['album', 'titre', 'title'],
        'annee': ['annee', 'année', 'year', 'an'],
        'label': ['label', 'labels', 'maison'],
        'reference': ['reference', 'ref', 'ref.', 'catnos', 'catno'],
        'gout': ['gout', 'goût', 'note'],
        'audio': ['audio', 'son', 'qualite'],
        'energie': ['energie', 'energy', 'nrj'],
        'nb': ['nb', 'ecoutes', 'nombre', 'nb ecoutes'],
        'prix': ['prix', 'price', 'cout'],
        'achete': ['achete', 'achat', 'ou', 'magasin'],
        'commentaire': ['commentaire', 'comment', 'notes', 'remarque', 'country', 'formats'],
        'coverurl': ['coverurl', 'pochette', 'cover', 'image', 'photo', 'artwork']
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

        // Parse categories (comma or semicolon separated)
        const catStr = get('categorie');
        const categorie = catStr ? catStr.split(/[;,|]/).map(c => c.trim()).filter(Boolean) : [];

        // Parse numeric fields — extract just the number
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
    const headers = ['Catégorie', 'Classé', 'Artiste', 'Album', 'Année', 'Label', 'Référence', 'Goût', 'Audio', 'Énergie', 'Nb', 'Prix', 'Acheté', 'Commentaire', 'Pochette'];

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
            goutText,
            audioText,
            energieText,
            v.nb || '',
            v.prix || '',
            v.acheté || '',
            v.commentaire || '',
            v.coverUrl || ''
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
    reader.onload = (evt) => {
        try {
            const imported = JSON.parse(evt.target.result);
            if (!Array.isArray(imported)) {
                alert('Fichier JSON invalide.');
                return;
            }
            // Merge: add new, update existing (by id)
            let added = 0, updated = 0;
            imported.forEach(v => {
                if (!v.id) v.id = crypto.randomUUID();
                const existing = vinyls.findIndex(x => x.id === v.id);
                if (existing !== -1) {
                    vinyls[existing] = { ...vinyls[existing], ...v };
                    updated++;
                } else {
                    vinyls.push(v);
                    added++;
                }
            });
            saveVinyls();
            render();
            alert(`Import terminé !\n${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour.`);
        } catch (err) {
            alert('Erreur de lecture du fichier JSON.');
        }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
});

// Keyboard: Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
    }
});

// === Init ===
loadVinyls();
populateFilters();
render();
