# 機能マップ（どこを直すか）

コードのフォルダ構成ではなく、**アプリの機能・操作**から「触るファイル」を探すための索引です。  
ファイル名をクリックすると開けます（Cursor / GitHub）。

**共通部品**（写真・カメラ・黒塗り・ヘッダーなど）は後半の「共通」にまとめています。画面ごとの節では「ここに出る」とだけ書いてあります。

---

## 目次

1. [ログイン／ログアウト](#1-ログインログアウト)
2. [お薬表作成（ホーム）](#2-お薬表作成ホーム)
3. [前回比較](#3-前回比較)
4. [結果表示・印刷（お薬表／比較共通）](#4-結果表示印刷お薬表比較共通)
5. [共通：ヘッダー・全体レイアウト](#5-共通ヘッダー全体レイアウト)
6. [共通：写真を追加する（ライブラリ／カメラ選択）](#6-共通写真を追加するライブラリカメラ選択)
7. [共通：カメラで撮る](#7-共通カメラで撮る)
8. [共通：プレビュー／黒塗り](#8-共通プレビュー黒塗り)
9. [共通：画像の圧縮・フォームへの載せ方](#9-共通画像の圧縮フォームへの載せ方)
10. [共通：読み込み中表示](#10-共通読み込み中表示)
11. [共通：Gemini で薬名を抽出する](#11-共通gemini-で薬名を抽出する)
12. [共通：QR を生成する（印刷用）](#12-共通qr-を生成する印刷用)
13. [共通：QR を読み取る](#13-共通qr-を読み取る)
14. [共通：前回と今回の差分](#14-共通前回と今回の差分)
15. [共通：歯科注意の出し分け](#15-共通歯科注意の出し分け)
16. [環境変数・デプロイ](#16-環境変数デプロイ)

---

## 1. ログイン／ログアウト

サイト全体を共有パスワードで守る。

| 役割 | ファイル |
|------|----------|
| ログイン画面 | [`src/app/login/page.tsx`](src/app/login/page.tsx) |
| ログイン API（パスワード照合・Cookie 発行） | [`src/app/api/login/route.ts`](src/app/api/login/route.ts) |
| ログアウト API | [`src/app/api/logout/route.ts`](src/app/api/logout/route.ts) |
| 門番（未ログインなら `/login` へ） | [`src/middleware.ts`](src/middleware.ts) |
| トークン作成・検証 | [`src/lib/siteAuth.ts`](src/lib/siteAuth.ts) |
| ヘッダーのログアウトボタン | [`src/components/LogoutButton.tsx`](src/components/LogoutButton.tsx) |

**よくある変更**
- ログイン維持日数 → `siteAuth.ts`（Cookie の寿命）
- 「パスワードが違う」などの文言 → `login/page.tsx` / `api/login`
- 保護しないパスを増やす → `middleware.ts`

---

## 2. お薬表作成（ホーム）

患者番号入力 → 写真追加 → 解析 → 結果・印刷。

| 役割 | ファイル |
|------|----------|
| ルート定義（動的描画など） | [`src/app/page.tsx`](src/app/page.tsx) |
| 画面の本体（状態・送信・結果UI） | [`src/app/HomeClient.tsx`](src/app/HomeClient.tsx) |
| 解析 API の入口 | [`src/app/api/analyze/route.ts`](src/app/api/analyze/route.ts) |

**この画面で使う共通部品**
- 写真追加・カメラ・黒塗り → [§6〜8](#6-共通写真を追加するライブラリカメラ選択)
- 圧縮・送信データの組み立て → [§9](#9-共通画像の圧縮フォームへの載せ方)
- 読み込み中 → [§10](#10-共通読み込み中表示)
- Gemini 抽出 → [§11](#11-共通gemini-で薬名を抽出する)
- 結果の QR・印刷まわり → [§4](#4-結果表示印刷お薬表比較共通) / [§12](#12-共通qr-を生成する印刷用)

**よくある変更**
- ホームのボタン文言・患者番号欄 → `HomeClient.tsx`
- 「解析する」押下後の流れ → `HomeClient.tsx` + `api/analyze/route.ts`

---

## 3. 前回比較

前回（写真 or QR）と今回写真を比べる。

| 役割 | ファイル |
|------|----------|
| ルート定義 | [`src/app/compare/page.tsx`](src/app/compare/page.tsx) |
| 画面の本体 | [`src/app/compare/CompareClient.tsx`](src/app/compare/CompareClient.tsx) |
| 比較 API の入口 | [`src/app/api/compare/route.ts`](src/app/api/compare/route.ts) |

**この画面で使う共通部品**
- 写真追加・カメラ・黒塗り → [§6〜8](#6-共通写真を追加するライブラリカメラ選択)
- QR 読み取り → [§13](#13-共通qr-を読み取る)
- 差分ロジック → [§14](#14-共通前回と今回の差分)
- 抽出自体はお薬表と同じ → [§11](#11-共通gemini-で薬名を抽出する)

**よくある変更**
- 「前回は QR or 写真」の案内文 → `CompareClient.tsx`
- 比較結果の並べ方 → `CompareClient.tsx` + `diffMedications.ts`

---

## 4. 結果表示・印刷（お薬表／比較共通）

画面上の結果表と、A4 印刷レイアウト。

| 役割 | ファイル |
|------|----------|
| お薬表の結果・印刷 HTML | [`src/app/HomeClient.tsx`](src/app/HomeClient.tsx) |
| 比較の結果・印刷 HTML | [`src/app/compare/CompareClient.tsx`](src/app/compare/CompareClient.tsx) |
| 印刷用 CSS（余白・表など） | [`src/app/globals.css`](src/app/globals.css) |
| 日付表示 | [`src/lib/formatDate.ts`](src/lib/formatDate.ts) |
| 印刷用紙上の QR | → [§12](#12-共通qr-を生成する印刷用) |

**よくある変更**
- 印刷の余白・表の見た目 → `globals.css` の `@media print`
- 結果テーブルの列 → 各 `*Client.tsx`

---

## 5. 共通：ヘッダー・全体レイアウト

| 役割 | ファイル |
|------|----------|
| HTML の土台・フォント | [`src/app/layout.tsx`](src/app/layout.tsx) |
| グローバル CSS | [`src/app/globals.css`](src/app/globals.css) |
| 画面上部ナビ（お薬表／比較の切替） | [`src/components/AppHeader.tsx`](src/components/AppHeader.tsx) |

**よくある変更**
- アプリ名やタブのラベル → `AppHeader.tsx`
- 全体の色・フォント感 → `globals.css` / `layout.tsx`

---

## 6. 共通：写真を追加する（ライブラリ／カメラ選択）

「写真を追加する」→「カメラで撮る／ライブラリから選ぶ」。  
お薬表作成・比較の両方で同じ部品を使う。

| 役割 | ファイル |
|------|----------|
| 入口UI・選択肢・ライブラリ選択・黒塗りへの受け渡し | [`src/components/PhotoSection.tsx`](src/components/PhotoSection.tsx) |

**よくある変更**
- 選択肢の文言・ボタン色 → `PhotoSection.tsx`
- サムネイル一覧・削除ボタン → `PhotoSection.tsx`

---

## 7. 共通：カメラで撮る

アプリ内カメラ（システムカメラではなく、撮影後に黒塗りへ確実に進むため）。

| 役割 | ファイル |
|------|----------|
| カメラ画面・シャッター | [`src/components/PhotoCameraModal.tsx`](src/components/PhotoCameraModal.tsx) |
| 呼び出し元 | [`src/components/PhotoSection.tsx`](src/components/PhotoSection.tsx) |

**よくある変更**
- カメラ許可エラーの文言 → `PhotoCameraModal.tsx`
- 撮影解像度の目安 → `PhotoCameraModal.tsx`（canvas への書き出し）

---

## 8. 共通：プレビュー／黒塗り

撮影・選択後の確認画面。ドラッグで黒矩形、1つ戻す／全て消す、OK。

| 役割 | ファイル |
|------|----------|
| 黒塗り UI | [`src/components/PhotoRedactModal.tsx`](src/components/PhotoRedactModal.tsx) |
| キュー管理・OK 後にフォームへ渡す | [`src/components/PhotoSection.tsx`](src/components/PhotoSection.tsx) |

**よくある変更**
- 黒塗りの操作感・ボタン → `PhotoRedactModal.tsx`
- 「何枚目／何枚中」の表示 → `PhotoRedactModal.tsx`（`PhotoSection` から番号を渡している）

---

## 9. 共通：画像の圧縮・フォームへの載せ方

ブラウザで圧縮し、API に送る形にまとめる。

| 役割 | ファイル |
|------|----------|
| 撮影画像の型・File→プレビュー用データ | [`src/lib/capturedImage.ts`](src/lib/capturedImage.ts) |
| JPEG 圧縮（Canvas） | [`src/lib/compressImage.ts`](src/lib/compressImage.ts) |
| multipart フォームの組み立て | [`src/lib/buildImageFormData.ts`](src/lib/buildImageFormData.ts) |
| サーバー側で受信した画像の取り出し | [`src/lib/parseUploadedImages.ts`](src/lib/parseUploadedImages.ts) |

**よくある変更**
- 1枚時だけ高解像度、など圧縮条件 → `capturedImage.ts` / `compressImage.ts`
- API に渡すフィールド名 → `buildImageFormData.ts` と `parseUploadedImages.ts` をセットで

---

## 10. 共通：読み込み中表示

「準備中 → 送信中 → 解析中」などの段階表示。

| 役割 | ファイル |
|------|----------|
| ローディング UI | [`src/components/LoadingPanel.tsx`](src/components/LoadingPanel.tsx) |
| 段階の切り替え | `HomeClient.tsx` / `CompareClient.tsx` |

---

## 11. 共通：Gemini で薬名を抽出する

写真 → 薬品リスト（お薬表も比較の「写真から読む」もここ）。

| 役割 | ファイル |
|------|----------|
| お薬表用 API | [`src/app/api/analyze/route.ts`](src/app/api/analyze/route.ts) |
| 比較用 API（中で抽出を呼ぶ） | [`src/app/api/compare/route.ts`](src/app/api/compare/route.ts) |
| Gemini 呼び出し・プロンプト | [`src/lib/medicationAi.ts`](src/lib/medicationAi.ts) |
| モデル名・レスポンス形式 | [`src/lib/geminiConfig.ts`](src/lib/geminiConfig.ts) |
| AI の JSON を薬リストに変換 | [`src/lib/parseMedications.ts`](src/lib/parseMedications.ts) |
| 型定義 | [`src/lib/types.ts`](src/lib/types.ts) |

**よくある変更**
- 「落としすぎる／付けすぎる」→ `medicationAi.ts` のプロンプト
- 使うモデル → `geminiConfig.ts`
- 返す JSON の形 → `geminiConfig.ts` + `parseMedications.ts` + `types.ts`

---

## 12. 共通：QR を生成する（印刷用）

結果の薬一覧を QR に載せて印刷紙に出す（サーバー保存なし）。

| 役割 | ファイル |
|------|----------|
| QR 画像の表示（画面・印刷） | [`src/components/MedicationQrPanel.tsx`](src/components/MedicationQrPanel.tsx) |
| QR に入れるデータの encode／decode | [`src/lib/medicationQr.ts`](src/lib/medicationQr.ts) |
| 呼び出し元 | `HomeClient.tsx` / `CompareClient.tsx` |

**よくある変更**
- QR に載せる項目 → `medicationQr.ts`
- QR の大きさ・「作成不可」の条件 → `MedicationQrPanel.tsx`

---

## 13. 共通：QR を読み取る

比較画面の「前回の QR を読み取る」。

| 役割 | ファイル |
|------|----------|
| ライブカメラ読み取り UI | [`src/components/QrScannerModal.tsx`](src/components/QrScannerModal.tsx) |
| 画像／フレームから QR 文字列を復元 | [`src/lib/decodeMedicationQr.ts`](src/lib/decodeMedicationQr.ts) |
| ペイロードの意味づけ | [`src/lib/medicationQr.ts`](src/lib/medicationQr.ts) |
| 呼び出し・結果の反映 | [`src/app/compare/CompareClient.tsx`](src/app/compare/CompareClient.tsx) |

**よくある変更**
- 枠・成功表示・案内文 → `QrScannerModal.tsx`
- 「対応していない QR」の判定 → `medicationQr.ts` / `decodeMedicationQr.ts`

---

## 14. 共通：前回と今回の差分

抽出後のリストを「増えた／減った／継続」に分ける（サーバー側の計算）。

| 役割 | ファイル |
|------|----------|
| 差分ロジック | [`src/lib/diffMedications.ts`](src/lib/diffMedications.ts) |
| 呼び出し | [`src/app/api/compare/route.ts`](src/app/api/compare/route.ts) |
| 画面への表示 | [`src/app/compare/CompareClient.tsx`](src/app/compare/CompareClient.tsx) |

---

## 15. 共通：歯科注意の出し分け

院内リストに合う薬だけ注意文を厚めに出す。

| 役割 | ファイル |
|------|----------|
| リスト本体（データ） | [`src/data/dentalCautionDrugs.json`](src/data/dentalCautionDrugs.json) |
| リストをプロンプト用に整形 | [`src/lib/dentalCautionList.ts`](src/lib/dentalCautionList.ts) |
| 抽出時にリストを渡す | [`src/lib/medicationAi.ts`](src/lib/medicationAi.ts) |

**よくある変更**
- 注意薬を増やす → まず `dentalCautionDrugs.json`

---

## 16. 環境変数・デプロイ

| 役割 | ファイル／場所 |
|------|----------------|
| ローカル環境変数 | [`.env.local`](.env.local)（Git 管理外） |
| 変数の例 | [`.env.local.example`](.env.local.example) |
| Vercel リージョンなど | [`vercel.json`](vercel.json) |
| 説明・デモ URL | [`README.md`](README.md) |

| 変数 | 用途 |
|------|------|
| `GEMINI_API_KEY` | Gemini 呼び出し |
| `SITE_PASSWORD` | 共有パスワード（空なら保護オフ） |
| `AUTH_SECRET` | Cookie 署名用（任意） |

---

## 迷ったときの早見

| やりたいこと | まず開くファイル |
|--------------|------------------|
| ログイン周り | `siteAuth.ts` / `middleware.ts` |
| ホーム画面の見た目・流れ | `HomeClient.tsx` |
| 比較画面の見た目・流れ | `CompareClient.tsx` |
| カメラ／黒塗り | `PhotoCameraModal.tsx` / `PhotoRedactModal.tsx` / `PhotoSection.tsx` |
| AI の出方 | `medicationAi.ts` |
| QR | `medicationQr.ts` + `MedicationQrPanel.tsx` or `QrScannerModal.tsx` |
| 歯科注意リスト | `dentalCautionDrugs.json` |
| 印刷レイアウト | `globals.css` |

---

## メモ（このファイルの使い方）

- 機能を足したら、**操作名の見出し**を増やす（フォルダ名で増やさない）
- 共通化した部品は「共通」にだけ詳しく書き、画面側はリンク参照にする
- ファイルをリネーム・分割したら、このマップも同じ PR／コミットで直すと迷子になりにくい
