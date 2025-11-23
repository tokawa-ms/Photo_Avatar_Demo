<p align="center">
  <img src="https://img.shields.io/badge/Azure%20Speech-Talking%20Avatar-0f172a?logo=microsoftazure&style=for-the-badge" alt="Azure Speech" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
  <a href="https://github.com/Azure-Samples/cognitive-services-speech-sdk"><img src="https://img.shields.io/badge/Built%20upon-Azure--Samples%2Fcognitive--services--speech--sdk-9333ea?style=for-the-badge" alt="Upstream Azure Samples" /></a>
</p>

<h1 align="center">Photo Avatar Demo</h1>

<p align="center">
  Azure Cognitive Services Speech SDK の Talking Avatar サンプルを発展させ、ブラウザだけでアバターの音声合成と対話を体験できるデモコレクションです。<br />
  `basic.html` と `chat.html` を GitHub Pages などに配置するだけで、ライブセッションをすぐに試せます。
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#demos">Demos</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#project-structure">Project Structure</a> ·
  <a href="#license">License</a>
</p>

---

## Overview

- **目的**: Azure Speech Talking Avatar の基本動作と、Azure OpenAI / Cognitive Search を組み合わせた音声対話体験を提供すること。
- **技術スタック**: HTML / Tailwind CSS / Vanilla JS、WebRTC、Azure Speech SDK。
- **公開方針**: 静的ホスティング (GitHub Pages、Azure Static Web Apps など) にデプロイする前提で設計されています。

> ℹ️ 本プロジェクトは [Azure-Samples/cognitive-services-speech-sdk](https://github.com/Azure-Samples/cognitive-services-speech-sdk) の Talking Avatar サンプルコードを応用して構築しています。改善点やフィードバックがあれば Issue / PR で歓迎します。

## 📦 Features

- ✅ Talking Avatar のリアルタイム動画ストリームをブラウザで再生
- ✅ コンソールログのレベル別フィルタリングとストレージ永続化
- ✅ Azure Speech / OpenAI / Cognitive Search の統合 UI
- ✅ プライベートエンドポイント、カスタムボイス、フォトアバターに対応
- ✅ GitHub Pages でホストしやすい純粋な静的コンテンツ構成

## 🚀 Quick Start <a id="quick-start"></a>

```bash
# 1. リポジトリを取得
git clone https://github.com/<your-account>/Photo_Avatar_Demo.git
cd Photo_Avatar_Demo

# 2. 任意の静的ホスティングへ配置 (例: GitHub Pages)
git remote add origin https://github.com/<your-account>/Photo_Avatar_Demo.git
git push -u origin main

# 3. GitHub Pages を有効化し、以下の URL でアクセス
# https://<your-account>.github.io/Photo_Avatar_Demo/basic.html
# https://<your-account>.github.io/Photo_Avatar_Demo/chat.html
```

ローカル検証が必要な場合は、HTTPS 対応の開発サーバー (例: `npx serve --ssl`) を利用してください。WebRTC・マイクアクセスの制約により、`http://` では機能しません。

## 🧪 Demos <a id="demos"></a>

| Demo                       | URL (GitHub Pages 例)                                           | 概要                                                                                                                                      |
| :------------------------- | :-------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| [Basic Demo](./basic.html) | `https://<your-account>.github.io/Photo_Avatar_Demo/basic.html` | Talking Avatar API のシンプルデモ。テキスト入力からアバターの音声・映像を生成し、ログビューで進行を確認できます。                         |
| [Chat Demo](./chat.html)   | `https://<your-account>.github.io/Photo_Avatar_Demo/chat.html`  | Azure Speech (STT/TTS)、Azure OpenAI、Azure Cognitive Search を組み合わせた音声対話デモ。オンデータ検索や音声合成をまとめて体験できます。 |

## ⚙️ System Requirements

- HTTPS で配信されるモダンブラウザ (Chromium 系最新バージョン推奨)
- Azure Speech リソース (キー / リージョン)
- Chat Demo 利用時は Azure OpenAI・Azure Cognitive Search の追加情報
- マイク / カメラ (必要に応じて) へのアクセス許可

## 📝 Configuration Checklist <a id="configuration"></a>

### Basic Demo (`basic.html`)

| セクション                | 項目                         | 説明                                                                                                                                |
| :------------------------ | :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Azure Speech Resource** | Region                       | 利用する Speech リソースのリージョン。                                                                                              |
|                           | API Key                      | Speech リソースのキー (Key1 / Key2)。                                                                                               |
|                           | Enable Private Endpoint      | プライベートリンク経由で接続する場合にチェック。                                                                                    |
|                           | Private Endpoint             | プライベートエンドポイント URL (例: `https://<name>.cognitiveservices.azure.com/`)                                                  |
| **TTS Configuration**     | TTS Voice                    | 利用する音声名 ([一覧](https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts#supported-languages)) |
|                           | Custom Voice Deployment ID   | カスタム音声のデプロイ ID。未利用なら空欄。                                                                                         |
| **Avatar Configuration**  | Avatar Character / Style     | アバターのキャラクターとスタイル (例: `lisa`, `casual-sitting`)                                                                     |
|                           | Background Color / Image     | 背景色 (RGBA) と任意の背景画像 URL                                                                                                  |
|                           | Photo Avatar / Custom Avatar | フォトアバター、カスタムアバター利用時にチェック                                                                                    |
|                           | Use Built-In Voice           | カスタムアバターと一緒に提供されるボイスを使用                                                                                      |
|                           | Transparent Background       | グリーンバックを透過表示へ変換                                                                                                      |
|                           | Video Crop                   | 受信動画のクロップを有効化                                                                                                          |
|                           | Show Subtitles               | 字幕表示を有効化                                                                                                                    |

### Chat Demo (`chat.html`)

| セクション                          | 項目                                              | 説明                                                               |
| :---------------------------------- | :------------------------------------------------ | :----------------------------------------------------------------- |
| **Azure Speech Resource**           | Region / API Key / Private Endpoint               | Basic Demo と同一設定。                                            |
| **Azure OpenAI Resource**           | Endpoint                                          | 例: `https://<name>.openai.azure.com/`                             |
|                                     | API Key                                           | Azure OpenAI のキー。                                              |
|                                     | Deployment Name                                   | デプロイ済みモデル名。                                             |
|                                     | System Prompt                                     | チャットモデルへのシステムメッセージ。                             |
|                                     | Enable On Your Data                               | 自分のデータを利用する場合にチェック。                             |
| **Azure Cognitive Search Resource** | Endpoint                                          | 例: `https://<name>.search.windows.net/` (On Your Data 利用時のみ) |
|                                     | API Key                                           | Cognitive Search の Admin キー。                                   |
|                                     | Index Name                                        | 参照する検索インデックス名。                                       |
| **STT / TTS Configuration**         | STT Locale(s)                                     | 音声認識で使用するロケール (複数指定可)。                          |
|                                     | TTS Voice                                         | 音声合成で利用する音声名。                                         |
|                                     | Custom Voice Deployment ID                        | カスタム音声のデプロイ ID。                                        |
|                                     | Continuous Conversation                           | 常時リスニングを有効化。                                           |
| **Avatar Configuration**            | Avatar Character / Style                          | アバターのキャラクターとスタイル。                                 |
|                                     | Photo Avatar / Custom Avatar / Use Built-In Voice | Basic Demo と同一オプション。                                      |
|                                     | Auto Reconnect                                    | 切断時に自動で再接続。                                             |
|                                     | Use Local Video for Idle                          | アイドル時にローカル動画を差し替え。                               |

> 💡 操作中は `Stop Speaking`、`Clear Chat History`、`Close Avatar Session` などのボタンでセッション制御が可能です。

## 🧱 Project Structure <a id="project-structure"></a>

```
Photo_Avatar_Demo/
├── basic.html          # Talking Avatar 基本デモ
├── chat.html           # 音声チャット複合デモ
├── css/
│   └── styles.css      # 共通スタイル (Tailwind + カスタム)
├── js/
│   ├── basic.js        # Basic Demo 用ロジック
│   └── chat.js         # Chat Demo 用ロジック
├── image/              # 画像アセット (任意)
├── README.md
└── LICENSE
```

## 💬 Contributing

Issue や Pull Request は大歓迎です。改善の提案、バグ報告、ドキュメント修正など、お気軽にご連絡ください。

1. Issue / PR を作成 (テンプレートがあれば順守)
2. 変更内容に対応するテストや手動確認を実施
3. ライセンスと著作権表記を保持

## 🤝 Acknowledgements

- [Azure-Samples/cognitive-services-speech-sdk](https://github.com/Azure-Samples/cognitive-services-speech-sdk) に感謝します。
- Microsoft Azure Speech チームの公開ドキュメントおよび SDK に基づいています。

## 📄 License <a id="license"></a>

本リポジトリは [MIT License](./LICENSE) の下で公開されています。

```
Copyright (c) 2025 Takashi Okawa
```

詳しくは [LICENSE](./LICENSE) を参照してください。
