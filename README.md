# ♔ Checkers / Draughts Master

A fully-featured, browser-based Checkers (Draughts) game built with vanilla HTML, CSS, and JavaScript. Play locally with a friend, customize piece colors, toggle game modes, and track every move with chess-style notation.

### https://checkers00.vercel.app/

## ✨ Features

### 🎮 Dual Gameplay Modes

- **⚡ Feed-First Mode (Mandatory Capture)** – If a capture is available anywhere on the board, you **must** take it. Multi-jump sequences are enforced continuously.
- **🧠 Strategic Mode (Optional Capture)** – Choose regular moves even when captures exist. However, once you start a capture sequence with a piece, the multi-jump rule becomes mandatory.

### 🎨 Customizable Themes

Select from 3 piece color pairs:
- 🔴 Red & ⚪ White (default)
- ⚫ Black & ⚪ White
- 🤎 Brown & ⚪ White

### 🏷️ Chess-Style Board Notation

Every square is labeled with algebraic notation (a1–h8), just like in chess. This makes it easy to:
- Communicate moves precisely
- Record and analyze games
- Follow standard checkers strategy guides

### 📊 Player Stats & Move History

- **Player Cards** – View current turn status, active player indicators, and captured pieces graveyard
- **Move History Table** – Full game log with move numbers and P1/P2 columns in standard notation
- **Real-time Status Banner** – Clear visual feedback showing whose turn it is

### 🔊 Quality of Life Features

- **Sound Toggle** – Enable/disable game sound effects
- **Coordinate Toggle** – Show/hide board labels for cleaner gameplay
- **Undo Move** – Take back your last move (when available)
- **Responsive Design** – Play on desktop, tablet, or mobile

## 🚀 Quick Start

### Play in Browser

1. Clone or download this repository
2. Open `index.html` in any modern web browser
3. Start playing!

```bash
# Or serve locally with a simple HTTP server
python -m http.server 8000
# Visit http://localhost:8000
```

### No Installation Required

This is a static web app – no dependencies, no build tools. Just open and play.

## 📁 Project Structure
├── index.html   # Page structure, board layout, controls, and rules modal
├── style.css    # Styling, themes, layout, and responsive design
└── script.js    # Game logic, move validation, capture rules, and UI interactions


## 🎯 How to Play

### Basic Rules

1. **Setup** – Each player starts with 12 pieces on dark squares across the first 3 rows
2. **Movement** – Pieces move diagonally forward one square
3. **Capturing** – Jump over opponent pieces diagonally to remove them
4. **King Promotion** – Reach the opposite end to become a King (♔) with backward movement
5. **Winning** – Capture all opponent pieces or block them from moving

### Game Controls

| Control | Action |
|---------|--------|
| Click piece | Select piece |
| Click highlighted square | Move selected piece |
| **New Game** button | Reset the board |
| **Undo Move** button | Revert last move |
| **🔊 Sound** | Toggle audio on/off |
| **🏷️ Coordinates** | Toggle board labels |
| **📖 Rules** | Open rules modal |

## 🛠️ Technical Details

### Core Mechanics (from `script.js`)

- **Move Validation** – Checks legal moves based on piece type and game mode
- **Multi-Jump Detection** – Tracks forced continuation after captures
- **Board State Management** – 8x8 grid with piece positions and move history
- **King Logic** – Promotes pieces and enables backward movement
- **Capture Enforcement** – Feed-First mode scans entire board for mandatory captures

### Styling (from `style.css`)

- **CSS Variables** – Theme colors, spacing, and typography tokens
- **Flexbox & Grid** – Responsive layout for panels and board
- **Google Fonts** – Modern typography (Outfit, Space Grotesk)
- **Dark/Light Adaptation** – Theme-aware color schemes

### Accessibility

- Semantic HTML5 structure
- Keyboard navigation support
- Clear visual feedback for selections and turns
- Scalable UI with viewport meta tag

## 🎨 Customization

### Change Default Theme

Edit the `data-theme` attribute in `index.html`:

```html
<body data-theme="red-white"> <!-- or "black-white" / "brown-white" -->
```

### Modify Game Mode

Change the default selected option in the mode dropdown:

```html
<option value="strategic" selected>🧠 Strategic</option>
```

## 📱 Browser Support

- ✅ Chrome / Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📄 License

This project is open source. Feel free to use, modify, and share!

## 🙏 Acknowledgments

- Font: [Outfit](https://fonts.google.com/specimen/Outfit) and [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) from Google Fonts
- Inspired by classic Checkers/Draughts rules and international variants

---

**Built with ❤️ using vanilla HTML, CSS, and JavaScript**
