# ABA Schedule Timer V1

A dependency-free static web app for repeating fixed-time (FT) and
Fleshler–Hoffman-style variable-time (VT) schedules. Session data stays in the
open page and is cleared on reset or refresh.

## Run locally

Open `index.html` directly, or serve this folder with any local static web
server. To verify the schedule calculations, run:

```text
node tests/timer.test.js
```

## Publish with GitHub Pages

1. Create a GitHub repository and upload the **contents of this folder** so
   `index.html`, `styles.css`, and `app.js` are at the repository root.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then click **Save**.
5. GitHub will show the public URL after the first deployment finishes.

No build step, package installation, or API key is required.

## Timing note

GitHub Pages can host the app, but hosting does not make browser background
timing reliable. Mobile operating systems may delay or suspend timers when the
screen locks or the browser is backgrounded. Keep the page visible and the
screen awake when timing matters.

## Variable schedule method

VT mode creates 12 Fleshler–Hoffman values, scales them to the selected target
mean, and shuffles them without replacement. Each complete block of 12 has the
selected arithmetic mean before display rounding.

Reference: Fleshler, M., & Hoffman, H. S. (1962). *A progression for generating
variable-interval schedules.* Journal of the Experimental Analysis of Behavior,
5(4), 529–530. <https://doi.org/10.1901/jeab.1962.5-529>
