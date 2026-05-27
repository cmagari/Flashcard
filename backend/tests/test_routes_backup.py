from __future__ import annotations

import time


def test_create_backup_then_list(client):
    # seed with a subject so we can verify the snapshot is real later
    client.post("/api/subjects", json={"name": "Physics"})

    r = client.post("/api/backup")
    assert r.status_code == 201
    body = r.json()
    assert body["filename"].startswith("flashcards-")
    assert body["filename"].endswith(".db")
    assert body["size_bytes"] > 0

    listing = client.get("/api/backup")
    assert listing.status_code == 200
    items = listing.json()
    assert len(items) == 1
    assert items[0]["filename"] == body["filename"]


def test_keeps_only_three_most_recent_backups(client):
    client.post("/api/subjects", json={"name": "S"})

    # Backups are timestamped to the second — sleep a hair so each lands
    # in its own filename rather than colliding on rename.
    filenames: list[str] = []
    for _ in range(5):
        r = client.post("/api/backup")
        assert r.status_code == 201
        filenames.append(r.json()["filename"])
        time.sleep(1.05)

    items = client.get("/api/backup").json()
    assert len(items) == 3
    kept = {item["filename"] for item in items}
    # The three newest are the last three taken
    assert kept == set(filenames[-3:])
