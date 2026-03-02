# Container Hunter — Claude Code Instructions
> Find what others miss.

This file is read automatically by Claude Code every time it launches in this project. Follow these instructions precisely. Do not deviate from the architecture or business logic defined here.

---

## Project Overview

Container Hunter is a production Python web application that:

1. Accepts business addresses via CSV upload
2. Geocodes them using Google Geocoding API
3. Fetches satellite imagery from Google Maps Static API
4. Runs YOLOv8 inference to detect storage containers
5. Excludes trailers from container counts (critical business rule)
6. Stores results in PostgreSQL + PostGIS
7. Displays results in a Streamlit review dashboard

---

## Project Structure

```
container-hunter/
├── app/
│   ├── main.py              # Streamlit dashboard — entry point
│   ├── pipeline.py          # Main orchestration logic
│   ├── geocoder.py          # Google Geocoding API
│   ├── image_fetcher.py     # Google Maps Static API
│   ├── detector.py          # YOLOv8 inference (model singleton)
│   ├── database.py          # All PostgreSQL/PostGIS operations
│   ├── s3_handler.py        # Temporary AWS S3 image storage
│   ├── label_utils.py       # Class label normalization (curly quotes etc.)
│   ├── settings.py          # ENV variable loader — single source of truth
│   └── constants.py         # Shared constants (disclaimer, status strings)
├── models/
│   └── best.pt              # Trained YOLOv8 weights (3 classes)
├── training/
│   └── train_container_model.ipynb  # Google Colab training notebook
├── sql/
│   └── schema.sql           # PostgreSQL + PostGIS schema
├── requirements.txt
├── docker-compose.yml       # PostgreSQL + PostGIS local DB
├── .env                     # Secret keys — NEVER commit this
├── .env.example             # Template — safe to commit
├── CLAUDE.md                # This file
└── README.md
```

---

## Tech Stack

| Layer           | Tool                      | Version            |
|-----------------|---------------------------|--------------------|
| Language        | Python                    | 3.11               |
| Web UI          | Streamlit                 | 1.35.0             |
| Computer Vision | Ultralytics YOLOv8        | 8.2.0              |
| Image Source    | Google Maps Static API    | zoom=19, 640x640   |
| Geocoding       | Google Geocoding API      | —                  |
| Database        | PostgreSQL + PostGIS      | 16 + 3.4           |
| Temp Storage    | AWS S3                    | boto3              |
| Local DB        | Docker Compose            | postgis/postgis:16-3.4 |
| Env Management  | python-dotenv             | 1.0.1              |

---

## CRITICAL Business Logic Rules

These rules are **NON-NEGOTIABLE**. Never change them without explicit instruction.

### 1. Detection Classes

```
Class 0: "40' containers"       → COUNTS as container ✅
Class 1: "Other size container" → COUNTS as container ✅
Class 2: "trailer"              → NEVER counts as container ❌
```

### 2. Confidence Thresholds

```python
CONF_IGNORE_BELOW   = 0.45   # Detections below this are discarded entirely
CONF_AUTO_CONFIRM   = 0.90   # At or above this = auto-confirmed, no review needed
# Between 0.45 and 0.90 = needs_review (human reviews these)
```

### 3. Scan Status Logic

```python
if container_count == 0:
    status = "rejected"
elif max_confidence >= 0.90:
    status = "confirmed"
else:
    status = "needs_review"
```

### 4. Trailer Rule

- Trailers ARE logged in the `detections` table (audit trail, `confirmed=False`)
- Trailers do NOT count toward `container_count`
- Trailers do NOT affect scan status
- Never remove trailer detections from DB — only exclude from counts

### 5. Google Maps Compliance (MANDATORY)

- Images are **NEVER** stored permanently
- Images upload to S3 temporarily during inference ONLY
- S3 deletion is **ALWAYS** in a `try/finally` block — guaranteed even on crash
- Review UI **ALWAYS** re-fetches images live — never from cache or S3
- The imagery disclaimer **MUST** always be shown:

```
"Capture date unavailable from Google Static Maps; imagery may be outdated."
```

### 6. Export Filter

- Export only rows where: `status == "confirmed"` AND `containers_detected > 0`
- Never export `rejected`, `needs_review`, `pending`, or `scan_failed` rows

### 7. Partial Geocode Matches

- If `geocode_partial_match == True`: flag for review, **DO NOT** auto-scan
- Partial matches are unreliable and need manual address verification first

### 8. Rescan Cooldown

- Do not rescan a business scanned within the last 30 days
- Controlled by `RESCAN_COOLDOWN_DAYS` env variable (default: 30)

---

## Environment Variables

All ENV variables are defined in `app/settings.py`. **Never** call `os.getenv()` directly in other modules — always import from `settings`.

### Required (app crashes on startup if missing):

```
GOOGLE_MAPS_API_KEY
GOOGLE_GEOCODING_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET
DATABASE_URL
MODEL_PATH
```

### Optional with defaults:

```
AWS_REGION=us-east-1
CONFIDENCE_THRESHOLD=0.45
AUTO_APPROVE_THRESHOLD=0.90
GEOCODING_RPM_LIMIT=50
MAPS_RPM_LIMIT=500
PIPELINE_BATCH_SIZE=50
PIPELINE_DELAY_SECONDS=1.2
RESCAN_COOLDOWN_DAYS=30
IMAGE_ZOOM_DEFAULT=19
IMAGE_SIZE_PX=640
```

### Class label variables:

```
CONTAINER_CLASS_NAMES=40' containers,Other size container
NON_CONTAINER_CLASS_NAMES=trailer
```

---

## Database Schema

Three tables in PostgreSQL + PostGIS:

### `businesses`
Stores geocoded business addresses. Key fields: `id`, `address`, `lat`, `lng`, `geo` (PostGIS geography point), `geocode_status` (ok/failed/partial), `geocode_partial_match` (boolean)

### `scans`
One row per AI scan of a business address. Key fields: `id`, `business_id` (FK), `containers_detected`, `max_confidence`, `status` (pending/confirmed/rejected/needs_review/scan_failed), `imagery_note` (always contains the disclaimer text)

### `detections`
One row per bounding box detected. Key fields: `id`, `scan_id` (FK), `confidence`, `bbox_x1/y1/x2/y2`, `class_id`, `class_name`, `confirmed` (True=container, False=trailer, NULL=unknown)

### Indexes (already in schema.sql):
- GIST index on `businesses.geo` (spatial queries)
- Index on `scans.status` (dashboard queue queries)
- Index on `scans.business_id` (FK lookups)
- Index on `detections.scan_id` (FK lookups)

---

## Module Responsibilities

### `constants.py`
Single source of truth for all shared strings and thresholds. Import `IMAGERY_DISCLAIMER` from here — never hardcode that string elsewhere.

### `label_utils.py`
All class label normalization logic lives here. Handles curly quotes (`'` → `'`), case-insensitive matching, ENV parsing. Import `CONTAINER_CLASSES` and `TRAILER_CLASSES` from here in other modules.

### `settings.py`
Loads and validates all ENV variables at startup. Fails fast with a clear error message if required variables are missing. Import the `settings` object — never use `os.getenv()` in other modules.

### `detector.py`
- Loads YOLOv8 model ONCE via module-level singleton (never per inference call)
- Returns ALL raw detections above confidence threshold — NO filtering here
- Filtering happens exclusively in `pipeline.py`

### `pipeline.py`
- Orchestrates the full flow: geocode → fetch image → upload S3 → inference → delete S3 → filter → save DB
- S3 deletion is ALWAYS wrapped in `try/finally` — guaranteed even on exception
- Trailer exclusion logic lives here
- Status determination logic lives here

### `database.py`
- ALL SQL queries live here — no raw SQL in any other module
- Uses psycopg2 with `get_connection()` context manager
- `get_confirmed_export()` enforces: `status='confirmed'` AND `containers_detected > 0`

### `main.py`
- Streamlit dashboard with 4 tabs: Upload & Geocode / Scan / Review Queue / Results & Export
- Review UI ALWAYS re-fetches satellite images live (Google ToS compliance)
- ALWAYS shows imagery disclaimer
- Draws red bounding boxes with class name + confidence using PIL ImageDraw

---

## How to Run Locally

### First-time setup:

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Set up environment variables
cp .env.example .env
# Fill in .env with your real API keys before continuing

# 3. Start PostgreSQL + PostGIS
docker-compose up -d

# 4. Wait 15 seconds for DB to initialize, then verify
docker-compose ps
# Should show: container_hunter_db running (healthy)

# 5. Launch the dashboard
streamlit run app/main.py
# Opens at http://localhost:8501
```

### Daily development:

```bash
docker-compose up -d          # Start DB
streamlit run app/main.py     # Run dashboard
docker-compose down           # Stop DB when done
```

---

## Common Claude Code Tasks

When asked to help, approach these tasks as follows:

### "Get the project running"
1. Check `.env` exists — if not, copy `.env.example` and warn user to fill in API keys
2. Run `docker-compose up -d`
3. Run `pip install -r requirements.txt`
4. Run `streamlit run app/main.py`
5. Report any startup errors clearly with suggested fixes

### "Fix a database connection error"
1. Check `docker-compose ps` — is `container_hunter_db` running and healthy?
2. Check `DATABASE_URL` in `.env` matches docker-compose credentials:
   `postgresql://container:container@localhost:5432/container_hunter`
3. If tables missing: `docker-compose down -v && docker-compose up -d` to reset and re-apply schema

### "The model isn't loading"
1. Check `MODEL_PATH` in `.env` — should be `./models/best.pt`
2. Verify `models/best.pt` exists: `ls -lh models/best.pt`
3. If file is <1MB it's corrupt or a placeholder
4. Remind user to download `best.pt` from the Google Colab training notebook

### "Run a quick health check"

```bash
# Check DB is running
docker-compose ps

# Check Python imports resolve correctly
python -c "from app.settings import settings; print('✅ Settings OK')"
python -c "from app.database import get_queue_stats; print('✅ Database OK')"
python -c "from app.detector import get_model; print('✅ Model OK')"

# Launch dashboard
streamlit run app/main.py
```

### "Add a new feature"
1. Read the relevant module(s) first before writing any code
2. Follow existing patterns — psycopg2 context manager, loguru logging, settings import
3. Never bypass the trailer exclusion rule
4. Never store satellite images permanently
5. Always show the imagery disclaimer in any new UI component
6. Add any new shared strings to `constants.py`
7. Add any new ENV variables to both `settings.py` and `.env.example`

### "Test the pipeline with sample data"

```bash
# Create a test CSV
echo "business_name,address" > /tmp/test_addresses.csv
echo "Test Co,1600 Amphitheatre Parkway Mountain View CA" >> /tmp/test_addresses.csv

# Upload via the Streamlit dashboard
streamlit run app/main.py
# → Upload & Geocode tab → upload the CSV → click Geocode → click Scan
```

---

## Code Style Rules

These must be followed in all code written for this project:

| Rule            | Detail                                                                 |
|-----------------|------------------------------------------------------------------------|
| Logging         | Use loguru — `from loguru import logger` — never `print()` in modules |
| DB queries      | Only in `database.py` — no raw SQL elsewhere                          |
| ENV access      | Only via `settings` object — no `os.getenv()` in other modules        |
| Shared strings  | Only from `constants.py` — no hardcoded disclaimer or status strings  |
| Class labels    | Only via `label_utils.py` — no raw string comparisons to class names  |
| Comments        | Use `# ── Section ─────────────────────────` style throughout          |
| Error handling  | Wrap all API calls in `try/except` with loguru error logging          |
| Retry logic     | Use `tenacity` for Google API calls with exponential backoff          |

---

## Brand & UI Reference

```
App Name  : Container Hunter
Tagline   : Find what others miss.

Colors:
  --slate-bg       : #1E2A3A   Main background
  --slate-dark     : #151F2E   Sidebar, card backgrounds
  --slate-mid      : #253447   Input backgrounds
  --slate-border   : #2E4060   All borders
  --rose-gold      : #C9956A   Primary accent, highlights
  --rose-gold-light: #E8B48A   Lighter accent
  --white          : #F0F4F8   Primary text
  --white-dim      : #8DA0B3   Secondary text, labels
  --red-detect     : #FF4757   Bounding boxes on detections
  --green-confirm  : #2ED573   Confirmed status
  --yellow-review  : #FFD43B   Needs review status
  --red-reject     : #FF4757   Rejected status

Fonts:
  Rajdhani       : All headings, labels, buttons (uppercase, letter-spaced)
  Inter          : Body text, descriptions
  JetBrains Mono : All data values, coordinates, code, confidence scores

Style: Glassmorphism cards, dark industrial aesthetic, subtle grid overlay
```

---

## Security Rules

Never violate these under any circumstances:

- ❌ Never commit `.env` to git
- ❌ Never log or print API keys — even in debug output
- ❌ Never expose S3 bucket URLs publicly
- ❌ Never store satellite imagery permanently (Google ToS)
- ❌ Never push `models/best.pt` to a public repo
- ❌ Never open database port 5432 to the public internet on AWS

Always ensure `.gitignore` contains:

```
.env
models/best.pt
__pycache__/
*.pyc
*.pyo
.DS_Store
```

---

## Roboflow Dataset

```
Workspace  : emptycity1995
Project    : containerdetection-76m5b
Version    : 1
Format     : YOLOv8
Notebook   : training/train_container_model.ipynb
Runtime    : Google Colab — T4 GPU required
Output     : models/best.pt
```

---

## AWS Deployment (Planned)

Target infrastructure for production launch:

- EC2 t3.medium — app server + PostgreSQL (same instance for MVP)
- S3 bucket — temporary image storage only, all public access blocked
- Port 8501 — Streamlit behind nginx with SSL
- Port 5432 — NEVER open to public internet
- IAM roles — preferred over hardcoded AWS credentials

---

*Container Hunter — Find what others miss.*
