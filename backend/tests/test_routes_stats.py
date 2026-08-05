from __future__ import annotations

import pytest


@pytest.fixture
def subject_id(client) -> int:
    return client.post("/api/subjects", json={"name": "Phys"}).json()["id"]


def _make_card(client, subject_id, front="Q", is_draft=False) -> int:
    return client.post(
        "/api/cards",
        json={
            "subject_id": subject_id,
            "front_md": front,
            "back_md": "A",
            "tag_names": [],
            "is_draft": is_draft,
        },
    ).json()["id"]


def _correct(client, card_id, times=1) -> None:
    for _ in range(times):
        r = client.post(
            "/api/practice/attempt", json={"card_id": card_id, "result": "correct"}
        )
        assert r.status_code == 200


def test_home_stats_empty(client):
    r = client.get("/api/stats/home")
    assert r.status_code == 200
    body = r.json()
    assert body["totals"]["subjects"] == 0
    assert body["totals"]["cards"] == 0
    assert body["totals"]["drafts"] == 0
    assert body["totals"]["memorized"] == 0
    assert body["totals"]["familiar"] == 0
    assert body["totals"]["learning"] == 0
    assert body["totals"]["new"] == 0
    assert body["subjects"] == []
    assert body["needs_review"] == []


def test_home_stats_totals_add_up(client, subject_id):
    fresh = _make_card(client, subject_id, "fresh")
    learner = _make_card(client, subject_id, "learner")
    _make_card(client, subject_id, "new1")
    _make_card(client, subject_id, "new2")

    # learner: 7 corrects → memorized (recent + high ratio + enough samples)
    _correct(client, fresh, times=7)
    # one attempt only → learning bucket
    _correct(client, learner, times=1)

    body = client.get("/api/stats/home").json()
    t = body["totals"]
    assert t["cards"] == 4
    assert t["memorized"] + t["familiar"] + t["learning"] + t["new"] == t["cards"]
    assert t["memorized"] >= 1
    assert t["learning"] >= 1
    assert t["new"] == 2


def test_home_stats_per_subject_segments_sum_to_card_count(client):
    a = client.post("/api/subjects", json={"name": "A"}).json()["id"]
    b = client.post("/api/subjects", json={"name": "B"}).json()["id"]
    for _ in range(3):
        _make_card(client, a)
    for _ in range(2):
        _make_card(client, b)

    body = client.get("/api/stats/home").json()
    by_id = {s["id"]: s for s in body["subjects"]}
    for sid in (a, b):
        s = by_id[sid]
        assert s["memorized"] + s["familiar"] + s["learning"] + s["new"] == s["card_count"]
    assert by_id[a]["card_count"] == 3
    assert by_id[b]["card_count"] == 2


def test_needs_review_sorted_desc_and_capped(client, subject_id):
    # 10 brand-new cards (max weight) — needs_review should cap at 8.
    for i in range(10):
        _make_card(client, subject_id, f"c{i}")

    body = client.get("/api/stats/home").json()
    review = body["needs_review"]
    assert len(review) == 8

    weights = [c["weight"] for c in review]
    assert weights == sorted(weights, reverse=True)


def test_drafts_excluded_from_totals_and_review_queue(client, subject_id):
    _make_card(client, subject_id, "ready")
    draft = _make_card(client, subject_id, "wip", is_draft=True)

    body = client.get("/api/stats/home").json()
    assert body["totals"]["cards"] == 1
    assert body["totals"]["drafts"] == 1
    assert body["totals"]["new"] == 1
    assert [s["card_count"] for s in body["subjects"]] == [1]
    assert draft not in [c["id"] for c in body["needs_review"]]


def test_needs_review_prioritizes_unseen_over_recent_correct(client, subject_id):
    fresh = _make_card(client, subject_id, "fresh-correct")
    unseen = _make_card(client, subject_id, "unseen")
    _correct(client, fresh, times=5)

    body = client.get("/api/stats/home").json()
    review = body["needs_review"]
    assert review[0]["id"] == unseen
    # fresh-correct card should appear below unseen
    ids = [c["id"] for c in review]
    assert ids.index(unseen) < ids.index(fresh)
