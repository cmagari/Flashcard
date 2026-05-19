from __future__ import annotations

import pytest


@pytest.fixture
def subject_id(client) -> int:
    return client.post("/api/subjects", json={"name": "Phys"}).json()["id"]


def _make_card(client, subject_id, front="Q") -> int:
    return client.post(
        "/api/cards",
        json={"subject_id": subject_id, "front_md": front, "back_md": "A", "tag_names": []},
    ).json()["id"]


def test_attempt_pruning_keeps_only_last_10(client, subject_id):
    cid = _make_card(client, subject_id)
    for _ in range(12):
        r = client.post(
            "/api/practice/attempt", json={"card_id": cid, "result": "correct"}
        )
        assert r.status_code == 200
    final = r.json()
    assert len(final["last10_attempts"]) == 10


def test_next_card_returns_null_for_empty_pool(client):
    r = client.get("/api/practice/next?mode=random")
    assert r.status_code == 200
    assert r.json() is None


def test_next_card_random_returns_from_filtered_pool(client, subject_id):
    other = client.post("/api/subjects", json={"name": "Math"}).json()["id"]
    _make_card(client, subject_id, "phys-1")
    _make_card(client, subject_id, "phys-2")
    _make_card(client, other, "math-1")

    seen_subjects = set()
    for _ in range(15):
        body = client.get(f"/api/practice/next?mode=random&subject_id={subject_id}").json()
        assert body is not None
        seen_subjects.add(body["subject_id"])
    assert seen_subjects == {subject_id}


def test_inorder_advances_via_cursor(client, subject_id):
    ids = [_make_card(client, subject_id, f"c{i}") for i in range(3)]
    first = client.get(f"/api/practice/next?mode=inorder&subject_id={subject_id}").json()
    assert first["id"] == ids[0]
    second = client.get(
        f"/api/practice/next?mode=inorder&subject_id={subject_id}&cursor_id={first['id']}"
    ).json()
    assert second["id"] == ids[1]


def test_smart_excludes_ids(client, subject_id):
    ids = [_make_card(client, subject_id, f"c{i}") for i in range(3)]
    excluded = ids[:2]
    qs = "&".join(f"exclude_ids={i}" for i in excluded)
    for _ in range(10):
        body = client.get(
            f"/api/practice/next?mode=smart&subject_id={subject_id}&{qs}"
        ).json()
        assert body is not None
        assert body["id"] not in excluded


def test_smart_returns_null_when_all_excluded(client, subject_id):
    ids = [_make_card(client, subject_id, f"c{i}") for i in range(2)]
    qs = "&".join(f"exclude_ids={i}" for i in ids)
    body = client.get(
        f"/api/practice/next?mode=smart&subject_id={subject_id}&{qs}"
    ).json()
    assert body is None
