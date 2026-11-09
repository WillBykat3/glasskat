# Glasskat

A minimal logic puzzle. Each level gives you a window and a few rules about which panes are allowed. Split the whole window into panes that follow every rule.

Open `index.html` in any browser. There's no build step. The page loads `core.js` (the rules and the solver) and `levels.js` (the levels), and the only outside file is the Inter font from Google Fonts.

## How to play

- There are **100 levels in 10 chapters**. Every level has a fixed map, the same for everyone, and **exactly one answer**, like a sudoku.
- A region that follows the rules turns to coloured glass. The small number in a region's corner is its size.
- **Boxes mode** (B): drag across squares to make a pane, or tap squares one at a time and press **Make pane** (Enter). Tap a coloured pane to undo it.
- **Lines mode** (L): drag along the grid lines to draw lines, drag over a line to erase it, or tap a line to toggle it.
- **Heavy lines** that come with a level are part of the puzzle and can't be removed.
- A line has to separate two panes. A line that ends inside a pane shows dashed, and that pane doesn't count until the line is removed or finished.
- **Hint** (H) fills in one pane of the answer. **Z** undoes. **Clear** removes your lines.
- The grid button (or the level title) opens **all levels**. A level unlocks when you solve the one before it. Your best time shows on each level, and unfinished work on every level is kept.

### Rules you'll meet

| Rule | Meaning |
| --- | --- |
| Every pane is one of these shapes | Only the pictured shapes. Rotated or mirrored counts as the same shape. |
| Every pane has N squares / 2–5 squares | Pane sizes. |
| A number shows the size of its pane | A numbered square is in a pane with that many squares. |
| Every pane has exactly one dot | Each pane holds one dot, never two. |
| Every pane is a rectangle / No pane is a rectangle | Squares and straight bars count as rectangles. |
| Every pane is symmetrical | The pane matches its mirror image (across a vertical, horizontal or diagonal line). |
| No pane contains a 2×2 block | No four squares of one pane form a square. |
| Every pane touches the frame | Each pane reaches the outer edge, or a hole. |
| No two panes are the same shape / Every pane is the same shape | Compared with rotations and mirror images counted as the same. |
| Touching panes are different sizes / shapes | Panes that share a side can't match. |
| Exactly K panes | The number of panes. |

## Making levels

`levels.js` is generated. To rebuild it, or to change the plan in `tools/make-levels.js`:

```bash
node tools/make-levels.js
```

For each level the builder grows a window out of panes that already follow the rules, which becomes the answer. It then uses the solver in `core.js` to look for a second answer. While one exists, it adds a clue that the second answer breaks: a fixed line, a number, or an "Exactly K panes" rule. Then it removes every clue that isn't needed, and checks once more, with a much larger search budget, that only one answer is left. Each level has its own random seed, so the same plan always gives the same levels. Rebuilding changes the maps, so do it before people have progress you care about.

## Turning on accounts (about 5 minutes)

Accounts work like chartkat's: type a username, no email or password, and everything is saved to a Google Sheet you own. They stay hidden until `API_URL` in `index.html` is set.

### 1. Make the Google Sheet

1. Go to [sheets.new](https://sheets.new) and name the sheet something like "Glasskat".
2. Open **Extensions → Apps Script**.
3. Delete what's in `Code.gs`, paste in everything from [`google-sheet/Code.gs`](google-sheet/Code.gs), and click **Save**.
4. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **Deploy**, then **Authorize access** and pick your Google account. Google warns that it "hasn't verified this app", because it's your own script. Click **Advanced → Go to (your project name)**, then **Allow**.
6. Copy the **Web app URL**. It ends in `/exec`.

This has to be a new sheet and script. Chartkat's web app URL won't work here, because it runs chartkat's script.

The sheet makes three tabs the first time someone signs in:

- **Users:** username, highest level unlocked, puzzles solved, fastest solve
- **Results:** one row per solved puzzle
- **Progress:** the level each player is in the middle of, with their lines on it

### 2. Put the URL in the site

In `index.html`, find this line and paste your URL between the quotes:

```js
const API_URL = "";
```

### 3. Host it on GitHub Pages

Accounts only work from a normal web host such as GitHub Pages, not from a file opened on your computer.

1. In this repo on GitHub: **Settings → Pages**.
2. **Source:** Deploy from a branch. **Branch:** the branch with `index.html`, folder `/ (root)`. Click **Save**.
3. After a minute or two the site is at `https://willbykat3.github.io/glasskat/`.

### If you change `Code.gs` later

Paste the new `Code.gs` over the old one in the Apps Script editor and click **Save** first.

Saving the script isn't enough. Go to **Deploy → Manage deployments**, click the pencil, set **Version** to **New version**, and click **Deploy**. The URL stays the same.

## What accounts can and can't do

- A username is 2–24 letters or numbers (spaces, dots, dashes and underscores are fine after the first character). Capitals don't matter: "Jordan K" and "jordan k" are the same account.
- **There's no password.** Anyone who types a username can use that account.
- The web app URL is visible in the page source, so someone determined could add fake solves or levels. The leaderboard is for fun, not proof. If junk shows up, delete those rows, or make a new deployment and put the new URL in the site.
- The puzzle you're in the middle of saves about 2 seconds after each move. Sign in on another device and it picks up where you left off.
- The account menu shows your level, puzzles solved, fastest solve, your recent solves and the top 10 players by level.
