# Glasskat

A minimal logic puzzle. Each level gives you a window and a few rules about which panes are allowed. Split the whole window into panes that follow every rule.

Open `index.html` in any browser. There's no build step, and the only outside file is the Inter font from Google Fonts.

## How to play

- **Rules** sit above the board, for example "Every pane is one of these shapes", "Every pane has 4 squares", "No two panes are the same shape", "Exactly 7 panes" or "Touching panes are different sizes". Rotated or mirrored shapes count as the same shape.
- A region that follows the pane rules turns to coloured glass. The small number in a region's corner is its size. A pane that clashes with another (same shape, or same size touching) is tinted red.
- **Boxes mode** (B): drag across squares to make a pane, or tap squares one at a time and press **Make pane** (Enter). Tap a coloured pane to undo it.
- **Lines mode** (L): drag along the grid lines to draw walls. Drag over walls to erase them, or tap a line to toggle it.
- **Z** undoes. **Clear** wipes the board. **New** gives a different board at the same level.
- Every board can be solved. It's built by laying down panes that already follow the rules. Some boards have more than one answer, and any answer that follows every rule wins.
- Your level and the puzzle you're in the middle of are saved in this browser, even without an account.

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

- **Users:** username, level reached, puzzles solved, fastest solve
- **Results:** one row per solved puzzle
- **Progress:** the puzzle each player is in the middle of

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
