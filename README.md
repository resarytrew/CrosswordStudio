
# Crossword Studio 🧩☕

*A premium crossword puzzle creation and solving experience*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)

</div>

---

## ✨ About

Crossword Studio is a beautiful, modern web application for creating, solving, and sharing crossword puzzles. Inspired by the cozy atmosphere of an intellectual cafe, it combines premium design with powerful functionality.

### Key Features

- 📝 **Crossword Editor** — Create custom crosswords with intuitive grid editing
- 🧩 **Interactive Solver** — Solve puzzles with smart clues and progress tracking  
- 🎨 **WordArt Export** — Export your puzzles as beautiful images in multiple styles
- 🔗 **Share & Publish** — Share puzzles via links or publish to the community
- 🔔 **Progress Saving** — Auto-save your progress to the cloud
- 🌐 **Bilingual** — Full support for Russian and English

---

## 🎨 Design Philosophy

### Cafe of Intellectuals Theme

We've reimagined Crossword Studio with a premium Scandinavian-inspired aesthetic:

| Element | Description |
|---------|-------------|
| **Color Palette** | Clean whites, warm creams, elegant dark navy accents |
| **Typography** | Inter for UI, Source Serif for titles |
| **Animations** | Subtle steam rises, ink fills, lamp glows |
| **Sound** | Carefully crafted audio feedback |

### Visual Styles

The app features distinct themes for each section:

- **Dashboard** — Welcome section with animated coffee steam
- **Solver** — Clean reading room with clear grid cells
- **Editor** — Intuitive workspace with real-time preview

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project (for data persistence)

### Installation

```bash
# Clone the repository
git clone https://github.com/resarytrew/CrosswordStudio.git
cd CrosswordStudio

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Firebase config

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS |
| **Animation** | Framer Motion |
| **Backend** | Firebase (Firestore + Auth) |
| **Routing** | React Router |
| **Icons** | Lucide React |

---

## 📱 Screenshots

### Dashboard — Cafe of Intellectors
The welcoming home screen with crossword collection

### Solver — Reading Room  
Clean puzzle solving interface with clues panel

### Editor — Creation Workspace
Intuitive crossword creation tools

### WordArt — Export Styles
Multiple beautiful export options:
- Classic — Traditional crossword look
- Neon — Glowing cyberpunk aesthetic
- Minimalist — Clean and modern
- Vintage — Warm antique feel
- Modern — Contemporary gradient

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is [MIT](LICENSE) licensed.

---

## 🙏 Acknowledgments

- Design inspired by premium Scandinavian aesthetics
- Built with love for crossword enthusiasts
- Thanks to all contributors and testers

---

<div align="center">

**Crafted with ☕ and 🧩**

*Crossword Studio — Where words meet wisdom*

</div>
