from __future__ import annotations

import pytest


@pytest.fixture
def subject_id(client) -> int:
    return client.post("/api/subjects", json={"name": "Phys"}).json()["id"]


def _create(client, subject_id, **overrides) -> dict:
    payload = {
        "subject_id": subject_id,
        "front_md": overrides.get("front_md", "Q"),
        "back_md": overrides.get("back_md", "A"),
        "tag_names": overrides.get("tag_names", []),
    }
    r = client.post("/api/cards", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_card_returns_full_shape(client, subject_id):
    card = _create(client, subject_id, tag_names=["mechanics", "newton"])
    assert card["subject_id"] == subject_id
    assert card["subject_name"] == "Phys"
    assert sorted(card["tags"]) == ["mechanics", "newton"]
    assert card["last10_attempts"] == []
    assert "created_at" in card and "updated_at" in card


def test_create_card_unknown_subject_404(client):
    r = client.post(
        "/api/cards",
        json={"subject_id": 999, "front_md": "", "back_md": "", "tag_names": []},
    )
    assert r.status_code == 404


def test_list_cards_filters_by_subject_and_text(client, subject_id):
    other = client.post("/api/subjects", json={"name": "Math"}).json()["id"]
    _create(client, subject_id, front_md="Newton's first law")
    _create(client, subject_id, front_md="Coulomb's law")
    _create(client, other, front_md="Newton's law in math context")

    all_phys = client.get(f"/api/cards?subject_id={subject_id}").json()
    assert len(all_phys) == 2

    matches = client.get("/api/cards?q=Newton").json()
    assert len(matches) == 2
    assert all("Newton" in c["front_md"] for c in matches)


def test_update_card_changes_fields_and_tags(client, subject_id):
    card = _create(client, subject_id, tag_names=["a"])
    r = client.patch(
        f"/api/cards/{card['id']}",
        json={"front_md": "Updated", "tag_names": ["b", "c"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["front_md"] == "Updated"
    assert sorted(body["tags"]) == ["b", "c"]


def test_delete_card(client, subject_id):
    card = _create(client, subject_id)
    assert client.delete(f"/api/cards/{card['id']}").status_code == 204
    assert client.get(f"/api/cards/{card['id']}").status_code == 404


def test_tags_endpoint_lists_with_usage(client, subject_id):
    _create(client, subject_id, tag_names=["shared", "alpha"])
    _create(client, subject_id, tag_names=["shared"])

    tags = {t["name"]: t for t in client.get("/api/tags").json()}
    assert tags["shared"]["usage_count"] == 2
    assert tags["alpha"]["usage_count"] == 1
