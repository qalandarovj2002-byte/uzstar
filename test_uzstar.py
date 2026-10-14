"""UZStar backend smoke test. Faqat Python standart kutubxonasi kerak.
Ishga tushirish: python test_uzstar.py
Testlar vaqtinchalik baza ishlatadi va mavjud data/ papkasiga tegmaydi.
"""
from __future__ import annotations
import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request(opener, url, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with opener.open(req, timeout=8) as response:
            raw = response.read()
            try: payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError): payload = raw
            return response.status, payload, response.headers
    except urllib.error.HTTPError as error:
        raw = error.read()
        try: payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError): payload = raw
        return error.code, payload, error.headers


def multipart(fields, filename, file_bytes, content_type="video/mp4"):
    boundary = "----UZStarSmokeTestBoundary7MA4YWxk"
    chunks = []
    for key, value in fields.items():
        chunks.extend([f"--{boundary}\r\n".encode(),
                       f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                       str(value).encode("utf-8"), b"\r\n"])
    chunks.extend([f"--{boundary}\r\n".encode(),
                   f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
                   f"Content-Type: {content_type}\r\n\r\n".encode(), file_bytes, b"\r\n",
                   f"--{boundary}--\r\n".encode()])
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def check(condition, message):
    if not condition:
        raise RuntimeError("FAIL: " + message)
    print("PASS: " + message)


def main():
    with tempfile.TemporaryDirectory(prefix="uzstar-test-") as data_dir:
        port = free_port()
        env = os.environ.copy()
        env.update({"UZSTAR_DATA_DIR": data_dir, "UZSTAR_PORT": str(port), "UZSTAR_HOST": "127.0.0.1"})
        process = subprocess.Popen([sys.executable, str(ROOT / "server.py")], cwd=ROOT, env=env,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        base = f"http://127.0.0.1:{port}"
        try:
            anonymous = client()
            for _ in range(60):
                try:
                    status, health, _ = request(anonymous, base + "/api/health")
                    if status == 200: break
                except (OSError, urllib.error.URLError): pass
                time.sleep(0.15)
            else: raise RuntimeError("Server 9 soniya ichida ishga tushmadi")
            check(health.get("version") == "2.7", "Server health endpoint")
            check(request(anonymous, base + "/")[0] == 200, "Bosh sahifa HTTP 200")
            check(request(anonymous, base + "/assets/uzstar-demo.mp4")[0] == 200, "Mahalliy namuna video")

            # Serverga videoni mehmon sifatida yuklash rad etilishi kerak.
            sample = (ROOT / "assets" / "uzstar-demo.mp4").read_bytes()
            body, ctype = multipart({"title":"Ruxsatsiz video", "category":"Ta’lim"}, "sample.mp4", sample)
            status, payload, _ = request(anonymous, base + "/api/videos", "POST", body, {"Content-Type":ctype})
            check(status == 401 and payload.get("code") == "AUTH_REQUIRED", "Mehmon video yuklay olmaydi")

            owner = client()
            status, payload, _ = request(owner, base + "/api/auth/register", "POST",
                json.dumps({"username":"owner_test", "password":"StrongPassword123!", "displayName":"UZStar Egasi"}).encode(),
                {"Content-Type":"application/json"})
            check(status == 201, "Ro‘yxatdan o‘tish va sessiya cookie")
            status, payload, _ = request(owner, base + "/api/me", "PATCH",
                json.dumps({"displayName":"UZStar Yangilandi"}).encode(), {"Content-Type":"application/json"})
            check(status == 200 and payload["user"]["displayName"] == "UZStar Yangilandi", "Profilni serverda yangilash")

            body, ctype = multipart({"title":"Smoke test video", "category":"Ta’lim", "description":"Sinov", "short":"false"}, "sample.mp4", sample)
            status, payload, _ = request(owner, base + "/api/videos", "POST", body, {"Content-Type":ctype})
            check(status == 201 and payload["video"]["isOwner"], "Akkaunt bilan video yuklash va egalik")
            video = payload["video"]; video_id = video["serverId"]
            status, payload, _ = request(owner, base + f"/api/videos/{video_id}/comments", "POST",
                json.dumps({"body":"Sinov izohi"}).encode(), {"Content-Type":"application/json"})
            check(status == 201, "Izoh yozish")
            status, payload, _ = request(owner, base + f"/api/videos/{video_id}/like", "POST")
            check(status == 200 and payload.get("liked"), "Laykni bazada saqlash")
            status, raw, headers = request(owner, base + video["videoUrl"], headers={"Range":"bytes=0-15"})
            check(status == 206 and len(raw) == 16 and headers.get("Content-Range"), "Video Range / seek oqimi")

            second = client()
            status, _, _ = request(second, base + "/api/auth/register", "POST",
                json.dumps({"username":"other_test", "password":"StrongPassword456!", "displayName":"Boshqa"}).encode(),
                {"Content-Type":"application/json"})
            check(status == 201, "Ikkinchi test akkaunti")
            status, _, _ = request(second, base + f"/api/videos/{video_id}", "DELETE")
            check(status == 403, "Boshqa foydalanuvchi videoni o‘chira olmaydi")
            status, _, _ = request(owner, base + f"/api/videos/{video_id}", "DELETE")
            check(status == 200, "Video egasi o‘z videosini o‘chira oladi")
            print("\nUZStar backend smoke testlari muvaffaqiyatli tugadi.")
        finally:
            process.terminate()
            try: process.wait(timeout=3)
            except subprocess.TimeoutExpired: process.kill()


if __name__ == "__main__":
    try: main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise
