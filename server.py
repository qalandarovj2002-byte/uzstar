"""UZStar 2.5: standard-library backend with SQLite, accounts and safe local video streaming.
Local development only. Put behind HTTPS + reverse proxy before public deployment.
"""
from __future__ import annotations
import hashlib, hmac, json, mimetypes, os, re, secrets, sqlite3, time, uuid
from datetime import datetime, timedelta, timezone
from email.parser import BytesParser
from email.policy import default
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("UZSTAR_DATA_DIR", str(BASE_DIR / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "uzstar.sqlite3"
MAX_UPLOAD_BYTES = 150 * 1024 * 1024
MAX_JSON_BYTES = 64 * 1024
SESSION_DAYS = 14
PBKDF2_ROUNDS = 310_000
ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"}
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LOGIN_ATTEMPTS: dict[str, list[float]] = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect_db():
    db = sqlite3.connect(DB_PATH, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=20000")
    return db


def init_db():
    with connect_db() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions(
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS videos(
          id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, channel TEXT NOT NULL,
          category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL UNIQUE,
          mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, is_short INTEGER NOT NULL DEFAULT 0,
          views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
          owner_id INTEGER, FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS comments(
          id INTEGER PRIMARY KEY AUTOINCREMENT, video_id INTEGER NOT NULL, author TEXT NOT NULL,
          body TEXT NOT NULL, created_at TEXT NOT NULL, user_id INTEGER,
          FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS video_likes(
          user_id INTEGER NOT NULL, video_id INTEGER NOT NULL, created_at TEXT NOT NULL,
          PRIMARY KEY(user_id, video_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS subscriptions(
          subscriber_id INTEGER NOT NULL, creator_id INTEGER NOT NULL, created_at TEXT NOT NULL,
          PRIMARY KEY(subscriber_id, creator_id), CHECK(subscriber_id != creator_id),
          FOREIGN KEY(subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
        """)
        # Upgrade databases created by UZStar 1.0 without deleting any user content.
        columns = {row[1] for row in db.execute("PRAGMA table_info(videos)")}
        if "owner_id" not in columns:
            db.execute("ALTER TABLE videos ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
        columns = {row[1] for row in db.execute("PRAGMA table_info(comments)")}
        if "user_id" not in columns:
            db.execute("ALTER TABLE comments ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
        db.execute("DELETE FROM sessions WHERE expires_at < ?", (now_iso(),))


def hash_password(password: str, salt: bytes | None = None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return salt.hex(), digest.hex()


def hash_token(token: str):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def video_dict(row, liked=False, subscriber=False):
    created = row["created_at"]
    categories = {"Musiqa":"music", "Ta’lim":"learn", "O‘yinlar":"game", "Kino":"cinema", "Texnologiya":"tech", "Hayot tarzi":"life"}
    return {"id": f"srv_{row['id']}", "title": row["title"], "channel": row["channel"],
      "views": f"{row['views']:,}".replace(",", " "), "viewCount": row["views"],
      "age": created[:10], "duration":"YANGI", "category":row["category"],
      "palette":categories.get(row["category"], "life"), "icon":"📱" if row["is_short"] else "▶",
      "description":row["description"], "short":bool(row["is_short"]),
      "videoUrl":f"/uploads/{row['filename']}", "uploaded":True, "serverBacked":True,
      "serverId":row["id"], "fileSize":row["file_size"], "liked":bool(liked),
      "createdAt":created, "ownerId":row["owner_id"] if "owner_id" in row.keys() else None,
      "isOwner":bool(subscriber)}


class UZStarHandler(SimpleHTTPRequestHandler):
    server_version = "UZStar/2.7"
    sys_version = ""

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {self.address_string()} {fmt % args}")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob: https://interactive-examples.mdn.mozilla.net; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        super().end_headers()

    def send_json(self, payload, status=200, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items(): self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: raise ValueError("So‘rov hajmi noto‘g‘ri.")
        if length < 1 or length > MAX_JSON_BYTES: raise ValueError("JSON so‘rov hajmi noto‘g‘ri yoki juda katta.")
        try: value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError): raise ValueError("JSON ma’lumoti noto‘g‘ri.")
        if not isinstance(value, dict): raise ValueError("JSON obyekt bo‘lishi kerak.")
        return value

    def current_user(self):
        cookie = SimpleCookie()
        try: cookie.load(self.headers.get("Cookie", ""))
        except Exception: return None
        morsel = cookie.get("uzstar_session")
        if not morsel: return None
        token = morsel.value
        if not re.fullmatch(r"[a-f0-9]{64}", token): return None
        with connect_db() as db:
            row = db.execute("SELECT u.id,u.username,u.display_name,u.created_at,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?", (hash_token(token),)).fetchone()
            if not row: return None
            if row["expires_at"] < now_iso():
                db.execute("DELETE FROM sessions WHERE token_hash=?", (hash_token(token),)); return None
            return dict(row)

    def require_user(self):
        user = self.current_user()
        if not user: self.send_json({"error":"Bu amal uchun avval tizimga kiring.","code":"AUTH_REQUIRED"}, 401)
        return user

    def check_origin(self):
        # Browser state-changing requests from other sites are rejected. CLI/local tools without Origin are allowed.
        origin = self.headers.get("Origin")
        if not origin: return True
        parsed = urlparse(origin)
        host = self.headers.get("Host", "")
        return parsed.netloc == host and parsed.scheme in {"http", "https"}

    def do_GET(self):
        parsed = urlparse(self.path); path = unquote(parsed.path); query = parse_qs(parsed.query)
        if path == "/api/health":
            with connect_db() as db:
                counts = {"videos":db.execute("SELECT COUNT(*) FROM videos").fetchone()[0], "users":db.execute("SELECT COUNT(*) FROM users").fetchone()[0]}
            return self.send_json({"ok":True,"app":"UZStar","version":"2.7","database":"sqlite","features":["accounts","uploads","comments","likes","subscriptions","range-streaming"],"counts":counts})
        if path == "/api/me":
            user = self.current_user()
            if not user: return self.send_json({"user":None})
            with connect_db() as db:
                liked_ids = [r[0] for r in db.execute("SELECT video_id FROM video_likes WHERE user_id=?", (user["id"],))]
                subscriptions = [r[0] for r in db.execute("SELECT creator_id FROM subscriptions WHERE subscriber_id=?", (user["id"],))]
            return self.send_json({"user":{"id":user["id"],"username":user["username"],"displayName":user["display_name"]},"likedVideoIds":liked_ids,"subscriptions":subscriptions})
        if path == "/api/videos":
            search = query.get("q", [""])[0].strip()[:100]
            category = query.get("category", [""])[0].strip()[:40]
            short = query.get("short", [""])[0]
            sort = query.get("sort", ["new"])[0]
            try: page = max(1, min(10000, int(query.get("page", ["1"])[0]))); limit = max(1, min(50, int(query.get("limit", ["50"])[0])))
            except ValueError: return self.send_json({"error":"Sahifa yoki limit qiymati noto‘g‘ri."}, 400)
            where, params = [], []
            if search: where.append("(title LIKE ? OR channel LIKE ? OR description LIKE ? OR category LIKE ?)"); params.extend([f"%{search}%"]*4)
            if category and category != "Barchasi": where.append("category=?"); params.append(category)
            if short in {"true", "false", "1", "0"}: where.append("is_short=?"); params.append(1 if short in {"true","1"} else 0)
            order = {"popular":"views DESC, id DESC", "title":"title COLLATE NOCASE ASC", "old":"id ASC"}.get(sort, "id DESC")
            clause = (" WHERE " + " AND ".join(where)) if where else ""
            with connect_db() as db:
                total = db.execute("SELECT COUNT(*) FROM videos"+clause, params).fetchone()[0]
                rows = db.execute("SELECT * FROM videos"+clause+f" ORDER BY {order} LIMIT ? OFFSET ?", [*params,limit,(page-1)*limit]).fetchall()
                user = self.current_user()
                liked_ids = set()
                owned_ids = set()
                if user and rows:
                    ids = [r["id"] for r in rows]; placeholders = ",".join("?" for _ in ids)
                    liked_ids = {r[0] for r in db.execute(f"SELECT video_id FROM video_likes WHERE user_id=? AND video_id IN ({placeholders})", [user["id"],*ids])}
                    owned_ids = {r[0] for r in db.execute(f"SELECT id FROM videos WHERE owner_id=? AND id IN ({placeholders})", [user["id"],*ids])}
            return self.send_json({"videos":[video_dict(row,row["id"] in liked_ids,row["id"] in owned_ids) for row in rows],"page":page,"limit":limit,"total":total,"pages":(total+limit-1)//limit})
        match = re.fullmatch(r"/api/videos/(\d+)/comments", path)
        if match:
            with connect_db() as db:
                if not db.execute("SELECT id FROM videos WHERE id=?", (int(match.group(1)),)).fetchone(): return self.send_json({"error":"Video topilmadi."},404)
                rows = db.execute("SELECT author,body,created_at FROM comments WHERE video_id=? ORDER BY id ASC LIMIT 200", (int(match.group(1)),)).fetchall()
            return self.send_json({"comments":[{"name":r["author"],"text":r["body"],"at":r["created_at"][:10]} for r in rows]})
        if path == "/api/creators":
            viewer = self.current_user()
            with connect_db() as db:
                rows = db.execute("""SELECT u.id,u.username,u.display_name,u.created_at,
                    COUNT(DISTINCT v.id) AS video_count,
                    (SELECT COUNT(*) FROM subscriptions s2 WHERE s2.creator_id=u.id) AS followers
                    FROM users u LEFT JOIN videos v ON v.owner_id=u.id
                    GROUP BY u.id ORDER BY video_count DESC, followers DESC, u.id DESC LIMIT 100""").fetchall()
                subscribed = set()
                if viewer:
                    subscribed = {r[0] for r in db.execute("SELECT creator_id FROM subscriptions WHERE subscriber_id=?", (viewer["id"],))}
            return self.send_json({"creators":[{"id":r["id"],"username":r["username"],"displayName":r["display_name"],"createdAt":r["created_at"],"videoCount":r["video_count"],"followers":r["followers"],"subscribed":r["id"] in subscribed,"isSelf":bool(viewer and viewer["id"]==r["id"])} for r in rows]})
        match = re.fullmatch(r"/api/users/([A-Za-z0-9_.-]{3,24})", path)
        if match:
            with connect_db() as db:
                user = db.execute("SELECT id,username,display_name,created_at FROM users WHERE username=? COLLATE NOCASE", (match.group(1),)).fetchone()
                if not user: return self.send_json({"error":"Foydalanuvchi topilmadi."},404)
                videos = db.execute("SELECT * FROM videos WHERE owner_id=? ORDER BY id DESC LIMIT 50", (user["id"],)).fetchall()
                followers = db.execute("SELECT COUNT(*) FROM subscriptions WHERE creator_id=?", (user["id"],)).fetchone()[0]
            return self.send_json({"user":{"username":user["username"],"displayName":user["display_name"],"createdAt":user["created_at"],"followers":followers},"videos":[video_dict(v) for v in videos]})
        if path.startswith("/api/") or path == "/data" or path.startswith("/data/"):
            return self.send_json({"error":"API manzili topilmadi."},404)
        if path.startswith("/uploads/"):
            name = path.removeprefix("/uploads/")
            if Path(name).name != name or not re.fullmatch(r"[a-f0-9]{32}\.(mp4|webm|mov|m4v|ogv|ogg)",name): return self.send_json({"error":"Video manzili noto‘g‘ri."},400)
            return self.serve_video(UPLOAD_DIR/name)
        return super().do_GET()

    def serve_video(self, path: Path):
        # Byte-range support enables seeking without downloading the whole video.
        if not path.is_file(): return self.send_json({"error":"Video fayli topilmadi."},404)
        size = path.stat().st_size; start, end = 0, size-1; status = 200
        range_header = self.headers.get("Range")
        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)",range_header.strip())
            if not match:
                self.send_response(416); self.send_header("Content-Range", f"bytes */{size}"); self.send_header("Content-Length", "0"); self.end_headers(); return
            left,right = match.groups()
            if not left and not right:
                self.send_response(416); self.send_header("Content-Range", f"bytes */{size}"); self.send_header("Content-Length", "0"); self.end_headers(); return
            if not left:
                length = int(right or 0); start=max(0,size-length)
            else: start=int(left)
            if right and left: end=int(right)
            if start >= size or end < start: 
                self.send_response(416); self.send_header("Content-Range",f"bytes */{size}"); self.send_header("Content-Length","0"); self.end_headers(); return
            end=min(end,size-1); status=206
        length=end-start+1
        self.send_response(status)
        self.send_header("Content-Type",mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Accept-Ranges","bytes"); self.send_header("Content-Length",str(length)); self.send_header("Cache-Control","public, max-age=3600")
        if status == 206: self.send_header("Content-Range",f"bytes {start}-{end}/{size}")
        self.end_headers()
        try:
            with path.open("rb") as handle:
                handle.seek(start); remaining=length
                while remaining:
                    chunk=handle.read(min(256*1024,remaining))
                    if not chunk: break
                    self.wfile.write(chunk); remaining-=len(chunk)
        except (BrokenPipeError, ConnectionResetError): pass

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        if not self.check_origin(): return self.send_json({"error":"Boshqa saytdan kelgan so‘rov rad etildi."},403)
        if path in {"/api/auth/register","/api/auth/login"}: return self.handle_auth(path.endswith("register"))
        if path == "/api/auth/logout":
            cookie=SimpleCookie()
            try: cookie.load(self.headers.get("Cookie","")); token=cookie.get("uzstar_session")
            except Exception: token=None
            if token:
                with connect_db() as db: db.execute("DELETE FROM sessions WHERE token_hash=?",(hash_token(token.value),))
            return self.send_json({"ok":True},extra_headers={"Set-Cookie":"uzstar_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"})
        if path == "/api/videos": return self.handle_upload()
        match=re.fullmatch(r"/api/videos/(\d+)/comments",path)
        if match: return self.handle_comment(int(match.group(1)))
        match=re.fullmatch(r"/api/videos/(\d+)/views",path)
        if match:
            vid=int(match.group(1))
            with connect_db() as db:
                cur=db.execute("UPDATE videos SET views=views+1 WHERE id=?",(vid,))
                if cur.rowcount == 0: return self.send_json({"error":"Video topilmadi."},404)
                row=db.execute("SELECT * FROM videos WHERE id=?",(vid,)).fetchone()
            return self.send_json({"video":video_dict(row)})
        match=re.fullmatch(r"/api/videos/(\d+)/like",path)
        if match: return self.handle_like(int(match.group(1)),True)
        match=re.fullmatch(r"/api/users/(\d+)/subscribe",path)
        if match: return self.handle_subscribe(int(match.group(1)),True)
        return self.send_json({"error":"API manzili topilmadi."},404)

    def do_PATCH(self):
        path = unquote(urlparse(self.path).path)
        if not self.check_origin(): return self.send_json({"error":"Boshqa saytdan kelgan so‘rov rad etildi."},403)
        if path != "/api/me": return self.send_json({"error":"API manzili topilmadi."},404)
        user = self.current_user()
        if not user: return self.send_json({"error":"Profilni tahrirlash uchun tizimga kiring.","code":"AUTH_REQUIRED"},401)
        try: data = self.read_json()
        except ValueError as error: return self.send_json({"error":str(error)},400)
        display = str(data.get("displayName", "")).strip()
        if len(display) < 2 or len(display) > 40: return self.send_json({"error":"Ism 2–40 belgi bo‘lishi kerak."},400)
        with connect_db() as db:
            db.execute("UPDATE users SET display_name=? WHERE id=?", (display, user["id"]))
            db.execute("UPDATE videos SET channel=? WHERE owner_id=?", (display, user["id"]))
            db.execute("UPDATE comments SET author=? WHERE user_id=?", (display, user["id"]))
        return self.send_json({"user":{"id":user["id"],"username":user["username"],"displayName":display}})

    def do_DELETE(self):
        path=unquote(urlparse(self.path).path)
        if not self.check_origin(): return self.send_json({"error":"Boshqa saytdan kelgan so‘rov rad etildi."},403)
        match=re.fullmatch(r"/api/videos/(\d+)",path)
        if match:
            vid=int(match.group(1)); user=self.current_user()
            with connect_db() as db:
                row=db.execute("SELECT filename,owner_id FROM videos WHERE id=?",(vid,)).fetchone()
                if not row: return self.send_json({"error":"Video topilmadi."},404)
                if row["owner_id"] is not None and (not user or user["id"] != row["owner_id"]): return self.send_json({"error":"Bu videoni faqat egasi o‘chira oladi."},403)
                db.execute("DELETE FROM videos WHERE id=?",(vid,))
            try: (UPLOAD_DIR/row["filename"]).unlink(missing_ok=True)
            except OSError: pass
            return self.send_json({"ok":True})
        match=re.fullmatch(r"/api/videos/(\d+)/like",path)
        if match: return self.handle_like(int(match.group(1)),False)
        match=re.fullmatch(r"/api/users/(\d+)/subscribe",path)
        if match: return self.handle_subscribe(int(match.group(1)),False)
        return self.send_json({"error":"API manzili topilmadi."},404)

    def handle_auth(self, register):
        try: data=self.read_json()
        except ValueError as error: return self.send_json({"error":str(error)},400)
        username=str(data.get("username","" )).strip().lower()
        password=str(data.get("password",""))
        display=str(data.get("displayName",username)).strip()
        remote=self.client_address[0]
        attempts=LOGIN_ATTEMPTS.setdefault(remote,[]); now=time.time(); attempts[:]=[t for t in attempts if now-t<600]
        if len(attempts)>=12: return self.send_json({"error":"Juda ko‘p urinish. 10 daqiqadan keyin qayta urinib ko‘ring."},429)
        if not re.fullmatch(r"[a-z0-9_.-]{3,24}",username): return self.send_json({"error":"Foydalanuvchi nomi 3–24 belgi: a-z, 0-9, nuqta, _ yoki - bo‘lsin."},400)
        if len(password)<8 or len(password)>128: return self.send_json({"error":"Parol 8–128 belgidan iborat bo‘lishi kerak."},400)
        with connect_db() as db:
            user=db.execute("SELECT * FROM users WHERE username=? COLLATE NOCASE",(username,)).fetchone()
            if register:
                if user: return self.send_json({"error":"Bu foydalanuvchi nomi band. Boshqasini tanlang."},409)
                if len(display)<2 or len(display)>40: return self.send_json({"error":"Ko‘rinadigan ism 2–40 belgi bo‘lsin."},400)
                salt,digest=hash_password(password)
                cur=db.execute("INSERT INTO users(username,display_name,password_hash,salt,created_at) VALUES(?,?,?,?,?)",(username,display,digest,salt,now_iso()))
                user=db.execute("SELECT * FROM users WHERE id=?",(cur.lastrowid,)).fetchone()
            else:
                attempts.append(now)
                if not user:
                    # Perform a dummy hash to reduce username timing differences.
                    hash_password(password, b"UZStarDummySalt!")
                    return self.send_json({"error":"Login yoki parol noto‘g‘ri."},401)
                candidate=hashlib.pbkdf2_hmac("sha256",password.encode(),bytes.fromhex(user["salt"]),PBKDF2_ROUNDS).hex()
                if not hmac.compare_digest(candidate,user["password_hash"]): return self.send_json({"error":"Login yoki parol noto‘g‘ri."},401)
            token=secrets.token_hex(32); expires=(datetime.now(timezone.utc)+timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")
            db.execute("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",(hash_token(token),user["id"],expires,now_iso()))
            # Keep session table bounded.
            db.execute("DELETE FROM sessions WHERE expires_at < ?",(now_iso(),))
        attempts.clear()
        cookie=f"uzstar_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_DAYS*86400}"
        return self.send_json({"user":{"id":user["id"],"username":user["username"],"displayName":user["display_name"]}},201 if register else 200,{"Set-Cookie":cookie})

    def handle_upload(self):
        user = self.current_user()
        if not user: return self.send_json({"error":"Video yuklash uchun avval tizimga kiring.","code":"AUTH_REQUIRED"},401)
        try: length=int(self.headers.get("Content-Length","0"))
        except ValueError: return self.send_json({"error":"Fayl hajmi noto‘g‘ri."},400)
        if length<=0: return self.send_json({"error":"Yuklash uchun fayl tanlang."},400)
        if length>MAX_UPLOAD_BYTES+2*1024*1024: return self.send_json({"error":"Fayl 150 MB dan kichik bo‘lishi kerak."},413)
        ctype=self.headers.get("Content-Type","")
        if "multipart/form-data" not in ctype.lower(): return self.send_json({"error":"Fayl multipart/form-data formatida yuborilishi kerak."},400)
        body=self.rfile.read(length)
        try:
            msg=BytesParser(policy=default).parsebytes((f"Content-Type: {ctype}\r\nMIME-Version: 1.0\r\n\r\n").encode()+body)
            fields={}; upload=None
            for part in msg.iter_parts():
                field=part.get_param("name",header="content-disposition"); filename=part.get_filename()
                if filename and field=="file": upload=(filename,part)
                elif not filename: fields[field]=((part.get_payload(decode=True) or b"").decode("utf-8",errors="replace")).strip()
        except Exception: return self.send_json({"error":"Yuklangan forma o‘qilmadi."},400)
        if not upload: return self.send_json({"error":"Video fayl topilmadi."},400)
        original,part=upload; ext=Path(original).suffix.lower(); mime=part.get_content_type() or mimetypes.guess_type(original)[0] or "application/octet-stream"; blob=part.get_payload(decode=True) or b""
        if ext not in ALLOWED_EXTENSIONS or not mime.startswith("video/"): return self.send_json({"error":"MP4, WebM, MOV, M4V yoki OGV video tanlang."},415)
        if not blob: return self.send_json({"error":"Video fayli bo‘sh."},400)
        if len(blob)>MAX_UPLOAD_BYTES: return self.send_json({"error":"Fayl 150 MB dan kichik bo‘lishi kerak."},413)
        title=fields.get("title","")[:100].strip(); category=fields.get("category","Boshqa")[:40].strip() or "Boshqa"; desc=fields.get("description","")[:2000].strip()
        if not title: return self.send_json({"error":"Video sarlavhasi kiritilishi shart."},400)
        channel=(user["display_name"] if user else "UZStar foydalanuvchisi")[:60].strip() or "UZStar foydalanuvchisi"
        short=1 if fields.get("short","false").lower() in {"true","1","on","yes"} else 0
        filename=f"{uuid.uuid4().hex}{ext}"; dest=UPLOAD_DIR/filename
        try:
            dest.write_bytes(blob)
            with connect_db() as db:
                cur=db.execute("INSERT INTO videos(title,channel,category,description,filename,mime_type,file_size,is_short,created_at,owner_id) VALUES(?,?,?,?,?,?,?,?,?,?)",(title,channel,category,desc,filename,mime,len(blob),short,now_iso(),user["id"] if user else None))
                row=db.execute("SELECT * FROM videos WHERE id=?",(cur.lastrowid,)).fetchone()
            return self.send_json({"video":video_dict(row, False, bool(user))},201)
        except Exception as error:
            dest.unlink(missing_ok=True); print("Video saqlash xatosi:",error)
            return self.send_json({"error":"Video saqlanmadi. Diskda joy borligini tekshiring."},500)

    def handle_comment(self, video_id):
        try: data=self.read_json()
        except ValueError as error: return self.send_json({"error":str(error)},400)
        body=str(data.get("body","")).strip()
        if not body or len(body)>1000: return self.send_json({"error":"Izoh 1–1000 belgi oralig‘ida bo‘lishi kerak."},400)
        user=self.current_user(); author=(user["display_name"] if user else str(data.get("author","UZStar foydalanuvchisi")).strip()[:60]) or "UZStar foydalanuvchisi"
        with connect_db() as db:
            if not db.execute("SELECT id FROM videos WHERE id=?",(video_id,)).fetchone(): return self.send_json({"error":"Video topilmadi."},404)
            created=now_iso(); db.execute("INSERT INTO comments(video_id,author,body,created_at,user_id) VALUES(?,?,?,?,?)",(video_id,author,body,created,user["id"] if user else None))
        return self.send_json({"comment":{"name":author,"text":body,"at":created[:10]}},201)

    def handle_like(self, video_id, add):
        user=self.current_user()
        if not user: return self.send_json({"error":"Layklarni serverda saqlash uchun tizimga kiring.","code":"AUTH_REQUIRED"},401)
        with connect_db() as db:
            if not db.execute("SELECT id FROM videos WHERE id=?",(video_id,)).fetchone(): return self.send_json({"error":"Video topilmadi."},404)
            if add: db.execute("INSERT OR IGNORE INTO video_likes(user_id,video_id,created_at) VALUES(?,?,?)",(user["id"],video_id,now_iso()))
            else: db.execute("DELETE FROM video_likes WHERE user_id=? AND video_id=?",(user["id"],video_id))
            count=db.execute("SELECT COUNT(*) FROM video_likes WHERE video_id=?",(video_id,)).fetchone()[0]
        return self.send_json({"ok":True,"liked":add,"likes":count})

    def handle_subscribe(self, creator_id, add):
        user=self.current_user()
        if not user: return self.send_json({"error":"Obuna bo‘lish uchun tizimga kiring.","code":"AUTH_REQUIRED"},401)
        if user["id"]==creator_id: return self.send_json({"error":"O‘zingizga obuna bo‘la olmaysiz."},400)
        with connect_db() as db:
            if not db.execute("SELECT id FROM users WHERE id=?",(creator_id,)).fetchone(): return self.send_json({"error":"Kanal topilmadi."},404)
            if add: db.execute("INSERT OR IGNORE INTO subscriptions(subscriber_id,creator_id,created_at) VALUES(?,?,?)",(user["id"],creator_id,now_iso()))
            else: db.execute("DELETE FROM subscriptions WHERE subscriber_id=? AND creator_id=?",(user["id"],creator_id))
            count=db.execute("SELECT COUNT(*) FROM subscriptions WHERE creator_id=?",(creator_id,)).fetchone()[0]
        return self.send_json({"ok":True,"subscribed":add,"followers":count})


def main():
    init_db()
    # Render kabi hostinglar PORT beradi; lokal ishga tushirishda 8000 ishlatiladi.
    try:
        port = int(os.environ.get("PORT", os.environ.get("UZSTAR_PORT", "8000")))
    except ValueError:
        raise SystemExit("PORT yoki UZSTAR_PORT raqam bo‘lishi kerak.")
    host = os.environ.get("UZSTAR_HOST", "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    class Server(ThreadingHTTPServer):
        daemon_threads=True
        allow_reuse_address=True
    server=Server((host,port),lambda *a,**kw: UZStarHandler(*a,directory=str(BASE_DIR),**kw))
    print("\nUZStar backend ishga tushdi")
    print(f"Manzil: http://{host}:{port}")
    print(f"SQLite baza: {DB_PATH}")
    print("To‘xtatish: Ctrl+C\n")
    try: server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt: print("\nUZStar serveri to‘xtatildi.")
    finally: server.server_close()

if __name__=="__main__": main()
