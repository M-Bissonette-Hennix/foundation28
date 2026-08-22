FOUNDATION / 28 — v2.0.0
GitHub Pages package

UPLOAD
Upload the CONTENTS of this folder to the root of your GitHub Pages repository, preserving the folders:

index.html
styles.css
manifest.webmanifest
sw.js
.nojekyll
icons/
  apple-touch-icon.png
  icon-192.png
  icon-512.png
js/
  app.js
  audio.js
  charts.js
  data-store.js
  engine.js
  program-registry.js
  programs/
    foundation28.js

GitHub Pages:
Settings > Pages > Deploy from a branch > main > /(root)

IMPORTANT WHEN UPGRADING FROM v1
The old PWA may briefly serve its cached v1 shell after you replace the GitHub files. Open the live GitHub Pages URL in Safari and refresh/reopen it so Safari can install the new v2 service worker. Once v2 is visible, the Home Screen app uses the same URL and should update as well. If Safari stubbornly keeps the old build, remove the Home Screen shortcut, clear that site's website data in Safari settings, revisit the URL, and add it to the Home Screen again. Export a backup first if you have v2 data you care about.

DATA
- Primary database key: foundation28.v2
- v1 key foundation28.v1 is detected and migrated when v2 has no database yet.
- Export: Settings > Export JSON backup
- Restore: Settings > Import / restore JSON
- Data is local to the browser/device; GitHub does not receive training records.

ARCHITECTURE
- js/programs/foundation28.js = program definition and exercise metadata
- js/program-registry.js = installed program registry
- js/engine.js = program-neutral calculations / timing helpers / readiness / metrics
- js/data-store.js = user data schema, migration, backup and restore
- js/app.js = UI and workout-runner orchestration
- js/audio.js = tones and spoken cues
- js/charts.js = dependency-free SVG charts

FEATURES
1. Program pause / resume
2. Injury and movement-restriction system
3. Readiness score
4. Recovery-session mode
5. 3-2-1 countdowns
6. Enhanced tones + spoken cues
7. Session preview + estimated duration
8. Automatic session duration tracking
9. Exercise-specific performance history
10. Pain / issue logging
11. Weight trend graph + trailing 7-day average
12. JSON export/import restore
13. Pure-black AMOLED UI
14. Modular program / engine / data architecture
15. Session-RPE training-load graph

SAFETY BOUNDARY
This application is a training logger/timer, not a medical device. The readiness score and injury tags are user-defined training-management tools and do not diagnose injury or determine medical fitness to exercise.
