"""斬界アリーナ ターン制のローカルサーバー。

ゲームのファイルを配り、セーブを saves/save.json に読み書きする。
Python の標準ライブラリだけで動く。

    python server.py          # http://localhost:8766/
    python server.py 8771     # ポートを変えるとき (環境変数 PORT でも指定できる)
    python server.py --open   # 起動したらブラウザでゲームを開く (start.bat はこれを使う)

API
    GET /api/save   -> 200 {"save": セーブ または null}  (ファイルはあるが読めないときは {"save": null, "unreadable": true})
    PUT /api/save   -> 200 {"ok": true, "stale": false}
                       受け取ったセーブより新しい (savedAt が大きい) セーブがすでにあるときは書き換えず、stale: true を返す
                       1 つ前のセーブを save.json.bak に残す。形 (v) の違う・読めないセーブを置き換えるときは
                       save.json.v<形>.bak / save.json.unreadable.bak にも残す
"""

import errno
import json
import os
import shutil
import socket
import sys
import threading
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
SAVE_DIR = os.path.join(ROOT, 'saves')
SAVE_FILE = os.path.join(SAVE_DIR, 'save.json')
BACKUP_FILE = SAVE_FILE + '.bak'   # 1 つ前のセーブ
MAX_BODY = 512 * 1024              # セーブ 1 回分の大きさの上限 (バイト)
API_PATH = '/api/save'

save_lock = threading.Lock()


UNREADABLE = object()               # read_save の戻り値: ファイルはあるが読めない


def read_save():
    try:
        with open(SAVE_FILE, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as err:
        print(f'セーブを読めませんでした: {err}', file=sys.stderr)
        return UNREADABLE


def write_save(data, current):
    """一時ファイルに書いてから置き換える (途中で止まっても前のセーブが壊れないように)。"""
    os.makedirs(SAVE_DIR, exist_ok=True)
    if os.path.exists(SAVE_FILE):
        shutil.copyfile(SAVE_FILE, BACKUP_FILE)
        # 形 (v) の違うセーブ・読めないセーブを置き換えるときは、別の名前にも控えを残す (次の保存で .bak が上書きされても消えないように)
        old_v = current.get('v') if isinstance(current, dict) else None
        if old_v != data.get('v'):
            name = f'.v{old_v}.bak' if isinstance(old_v, int) else '.unreadable.bak'
            shutil.copyfile(SAVE_FILE, SAVE_FILE + name)
    tmp = SAVE_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, SAVE_FILE)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # ゲームのファイルを直したらすぐ反映されるように、キャッシュさせない
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_path(self):
        return self.path.split('?', 1)[0] == API_PATH

    def do_GET(self):
        if not self.api_path():
            # saves/ の中身はゲームのファイルとして配らない
            if self.path.split('?', 1)[0].lstrip('/').startswith('saves'):
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            super().do_GET()
            return
        with save_lock:
            data = read_save()
            self.send_json(HTTPStatus.OK, {'save': None, 'unreadable': True} if data is UNREADABLE else {'save': data})

    def do_PUT(self):
        if not self.api_path():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY:
            self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'セーブの大きさが不正です'})
            return
        try:
            data = json.loads(self.rfile.read(length).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'JSON として読めません'})
            return
        if not isinstance(data, dict) or not isinstance(data.get('v'), int) or not isinstance(data.get('savedAt'), (int, float)):
            self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'セーブの形ではありません'})
            return
        with save_lock:
            current = read_save()
            # 通信の順番が入れ替わって、古いセーブで上書きしないようにする
            if isinstance(current, dict) and isinstance(current.get('savedAt'), (int, float)) and current['savedAt'] > data['savedAt']:
                self.send_json(HTTPStatus.OK, {'ok': True, 'stale': True})
                return
            try:
                write_save(data, current)
            except OSError as err:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'error': f'書き込めませんでした: {err}'})
                return
        self.send_json(HTTPStatus.OK, {'ok': True, 'stale': False})

    def log_message(self, fmt, *args):
        # 30 秒ごとの自動セーブでログが埋まらないように、成功した API の記録は出さない
        if self.api_path() and len(args) > 1 and str(args[1]).startswith('2'):
            return
        super().log_message(fmt, *args)


class Server(ThreadingHTTPServer):
    # HTTPServer は SO_REUSEADDR を付けるが、Windows ではそれで使用中のポートにも二重に入れてしまう。
    # ほかのサーバーが動いているときは起動に失敗させる
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class Server6(Server):
    address_family = socket.AF_INET6


def make_server(family, host, port):
    return (Server6 if family == socket.AF_INET6 else Server)((host, port), Handler)


def main():
    args = sys.argv[1:]
    open_browser = '--open' in args
    args = [a for a in args if a != '--open']
    port = int(args[0]) if args else int(os.environ.get('PORT', '8766'))
    # 自分の PC からだけつながるようにする。localhost は ::1 (IPv6) を先に試すので、両方で待ち受ける
    # (127.0.0.1 だけだと、Windows では ::1 への接続が断られるまで約 2 秒かかり、その間ゲームが待たされる)
    servers = []
    for family, host in [(socket.AF_INET, '127.0.0.1'), (socket.AF_INET6, '::1')]:
        try:
            servers.append(make_server(family, host, port))
        except OSError as err:
            if family == socket.AF_INET or err.errno == errno.EADDRINUSE:
                for s in servers:
                    s.server_close()
                print(f'ポート {port} で起動できませんでした ({err})。ほかのサーバーが動いていないか確かめるか、別のポートを指定してください。', file=sys.stderr)
                sys.exit(1)
            print(f'IPv6 (::1) では待ち受けません ({err})。', file=sys.stderr)
    url = f'http://localhost:{port}/'
    print(f'斬界アリーナ ターン制: {url}  (セーブ: {SAVE_FILE})  Ctrl+C で止める')
    for s in servers[1:]:
        threading.Thread(target=s.serve_forever, daemon=True).start()
    # ポートを確保してから開くので、ブラウザがつながる前にサーバーが止まっていることはない
    if open_browser:
        webbrowser.open(url)
    try:
        servers[0].serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for s in servers:
            s.server_close()


if __name__ == '__main__':
    main()
