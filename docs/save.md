# セーブとサーバー

自動セーブの中身、保存先（ブラウザとサーバー）、読み込み。コードは `src/save.js`、サーバーは `server.py`。
保存する項目を増やしたら、ここと `buildSave` / `applySave` を合わせて直す。形を変えたら `SAVE_VERSION` を上げ、`migrateSave` に古い形からの変換を足す。

## いつ保存するか（`params.js` の `save`）

- 30 秒ごと、門を通ったとき、レベルアップ、持ち物・店・クエストの画面を閉じたとき、クエストを受けた・報告したとき、倒れたとき、ページを閉じるとき
- サーバーへ問い合わせるときは 5 秒まで待つ（`serverTimeout`）。時間内に返事がない・つながらないとき（`unreachable`）は、ブラウザだけに保存しながら、次に保存するときにもう一度確かめ、つながったら今のセーブを送る（`retryServer`）。404 など「サーバーではない」返事のときは確かめ直さない

## 保存先

| 起動のしかた | 保存先 |
|---|---|
| `start.bat` または `python server.py`（おすすめ） | サーバーの `saves/save.json` と、ブラウザの `localStorage`（キー `zankai-turn-save`）の両方 |
| `python -m http.server` や `index.html` を直接開く | ブラウザの `localStorage` だけ |

- 起動時（`initSave`）に両方を読み、`savedAt` が新しいほうを使う。ブラウザにしかないセーブ（またはブラウザのほうが新しいセーブ）は、そのときサーバーにも送る
- サーバーへの送信は 1 つずつ。送っている間に次のセーブが来たら、終わってから一番新しいものだけを送る。ページを閉じるときは待たずに送る（`keepalive`）
- サーバーに保存できなかったときはブラウザには保存し、一時停止画面にその旨を出す。保存先の説明はタイトルと一時停止画面に出る（`saveWhereText`）
- キーは、もとのリアルタイム版（斬界アリーナ、`zankai-arena-save`）とは別。同じブラウザで両方遊んでも混ざらない（ポートも 8766 と 8765 で別）

## セーブの形（v1）

```
{ v: 1, savedAt,
  player:   { level, exp, base, hp, gold, potions, inventory, materials, equip, quests },
  progress: { kills, time },
  location: { zone, tx, ty },
  home }
```

- `base` は成長で上がったステータス `{ maxHp, str, vit, agi, int }`（[progression.md](progression.md)）。`inventory` / `equip` は装備（`{ id, slot, name, rarity, level, stats }`）そのもの、`materials` は素材の数 `{ 素材のid: 数 }`、`quests` は `{ id: { state, count } }`、`potions` は回復薬の数 `{ 回復薬のキー: 数 }`（数だけの古いセーブは回復薬 `potion` の数として読む）
- `progress.time` はゲーム内の時刻（ターン）。`location` の `tx`, `ty` はマス
- ステータスそのもの（こうげき力など）は保存せず、読み込むときに「`base` + 装備」から計算し直す（`computeStats`）。式や装備の数値を変えても、続きから遊ぶと新しい数値が反映される
- `base` がない・数でない・目安から `spread × growthResetMult`（10）以上ずれた値は、そのレベルの目安の値にする
- `home` は倒れたときに戻る町のゾーン（[world.md](world.md)）。ない・町でないときは `WORLD.respawnZone`
- 倒れている間に保存するときは、`home` の町のかがり火にいるものとして保存する（`hp: null` で満タンから始まる）
- 読み込むとき、存在しないクエスト・部位・ステータスの装備・素材は捨てる（`STATS` にないステータスを持つ装備も捨てる）
- 形が違う（`v` が 1 でない）セーブは読まない（`migrateSave` が null を返す）

## サーバー（`server.py`）

- Python の標準ライブラリだけで動く。`python server.py [ポート] [--open]`（ポートの省略時は環境変数 `PORT`、なければ 8766。`--open` で起動後にブラウザを開く）。自分の PC からだけつながる
- `127.0.0.1`（IPv4）と `::1`（IPv6）の両方で待ち受ける。ブラウザは `localhost` を `::1` から試すので、IPv4 だけだと Windows では断られるまで約 2 秒待たされる。IPv6 が使えない PC では IPv4 だけで動く
- ポートが（IPv4・IPv6 のどちらかで）ほかのプログラムに使われているときは、メッセージを出して終わる。Windows では `SO_REUSEADDR` だと使用中のポートにも入れてしまうため、付けずに `SO_EXCLUSIVEADDRUSE` で確保する
- `start.bat`（Windows）: `PORT`（8766）が使われていないかを `netstat` で確かめてから `server.py %PORT% --open` を起動する。ファイルは UTF-8 で、先頭で `chcp 65001` にしている（Shift_JIS のコンソールでも文字化けしないように）
- ゲームのファイルを配る（キャッシュさせない）。`saves/` の中は配らない

| API | 動き |
|---|---|
| `GET /api/save` | `{"save": セーブ または null}` を返す |
| `PUT /api/save` | セーブを書き込み `{"ok": true, "stale": false}` を返す。すでにあるセーブのほうが新しい（`savedAt` が大きい）ときは書き換えず `stale: true`（通信の順番が入れ替わっても古いもので上書きしないため） |

- 書き込みは一時ファイルに書いてから置き換える。1 つ前のセーブを `saves/save.json.bak` に残す
- 受け付けるのは 512KB までの JSON で、`v`（整数）と `savedAt`（数）を持つものだけ
- `/api/save` が `{ save: ... }` の形で答えないとき（404 など）は、ゲームはサーバーなしとみなす

## 仕組み: 読み込みと開始

- タイトル画面は `initSave` が終わるまで「はじめから」を押せない。終わると `refreshTitle` が「続きから（Lv・ゾーン）」と保存先を出す
- `startGame(save)`: 主人公を作り直し、save があれば `applySave` で中身を戻して保存した場所から始める。「はじめから」はセーブがあると確認してから上書きする
- デバッグ用に `window.__game.saveStore` で保存先の状態（`server` / `error` / `cached`）を見られる
