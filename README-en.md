<p align="center">
  <img src="https://img.shields.io/badge/Azure%20Speech-Talking%20Avatar-0f172a?logo=microsoftazure&style=for-the-badge" alt="Azure Speech" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
  <a href="https://github.com/Azure-Samples/cognitive-services-speech-sdk"><img src="https://img.shields.io/badge/Built%20upon-Azure--Samples%2Fcognitive--services--speech--sdk-9333ea?style=for-the-badge" alt="Upstream Azure Samples" /></a>
</p>

<h1 align="center">Photo Avatar Demo</h1>

<p align="center">
  This repository builds on top of the Talking Avatar samples in the Azure Cognitive Services Speech SDK. <br />
  Deploy `basic.html` and `chat.html` to any static hosting service (GitHub Pages, Azure Static Web Apps, etc.) and enjoy real-time avatars right from your browser.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#demos">Demos</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#project-structure">Project Structure</a> ·
  <a href="#license">License</a>
</p>

<p align="center">
  🌐 Looking for the Japanese documentation? Check out the <a href="./README.md">Japanese README</a>.
</p>

---

## Overview

- **Goal**: Showcase two browser-based demos: a minimal Talking Avatar experience and an extended voice-chat scenario that unifies Azure Speech, Azure OpenAI, and Azure Cognitive Search.
- **Tech Stack**: HTML, Tailwind CSS, Vanilla JavaScript, WebRTC, Azure Speech SDK.
- **Hosting**: Designed for static hosting on HTTPS-enabled services (GitHub Pages, Azure Static Web Apps, Netlify, etc.).

> ℹ️ This project derives from the official [Azure-Samples/cognitive-services-speech-sdk](https://github.com/Azure-Samples/cognitive-services-speech-sdk) repository. Feedback and improvements via Issues or PRs are welcome.

## 📦 Features

- ✅ Real-time Talking Avatar video streaming in the browser
- ✅ Log viewer with level-based filters and local-storage persistence
- ✅ Unified UI for Azure Speech, Azure OpenAI, and Azure Cognitive Search
- ✅ Options for private endpoints, custom voices, and photo avatars
- ✅ Pure static assets — friendly to GitHub Pages and similar hosts

## 🚀 Quick Start <a id="quick-start"></a>

```bash
# 1. Clone the repository
git clone https://github.com/<your-account>/Photo_Avatar_Demo.git
cd Photo_Avatar_Demo

# 2. Deploy to your static host (example: GitHub Pages)
git remote add origin https://github.com/<your-account>/Photo_Avatar_Demo.git
git push -u origin main

# 3. Visit the published pages
# https://<your-account>.github.io/Photo_Avatar_Demo/basic.html
# https://<your-account>.github.io/Photo_Avatar_Demo/chat.html
```

Running locally? Use an HTTPS-enabled dev server (for example, `npx serve --ssl`). WebRTC and microphone access require a secure context.

## 🧪 Demos <a id="demos"></a>

| Demo                       | URL (GitHub Pages example)                                      | Description                                                                                                 |
| :------------------------- | :-------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| [Basic Demo](./basic.html) | `https://<your-account>.github.io/Photo_Avatar_Demo/basic.html` | Minimal Talking Avatar sample with logging UI and configuration controls.                                   |
| [Chat Demo](./chat.html)   | `https://<your-account>.github.io/Photo_Avatar_Demo/chat.html`  | Integrates Azure Speech (STT/TTS), Azure OpenAI, and Azure Cognitive Search for a full voice-chat pipeline. |

## ⚙️ System Requirements

- Modern browsers served via HTTPS (latest Chromium-based browsers recommended)
- Azure Speech resource (region + key)
- Azure OpenAI and Azure Cognitive Search resources for the Chat Demo
- Microphone access if you want to speak with the avatar

## 📝 Configuration Checklist <a id="configuration"></a>

### Basic Demo (`basic.html`)

| Section                   | Field                        | Description                                                                                                                                              |
| :------------------------ | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Azure Speech Resource** | Region                       | Speech resource region                                                                                                                                   |
|                           | API Key                      | Speech resource key (Key1 / Key2)                                                                                                                        |
|                           | Enable Private Endpoint      | Enable when connecting via Private Link                                                                                                                  |
|                           | Private Endpoint             | Private endpoint URL (for example, `https://<name>.cognitiveservices.azure.com/`)                                                                        |
| **TTS Configuration**     | TTS Voice                    | Voice name (see the [supported voices list](https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts#supported-languages)) |
|                           | Custom Voice Deployment ID   | Deployment (endpoint) ID for custom voices (optional)                                                                                                    |
| **Avatar Configuration**  | Avatar Character / Style     | Avatar name (for example, `lisa`, `anika`) and style (for example, `casual-sitting`)                                                                     |
|                           | Background Color / Image     | RGBA color and optional background image URL                                                                                                             |
|                           | Photo Avatar / Custom Avatar | Enable photo avatars or custom avatars                                                                                                                   |
|                           | Use Built-In Voice           | Use the built-in voice that ships with a custom avatar                                                                                                   |
|                           | Transparent Background       | Enable green-screen removal                                                                                                                              |
|                           | Video Crop                   | Enable server-side video cropping                                                                                                                        |
|                           | Show Subtitles               | Display subtitles                                                                                                                                        |

### Chat Demo (`chat.html`)

| Section                             | Field                                             | Description                                                                               |
| :---------------------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| **Azure Speech Resource**           | Region / API Key / Private Endpoint               | Same as the Basic Demo                                                                    |
| **Azure OpenAI Resource**           | Endpoint                                          | For example, `https://<name>.openai.azure.com/`                                           |
|                                     | API Key                                           | Azure OpenAI API key                                                                      |
|                                     | Deployment Name                                   | Deployed model name                                                                       |
|                                     | System Prompt                                     | System message passed to the chat model                                                   |
|                                     | Enable On Your Data                               | Enable if you want to use your data                                                       |
| **Azure Cognitive Search Resource** | Endpoint                                          | For example, `https://<name>.search.windows.net/` (required when On Your Data is enabled) |
|                                     | API Key                                           | Azure Cognitive Search Admin key                                                          |
|                                     | Index Name                                        | Target index for retrieval                                                                |
| **STT / TTS Configuration**         | STT Locale(s)                                     | Language locales for speech recognition (multiple allowed)                                |
|                                     | TTS Voice                                         | Voice name used for speech synthesis                                                      |
|                                     | Custom Voice Deployment ID                        | Deployment ID for custom voices                                                           |
|                                     | Continuous Conversation                           | Keep the microphone listening continuously                                                |
| **Avatar Configuration**            | Avatar Character / Style                          | Avatar name and style                                                                     |
|                                     | Photo Avatar / Custom Avatar / Use Built-In Voice | Same options as the Basic Demo                                                            |
|                                     | Auto Reconnect                                    | Reconnect automatically on session loss                                                   |
|                                     | Use Local Video for Idle                          | Replace idle state with a local video clip                                                |

> 💡 Use `Stop Speaking`, `Clear Chat History`, and `Close Avatar Session` to control session flow as needed.

## 🧱 Project Structure <a id="project-structure"></a>

```
Photo_Avatar_Demo/
├── basic.html          # Talking Avatar basic demo
├── chat.html           # Multi-service voice chat demo
├── css/
│   └── styles.css      # Shared (Tailwind-inspired) styles
├── js/
│   ├── basic.js        # Logic for the basic demo
│   └── chat.js         # Logic for the chat demo
├── image/              # Static images (optional)
├── README.md           # Japanese README
├── README-en.md        # English README (this file)
└── LICENSE
```

## 💬 Contributing

Contributions are welcome! Feel free to open an issue or submit a PR for improvements, bug fixes, or documentation updates.

1. File an issue / open a PR (follow templates if provided)
2. Run appropriate tests or manual checks for your changes
3. Retain licensing and attribution information

## 🤝 Acknowledgements

- Built on top of [Azure-Samples/cognitive-services-speech-sdk](https://github.com/Azure-Samples/cognitive-services-speech-sdk)
- Inspired by the Microsoft Azure Speech documentation and SDK

## 📄 License <a id="license"></a>

Licensed under the [MIT License](./LICENSE).

```
Copyright (c) 2025 Takashi Okawa
```

See [LICENSE](./LICENSE) for details.
