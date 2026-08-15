from __future__ import annotations


def test_create_and_list_subject(client):
    r = client.post("/api/subjects", json={"name": "Physics"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Physics"
    assert body["include_in_general_practice"] is True
    assert body["card_count"] == 0
    assert "id" in body and "created_at" in body

    r = client.get("/api/subjects")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Physics"


def test_subject_can_be_marked_opt_in_for_practice(client):
    created = client.post(
        "/api/subjects",
        json={"name": "Reference", "include_in_general_practice": False},
    ).json()
    assert created["include_in_general_practice"] is False

    updated = client.patch(
        f"/api/subjects/{created['id']}",
        json={"include_in_general_practice": True},
    )
    assert updated.status_code == 200
    assert updated.json()["include_in_general_practice"] is True


def test_duplicate_subject_name_returns_409(client):
    client.post("/api/subjects", json={"name": "Physics"})
    r = client.post("/api/subjects", json={"name": "Physics"})
    assert r.status_code == 409


def test_rename_subject(client):
    sid = client.post("/api/subjects", json={"name": "Phys"}).json()["id"]
    r = client.patch(f"/api/subjects/{sid}", json={"name": "Physics"})
    assert r.status_code == 200
    assert r.json()["name"] == "Physics"


def test_rename_to_existing_returns_409(client):
    a = client.post("/api/subjects", json={"name": "A"}).json()
    client.post("/api/subjects", json={"name": "B"})
    r = client.patch(f"/api/subjects/{a['id']}", json={"name": "B"})
    assert r.status_code == 409


def test_delete_subject_cascades_to_cards(client):
    sid = client.post("/api/subjects", json={"name": "Phys"}).json()["id"]
    cid = client.post(
        "/api/cards",
        json={"subject_id": sid, "front_md": "Q", "back_md": "A", "tag_names": []},
    ).json()["id"]

    r = client.delete(f"/api/subjects/{sid}")
    assert r.status_code == 204

    assert client.get("/api/subjects").json() == []
    assert client.get(f"/api/cards/{cid}").status_code == 404


def test_card_count_reflects_added_cards(client):
    sid = client.post("/api/subjects", json={"name": "Phys"}).json()["id"]
    for i in range(3):
        client.post(
            "/api/cards",
            json={"subject_id": sid, "front_md": f"Q{i}", "back_md": "", "tag_names": []},
        )
    listed = client.get("/api/subjects").json()
    assert listed[0]["card_count"] == 3
