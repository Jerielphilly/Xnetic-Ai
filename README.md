

# Xnetic AI — Intelligent Legal Document Analysis Platform ⚖️

**Xnetic AI** is a full-stack, AI-powered legal assistant that demystifies complex contracts. It uses **Google Gemini 2.0 Flash** to summarize documents, extract clauses, flag risks, suggest negotiations, and answer questions in real-time—all through an intuitive web interface.

![Status](https://img.shields.io/badge/Status-Development-yellow?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square)

---

## 📋 Table of Contents

- Features
- Tech Stack
- Architecture
- Installation & Setup
- Usage
- API Documentation
- Security & Privacy
- Project Structure
- Contributing
- License

---

## 🎯 Features

### 📄 Smart Document Analysis
- **Intelligent Summarization:** Extract key terms, obligations, and critical sections from PDFs, DOCX, and TXT files.
- **Clause-Level Risk Scoring:** Identify and highlight risky clauses with color-coded risk levels (Low/Medium/High).
- **Document Grading:** Automatic A-F grade assignment based on fairness, completeness, and role-specific relevance.

### 🤝 AI-Powered Negotiation
- **Clause Rewriting:** Generate fairer, role-tailored alternatives for biased or unfavorable terms.
- **Contextual Suggestions:** AI proposes improvements based on your role (Tenant, Freelancer, Client, etc.).
- **Side-by-Side Comparison:** View original vs. suggested clause rewrites.

### 💬 Conversational Interface
- **Chat with Contracts:** Ask natural language questions like "What is the termination notice period?" or "Who bears liability for damages?"
- **Cited Answers:** Responses reference specific clauses and page numbers.
- **Q&A History:** Maintain conversation history within each document session.

### 📅 Timeline & Deadline Extraction
- **Automatic Date Detection:** Extracts important dates, deadlines, renewal periods, and milestones.
- **Visual Timeline:** Interactive timeline view of all key dates.
- **Progress Tracking:** Mark milestones as completed, upcoming, or overdue.

### 🗣️ Accessibility Features
- **Text-to-Speech:** Listen to document summaries and clause explanations aloud.
- **Multilingual Support:** Translate summaries and analyses into multiple languages.
- **Grammar & Clarity Analysis:** Automated grammar checks and readability suggestions for legal text.

### 📁 Document Organization
- **Folder Management:** Create folders to organize documents by project, client, or type.
- **Chat Sessions:** Each uploaded document spawns a chat session for Q&A and analysis.
- **Quick Access:** Persistent sidebar for easy navigation between documents and folders.

---

## 🛠️ Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| **Framework** | FastAPI 0.115.0 |
| **Language** | Python 3.10+ |
| **AI Model** | Google Gemini 2.0 Flash (via LangChain) |
| **Orchestration** | LangChain 0.3.7 |
| **Database** | Firebase Firestore (NoSQL) |
| **Storage** | Google Cloud Storage |
| **Authentication** | Firebase Authentication |
| **Text-to-Speech** | Google Cloud Text-to-Speech API |
| **Rate Limiting** | Slowapi 0.1.9 |
| **Document Processing** | PyPDF 5.2.0, python-docx 1.2.0 |

### Frontend
| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 15 (React 19) |
| **Styling** | Tailwind CSS 3.3+ |
| **UI Library** | Radix UI (accessible components) |
| **PDF Viewer** | react-pdf 5.7.2, react-pdf-highlighter 8.0.0-rc.0 |
| **Markdown** | react-markdown |
| **State** | React Hooks + Context API |
| **HTTP Client** | Fetch API / Axios |
| **Icons** | Lucide React |
| **Animations** | Framer Motion |
| **Database** | Firebase (Auth, Firestore, Storage) |

### Infrastructure & DevOps
| Service | Purpose |
|---------|---------|
| **Google Cloud Platform** | Gemini AI, Text-to-Speech, Storage |
| **Firebase** | Authentication, Firestore DB, Cloud Storage |
| **GitHub Actions** | CI/CD, security scanning, dependency checks |

---

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────────┐
│   Frontend      │
│  (Next.js/React)│
└────────┬────────┘
         │ (REST API calls + Firebase SDK)
         ↓
┌─────────────────┐         ┌──────────────────┐
│  FastAPI        │◄───────►│  Google Cloud    │
│  Backend        │         │  (Gemini, TTS)   │
└────────┬────────┘         └──────────────────┘
         │
         ↓
┌─────────────────┐         ┌──────────────────┐
│  Firebase       │◄───────►│  GCS Bucket      │
│  Firestore      │         │  (PDF Storage)   │
└─────────────────┘         └──────────────────┘
```

### Document Processing Pipeline

```
1. User uploads PDF/DOCX
   ↓
2. Backend extracts text (PyPDF / python-docx)
   ↓
3. LangChain chains orchestrate AI processing:
   - Summarization (Gemini)
   - Clause extraction (Gemini)
   - Risk scoring (Gemini)
   - Grammar check (Gemini)
   ↓
4. Results stored in Firestore
   Files stored in GCS (with signed URLs)
   ↓
5. Frontend displays interactive PDF viewer
   with highlighted clauses, summaries, and Q&A
```

---

## 📦 Installation & Setup

### Prerequisites
- **Python 3.10+** (backend)
- **Node.js 18+** (frontend)
- **Google Cloud Project** with:
  - Gemini API enabled
  - Cloud Storage enabled
  - Text-to-Speech API enabled
- **Firebase Project** (with Authentication, Firestore, Storage)
- **Git**

### 1. Clone Repository

```bash
git clone https://github.com/Jerielphilly/Xnetic-Ai.git
cd Xnetic-Ai
```

### 2. Backend Setup

#### 2.1 Create Virtual Environment
```bash
cd backend
python -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Activate (Mac/Linux)
source .venv/bin/activate
```

#### 2.2 Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 2.3 Set Environment Variables
Create .env (or use `.env.example` as template):

```env
# Google Cloud & AI
GOOGLE_API_KEY=<your-gemini-api-key>
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json

# Firebase
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# CORS (comma-separated for multiple origins)
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Environment
ENVIRONMENT=development

# File Upload
MAX_UPLOAD_MB=25

# Optional: Cloud Logging
ENABLE_CLOUD_LOGGING=false
```

#### 2.4 Obtain Service Account Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **Service Accounts**
4. Create or select a service account
5. Click **Keys** → **Add Key** → **Create new key** → **JSON**
6. Save as serviceAccountKey.json (add to `.gitignore`)

#### 2.5 Run Backend Server
```bash
uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`

---

### 3. Frontend Setup

#### 3.1 Install Dependencies
```bash
cd frontend
npm ci
```

#### 3.2 Environment Configuration
Create .env.local:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-project>.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<app-id>
```

Get these values from Firebase Console → Project Settings → Web App Config.

#### 3.3 Run Development Server
```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

---

## 🚀 Usage

### 1. Upload a Document
- Navigate to **Upload** section
- Select one or more PDF/DOCX/TXT files
- Choose your role (Tenant, Freelancer, Client, etc.)
- Click **Upload**

### 2. View Analysis
- **Summary:** Overview of the document with grade and score
- **Clauses:** Identified clauses with risk indicators
- **Timeline:** Extracted dates and milestones
- **Q&A:** Ask questions about the document

### 3. Negotiate Terms
- Click **Negotiate** on any clause
- AI generates role-tailored alternative language
- Compare original vs. suggested text
- Copy suggested text for use in contracts

### 4. Export & Share
- Download summaries as PDF
- Copy clause suggestions
- Share chat session links (with role-based access control)

---

## 📡 API Documentation

### Authentication
All endpoints (except `GET /`) require a valid Firebase ID token in the `Authorization` header:

```bash
Authorization: Bearer <firebase-id-token>
```

### Key Endpoints

#### Upload Document
```http
POST /upload
Content-Type: multipart/form-data

Parameters:
  - files: [UploadFile] (required) — PDF, DOCX, or TXT files
  - role: string (required) — e.g., "Tenant", "Freelancer", "Client"

Response:
  {
    "document_id": "abc123",
    "documentTitle": "Lease Agreement",
    "analysis": "...",
    "score": 75,
    "grade": "B",
    "justification": "..."
  }
```

#### Ask Question
```http
POST /ask
Content-Type: application/json

Body:
  {
    "chatId": "chat_id",
    "question": "What is the termination notice period?"
  }

Response:
  {
    "answer": "The termination notice period is 30 days...",
    "citations": ["page 3", "Clause 5.2"]
  }
```

#### Extract Clauses
```http
POST /extract-clauses
Content-Type: application/json

Body:
  {
    "chatId": "chat_id"
  }

Response:
  {
    "clauses": [
      {
        "clause_title": "Termination for Cause",
        "summary": "...",
        "risk_level": "High",
        "pageNumber": 3
      },
      ...
    ]
  }
```

#### Negotiate Clause
```http
POST /negotiate
Content-Type: application/json

Body:
  {
    "chatId": "chat_id",
    "clauseText": "Original clause text...",
    "role": "Tenant"
  }

Response:
  {
    "suggestedText": "Rewritten clause...",
    "reasoning": "This version is fairer because..."
  }
```

#### Generate Timeline
```http
POST /generate-timeline
Content-Type: application/json

Body:
  {
    "chatId": "chat_id"
  }

Response:
  {
    "events": [
      {
        "date": "2025-03-15",
        "description": "Lease commencement",
        "status": "Upcoming"
      },
      ...
    ]
  }
```

#### Text-to-Speech
```http
POST /text-to-speech
Content-Type: application/json

Body:
  {
    "text": "Document summary text..."
  }

Response:
  {
    "audioContent": "<base64-encoded-audio>",
    "contentType": "audio/mp3"
  }
```



---

## 🔐 Security & Privacy

### Data Protection
- **Encryption at Rest:** All documents stored in Google Cloud Storage with encryption.
- **Encryption in Transit:** TLS 1.2+ enforced for all API communications.
- **Access Control:** Firestore rules enforce per-user document access; users can only read/write their own data.

### Authentication & Authorization
- **Firebase Authentication:** Secure user login via email/password or OAuth (Google, GitHub).
- **ID Tokens:** Backend validates Firebase ID tokens on all protected endpoints.
- **Rate Limiting:** Slowapi middleware limits API calls (5 uploads/min, 10 questions/min) to prevent abuse.

### Secrets Management
- **No Hardcoded Secrets:** Service account keys and API keys loaded from environment variables.
- **Secret Scanning:** Git commits are scanned (via gitleaks in CI) to prevent accidental secret exposure.
- **Rotation:** Service account keys should be rotated regularly.

### File Upload Security
- **Extension Validation:** Only `.pdf`, `.docx`, `.txt` files accepted.
- **File Size Limit:** Max 25 MB per file (configurable via `MAX_UPLOAD_MB`).
- **Filename Sanitization:** User-supplied filenames sanitized to prevent path traversal attacks.
- **Signed URLs:** Uploaded files are not publicly accessible; signed URLs (1-hour validity) issued for authenticated users.

### PII Handling
- **Minimal Storage:** Full document text not persisted in Firestore by default.
- **Data Retention:** Users can request deletion of documents; automatic purge after 90 days of inactivity (optional policy).

### Compliance
- Designed to support GDPR, CCPA, and other privacy regulations (with proper configuration).
- Audit logging available via Google Cloud Logging and Firebase Security Rules.

---

## 📁 Project Structure

```
Xnetic-Ai/
├── backend/
│   ├── main.py                    # FastAPI application & endpoints
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Environment variables template
│   ├── .gitignore                 # Git ignore rules
│   └── serviceAccountKey.json     # GCP service account (not tracked)
│
├── frontend/
│   ├── app/
│   │   ├── chat/
│   │   │   ├── [chatId]/
│   │   │   │   ├── page.tsx       # Chat & document analysis UI
│   │   │   │   └── layout.tsx
│   │   │   └── layout.tsx
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Home page
│   ├── components/
│   │   ├── InteractivePdfViewer.tsx
│   │   ├── ChatInput.tsx
│   │   ├── Sidebar.tsx
│   │   └── ...other UI components
│   ├── public/
│   ├── .env.example               # Firebase config template
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
│
├── README.md                      # This file
├── .github/
│   └── workflows/
│       └── security.yml           # CI/CD security scanning
└── .gitignore                     # Root git ignore rules
```

---

## 🧪 Testing & Local Development

### Run All Services Locally
```bash
# Terminal 1: Backend
cd backend
.venv\Scripts\Activate.ps1  # or source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev

# Open http://localhost:3000 in browser
```

### Test Backend Endpoints
```bash
# Health check (no auth required)
curl http://localhost:8000/

# Upload document (requires Firebase token)
curl -X POST "http://localhost:8000/upload" \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -F "role=Tenant" \
  -F "files=@sample.pdf"

# API documentation
# Open http://localhost:8000/docs in browser (Swagger UI)
```

### Security Scans (Local)
```bash
# Secret scanning
pip install gitleaks
gitleaks detect --source . --report-path gitleaks-report.json

# Dependency audit
pip install pip-audit safety
pip-audit
safety check

# SAST (static analysis)
pip install semgrep
semgrep --config=p/security-audit --output semgrep.json .
```

---

## 🚀 Deployment

### Backend (Google Cloud Run)
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/xnetic-backend
gcloud run deploy xnetic-backend \
  --image gcr.io/PROJECT_ID/xnetic-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY,CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Frontend (Vercel or Firebase Hosting)
```bash
# Deploy to Vercel
npm i -g vercel
vercel --prod

# Or deploy to Firebase Hosting
firebase deploy --only hosting
```

---


## 📄 License

This project is licensed under the **MIT License** — see LICENSE file for details.

---

## 📞 Support & Contact

- **Issues:** [GitHub Issues](https://github.com/Jerielphilly/Xnetic-Ai/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Jerielphilly/Xnetic-Ai/discussions)

---

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful LLM capabilities
- **Firebase** for backend infrastructure
- **LangChain** for AI orchestration framework
- **Open-source community** for tools and libraries

---

**Made with ❤️ by Jeriel Philly**  
*Simplifying legal complexity, one document at a time.*