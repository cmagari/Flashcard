from __future__ import annotations


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_info_paths_point_at_test_data_dir(client, tmp_path):
    r = client.get("/api/info")
    assert r.status_code == 200
    body = r.json()
    expected = str(tmp_path)
    assert body["data_dir"] == expected
    assert body["db_path"].startswith(expected)
    assert body["images_dir"].startswith(expected)
