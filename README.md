# Super 6s league website (reusable for any county FA)

One codebase. Each county gets its own copy with its own settings, pictures, domain, logins and data.

## Folder guide
| Folder | What it is | Edit per county? |
|---|---|---|
| `county/config.json` | All county settings: names, partner, colours, leagues, Full-Time codes, contact, form, shirts | **Yes** |
| `county/assets/` | `logo.png` (square, 450px+), `hero.jpg` (wide photo), optional `hero-mobile.jpg`, `feature.jpg` | **Yes** |
| `src/` | Page templates, styles and scripts (no county words in here) | No |
| `netlify/` | Server functions: results upload, team photos, suspensions | No |
| `build.mjs` | Builds the site into `dist/` from `src/` + `county/` | No |
| `examples/test-county/` | A complete made-up county, as a worked example | No |

## New county in 30 minutes
1. **Copy** this whole folder (or the GitHub repository) and rename it, e.g. `shropshire-super6s`.
2. **Settings:** open `county/config.json` and change every value:
   - `siteName`, `shortName`, `countyFA`, `countyFAUrl`, `headline`, `intro`
   - `partner`: `{ "name": "...", "blurb": "..." }`, or `null` for no partner
   - `colors`: six hex colours. `brand` (main), `brandDark`, `brandLight`, `accent` (buttons), `accentDark`, `logoBg` (behind the logo)
   - `contactEmail`, `registrationForm` (the Smartsheet form link)
   - `leagues`: one entry per league night. `id` must be lower case (e.g. `tuesday`). Each division needs its Full-Time `table` code (Full-Time admin > Media > Code Snippets)
   - `shirts`: `"Team name": "Colour"` per league (use `"Blue/White"` for two colours)
3. **Pictures:** replace the files in `county/assets/` (same file names).
4. **Check it builds:** in Terminal, in the folder, run `node build.mjs`. It stops with a plain message if a setting is missing, and warns if a colour makes white text hard to read.
5. **Go live:** follow "Deploy" below, then "Event manager login".

## Deploy (Netlify)
The site must be deployed by the Netlify CLI or from GitHub. Drag-and-drop does not publish the functions.
1. Install Node.js (LTS) from nodejs.org.
2. In Terminal, in the folder, run one at a time:
   `npm install -g netlify-cli` · `npm install` · `netlify login` · `netlify init` (choose "Create & configure a new site")
3. Then `netlify deploy --build --prod`. For later updates, run the same command again.
Netlify reads `netlify.toml`, runs `node build.mjs` and publishes `dist/`.

## Event manager login (once per county, at app.netlify.com)
1. Open the site > **Site configuration > Identity** > **Enable Identity**.
2. Same page > **Registration > Registration preferences > Edit settings** > **Invite only** > Save.
3. **Identity** tab > **Invite users** > enter the event manager's email > Send.
4. When they have accepted: click their name > **Edit settings > Roles** > type `admin` > Save.
The event manager area is at `your-site-address/admin`.

## Every week (event manager)
- **Scores update by themselves:** the site reads each division's FA Full-Time results snippet (the `results` code in county/config.json) and fills in any score not uploaded yet. Check them after each league night.
- **Results upload (backup):** after each league night, export the fixtures and results from FA Full-Time. Then go to `/admin` > the league's card > **Upload Full-Time results**, and pick the file (.xls, .xlsx or .csv). Tables, form, charts and the paperwork update straight away.
- **Paperwork:** the day before each league night, go to `/admin` > **Download paperwork** > **Download PDF** (choose "Save as PDF").
- **Team photos:** `/admin` > **Team photos** > pick the team > take or choose a photo > **Save team photo**.
- **Suspensions:** `/admin` > **Suspensions**. These print on every referee sheet between the start and end dates.

## Domain
Add it in Netlify: **Domain management > Add a domain**. Register it in the league's name (shared email), not a personal one, and record who owns it in the partnership agreement.
