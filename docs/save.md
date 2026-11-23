# セーブとサーバー

自動セーブの中身、保存先（ブラウザとサーバー）、読み込み。コードは `src/save.js`、サーバーは `server.py`。
保存する項目を増やす・形を変えるときは、[save-versions.md](save-versions.md) の「形を変えるとき（版を足す）」の手順で版を 1 つ上げる。

## いつ保存するか（`params.js` の `save`）

- 30 秒ごと、門を通ったとき、レベルアップ、持ち物・店・クエストの画面を閉じたとき、クエストを受けた・報告したとき、倒れたとき、ページを閉じるとき
- サーバーへ問い合わせるときは 5 秒まで待つ（`serverTimeout`）。時間内に返事がない・つながらないとき（`unreachable`）は、ブラウザだけに保存しながら、次に保存するときにもう一度確かめ、つながったら今のセーブを送る（`retryServer`）。404 など「サーバーではない」返事のときは確かめ直さない

## 保存先

| 起動のしかた | 保存先 |
|---|---|
| `start.bat` または `python server.py`（おすすめ） | サーバーの `saves/save.json` と、ブラウザの `localStorage`（キー `zankai-turn-save`）の両方 |
| `python -m http.server` や `index.html` を直接開く | ブラウザの `localStorage` だけ |

- 起動時（`initSave`）に両方を読み、それぞれ今の形に直してから `savedAt` が新しいほうを使う（ブラウザが v1・サーバーが v2 のように版が違っても比べられる）。ブラウザにしかないセーブ（またはブラウザのほうが新しいセーブ）は、そのとき（今の形に直したものを）サーバーにも送る。サーバーに使えないセーブがあるときは送らない
- サーバーへの送信は 1 つずつ。送っている間に次のセーブが来たら、終わってから一番新しいものだけを送る。ページを閉じるときは待たずに送る（`keepalive`）
- サーバーに保存できなかったときはブラウザには保存し、一時停止画面にその旨を出す。保存先の説明はタイトルと一時停止画面に出る（`saveWhereText`）
- キーは、もとのリアルタイム版（斬界アリーナ、`zankai-arena-save`）とは別。同じブラウザで両方遊んでも混ざらない（ポートも 8766 と 8765 で別）

## セーブの形（v5）

```
{ v: 5, savedAt,
  player:   { level, exp, base, potential, train, hp, mp, gold, consumables, inventory, materials, equip, quests, knownSkills },
  progress: { kills, time },
  location: { zone, tx, ty },
  home }
```

- `base` は行動で伸びたステータス `{ maxHp, maxMp, str, vit, agi, int }`、`potential` は潜在、`train` は熟練度（どれも `{ ステータス: 数 }`。v5 から潜在・熟練度。[growth.md](growth.md)）。`inventory` / `equip` は装備（`{ id, slot, name, rarity, level, stats }`）そのもの、`materials` は素材の数 `{ 素材のid: 数 }`、`quests` は `{ クエストのid: { state, count } }`（id は `data/quests.js`。v2 から衛兵隊長のクエストは `c_wolf` など）、`consumables` は道具の数 `{ 道具のキー: 数 }`（`data/items.js` の `consumables`。v4 から。v3 までは `potions`）、`knownSkills` は覚えているスキルの id の並び（`data/skills.js`。v3 から）
- `progress.time` はゲーム内の時刻（ターン）。`location` の `tx`, `ty` はマス
- ステータスそのもの（こうげき力など）は保存せず、読み込むときに「`base` + 装備」から計算し直す（`computeStats`）。式や装備の数値を変えても、続きから遊ぶと新しい数値が反映される
- `mp` は今の MP。ない（MP を入れる前の）セーブは満タンから始まる。`base.maxMp` がないセーブは Lv1 の値になる（下の決まり）
- `base` がない・数でない値は Lv1 の値にし、Lv1 の値〜上限（`growth.stats` の `max`）に収める。`potential` がない・数でない値ははじめの潜在にし、下限〜上限に収める。`train` は 0 以上 `cost` 未満でなければ捨てる（0 から）
- `home` は倒れたときに戻る町のゾーン（[world.md](world.md)）。ない・町でないときは `WORLD.respawnZone`
- 倒れている間に保存するときは、`home` の町のかがり火にいるものとして保存する（`hp: null`・`mp: null` で満タンから始まる）
- 読み込むとき、存在しないクエスト・部位・ステータスの装備・素材・道具は捨てる（`STATS` にないステータスを持つ装備も捨てる）。道具の数は 0〜持てる数（`max`）に収める
- 覚えたスキル（`knownSkills`）: 読むとき、今はないスキルの id・重なり・id でないものは捨て（`teachSkill` を通す）、そのあとはじめの覚え方（`learnSkillsByLevel`）でそのレベルなら覚えているはずのものを足す（古い・おかしなセーブでも、そのレベルで覚えるスキルがなくならない）
- スキル欄（どのキーにどのスキル）は保存しない（付け替える画面がなく、いつも `data/player.js` の `skillSlots` のため。[skill-use.md](skill-use.md)）。再使用待ち・強化も保存しない（続きから遊ぶとどのスキルもすぐ使える）
- 上の「ない・おかしい値の読み方」（`base` / `mp` / `home` がないなど）は v1 より前のセーブのためのもので、`applySave` に置いてある（回復薬の数が数だけのものは v3 → v4 の直し方で直す）。これからの形の変更は版の移し替え（[save-versions.md](save-versions.md)）で行う

## 版の移し替えと使えないセーブ

読むときに古い形のセーブを今の形に直すしくみ（`SAVE_MIGRATIONS`）、形を変えるときの手順、新しい版・壊れたセーブの扱いは [save-versions.md](save-versions.md)。

## サーバー（`server.py`）

- Python の標準ライブラリだけで動く。`python server.py [ポート] [--open]`（ポートの省略時は環境変数 `PORT`、なければ 8766。`--open` で起動後にブラウザを開く）。自分の PC からだけつながる
- `127.0.0.1`（IPv4）と `::1`（IPv6）の両方で待ち受ける。ブラウザは `localhost` を `::1` から試すので、IPv4 だけだと Windows では断られるまで約 2 秒待たされる。IPv6 が使えない PC では IPv4 だけで動く
- ポートが（IPv4・IPv6 のどちらかで）ほかのプログラムに使われているときは、メッセージを出して終わる。Windows では `SO_REUSEADDR` だと使用中のポートにも入れてしまうため、付けずに `SO_EXCLUSIVEADDRUSE` で確保する
- `start.bat`（Windows）: `PORT`（8766）が使われていないかを `netstat` で確かめてから `server.py %PORT% --open` を起動する。ファイルは UTF-8 で、先頭で `chcp 65001` にしている（Shift_JIS のコンソールでも文字化けしないように）
- ゲームのファイルを配る（キャッシュさせない）。`saves/` の中は配らない。`.css` / `.js` の Content-Type は `Handler.extensions_map` で決めてある（`text/css; charset=utf-8` / `text/javascript; charset=utf-8`。Windows のレジストリの設定で `text/plain` になって読まれないことがないように）。ほかは標準の `mimetypes`

| API | 動き |
|---|---|
| `GET /api/save` | `{"save": セーブ または null}` を返す。ファイルはあるが JSON として読めないときは `{"save": null, "unreadable": true}`（ゲームは「壊れたセーブ」として扱う） |
| `PUT /api/save` | セーブを書き込み `{"ok": true, "stale": false}` を返す。すでにあるセーブのほうが新しい（`savedAt` が大きい）ときは書き換えず `stale: true`（通信の順番が入れ替わっても古いもので上書きしないため） |

- 書き込みは一時ファイルに書いてから置き換える。1 つ前のセーブを `saves/save.json.bak` に残す（次の保存で上書きされる）
- 置き換えるセーブの形（`v`）が受け取ったものと違うとき・読めないときは、`saves/save.json.v<形>.bak`（例 `save.json.v1.bak`）/ `saves/save.json.unreadable.bak` にも写す。形が変わったときだけなので、次の保存では上書きされない（新しい版のセーブを古い版のゲームで「はじめから」にしたときや、版が上がったときの控え）。サーバーはセーブの中身を直さない（直すのはゲームの `readSave`）
- 受け付けるのは 512KB までの JSON で、`v`（整数）と `savedAt`（数）を持つものだけ
- `/api/save` が `{ save: ... }` の形で答えないとき（404 など）は、ゲームはサーバーなしとみなす

## 仕組み: 読み込みと開始

- タイトル画面は `initSave` が終わるまで「はじめから」を押せない。終わると `refreshTitle` が「続きから（Lv・ゾーン）」と、使えないセーブの説明（`saveProblemText`）と保存先を出す
- `startGame(save)`: 主人公を作り直し、save があれば `applySave` で中身を戻して保存した場所から始める。HP は数（`Number.isFinite`）で 0 より大きければその値（最大まで。端数もそのまま）、それ以外（0 以下・`null`・文字列など）は満タン（生きている主人公を HP 0 で戻すことはない。倒れている間のセーブは `hp: null`）。MP は数なら 0〜最大に収めた値（0 もそのまま）、数でなければ満タン。「はじめから」はセーブ（使えないものも）があると確認してから上書きする
- デバッグ用に `window.__game.saveStore` で保存先の状態（`server` / `error` / `cached` / `problems`（使えないセーブ））を見られる
