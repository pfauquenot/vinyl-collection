#!/usr/bin/env python3
"""
Export a Discogs collection to CSV, including genres and styles.

Usage:
    1. Get a personal access token at https://www.discogs.com/settings/developers
    2. Set TOKEN and USERNAME below (or use environment variables)
    3. Run:  python3 discogs_export.py
    4. Import the resulting CSV into the vinyl-collection app

The output CSV is formatted for direct import into the vinyl-collection app:
  artist, title (= album), year, label, ref (= catalog number),
  genre (= genres + styles), comment (= country + formats), cover (= thumb)
"""

import csv
import os
import time
import requests

TOKEN = os.environ.get("DISCOGS_TOKEN", "COLLE_TON_TOKEN_ICI")
USERNAME = os.environ.get("DISCOGS_USER", "TON_USERNAME_DISCOGS")
OUTPUT = "discogs_collection.csv"

BASE = "https://api.discogs.com"

HEADERS = {
    "Authorization": f"Discogs token={TOKEN}",
    "User-Agent": "VinylCollectionExporter/1.0",
}


def get_json(url, params=None, sleep_s=1.1):
    """GET with rate-limit handling."""
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    if r.status_code == 429:
        wait = int(r.headers.get("Retry-After", 5))
        print(f"  Rate limited, waiting {wait}s...")
        time.sleep(wait)
        r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    time.sleep(sleep_s)
    return r.json()


def export_collection():
    if TOKEN == "COLLE_TON_TOKEN_ICI" or USERNAME == "TON_USERNAME_DISCOGS":
        print("Erreur : configure TOKEN et USERNAME avant de lancer le script.")
        print("  - Variable d'environnement : DISCOGS_TOKEN, DISCOGS_USER")
        print("  - Ou modifie les valeurs en haut du fichier.")
        return

    # 1) Fetch all collection pages
    items = []
    page = 1
    per_page = 100

    while True:
        url = f"{BASE}/users/{USERNAME}/collection/folders/0/releases"
        data = get_json(url, params={"page": page, "per_page": per_page})
        releases = data.get("releases", [])
        items.extend(releases)

        pages = data.get("pagination", {}).get("pages", 1)
        print(f"Page {page}/{pages} — {len(releases)} items — total {len(items)}")
        if page >= pages:
            break
        page += 1

    # 2) Fetch detailed release info for genres/styles
    rows = []
    for i, it in enumerate(items, 1):
        basic = it.get("basic_information", {})
        release_id = basic.get("id")
        if not release_id:
            continue

        release = get_json(f"{BASE}/releases/{release_id}")

        artists_list = release.get("artists") or basic.get("artists") or []
        artist = ", ".join(
            a.get("name", "").strip() for a in artists_list
        )

        title = release.get("title") or basic.get("title", "")
        year = release.get("year") or basic.get("year", "")

        labels_list = release.get("labels") or basic.get("labels") or []
        label = ", ".join(l.get("name", "") for l in labels_list)
        catno = ", ".join(
            l.get("catno", "") for l in labels_list if l.get("catno")
        )

        genres = release.get("genres") or []
        styles = release.get("styles") or []
        # Combine genres + styles into a single category string
        genre = ", ".join(genres + styles)

        formats = ", ".join(
            f.get("name", "") for f in (release.get("formats") or basic.get("formats") or [])
        )
        country = release.get("country", "")

        # Comment combines country + format info
        comment_parts = [p for p in [country, formats] if p]
        comment = " — ".join(comment_parts)

        # Cover image
        cover = (release.get("images") or [{}])[0].get("uri", "") if release.get("images") else ""
        if not cover:
            cover = basic.get("cover_image", "")

        rows.append({
            "artist": artist,
            "title": title,
            "year": year,
            "label": label,
            "ref": catno,
            "genre": genre,
            "comment": comment,
            "cover": cover,
        })

        if i % 25 == 0:
            print(f"  -> {i}/{len(items)} releases")

    # 3) Write CSV
    fieldnames = ["artist", "title", "year", "label", "ref", "genre", "comment", "cover"]
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"\nExport termine : {OUTPUT} ({len(rows)} lignes)")


if __name__ == "__main__":
    export_collection()
