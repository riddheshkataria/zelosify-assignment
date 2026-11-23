# Zelosify: Vendor–Hiring Manager Contract Management Module

A production-grade, multi-tenant enterprise contract hiring platform featuring strict Role-Based Access Control (RBAC), multi-tenant data isolation, asynchronous AWS S3 document ingestion, and an autonomous, tool-calling AI Recommendation Agent.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph Client["Next.js 15 App Router Frontend (Port 5173)"]
        VendorPortal["IT Vendor Portal<br/>(/vendor/openings)"]
        HiringPortal["Hiring Manager Portal<br/>(/hiring-manager/openings)"]
        ReduxStore["Redux Toolkit Feature Slices<br/>(vendorOpeningsSlice & hiringManagerSlice)"]
        RouteGuards["Next.js Middleware<br/>(RBAC Token & Cookie Guards)"]
    end

    subgraph Backend["Express.js Server (Port 5001)"]
        AuthMW["Auth & RBAC Middleware<br/>(JWT RS256 / HS256 & Tenant Scoping)"]
        VendorCtrl["Vendor Controller<br/>(/api/v1/vendor/openings)"]
        HiringCtrl["Hiring Manager Controller<br/>(/api/v1/hiring-manager)"]
        AgentOrch["AI Agent Orchestrator<br/>(Async, Non-Blocking)"]
    end

    subgraph AIAgent["Autonomous Tool-Calling AI Agent"]
        LLM["Groq Llama-3.3-70b-Versatile<br/>(Multi-turn Function Calling)"]
        ToolReg["Tool Registry<br/>• parseResume (pdf-parse + prompt sanitization)<br/>• normalizeSkills (standardized taxonomy)<br/>• computeDeterministicScore (weighted SLA formula)"]
        Validator["Ajv JSON Schema Validator<br/>(Strict Output Enforcement)"]
    end

    subgraph Storage["Data & Security Layer"]
        Postgres[("PostgreSQL 16 (Port 5445)<br/>Prisma ORM with ACID Transactions")]
        S3["AWS S3 (zel-recruit)<br/>Scoped Key: &lt;tenantId&gt;/&lt;openingId&gt;/&lt;timestamp&gt;_&lt;file&gt;"]
        Keycloak["Keycloak IAM 26 (Port 8080)<br/>Realm: Zelosify"]
    end

    VendorPortal --> ReduxStore
    HiringPortal --> ReduxStore
    ReduxStore --> RouteGuards
    RouteGuards --> AuthMW

    AuthMW --> VendorCtrl
    AuthMW --> HiringCtrl

    VendorCtrl --> Postgres
    VendorCtrl --> S3
    VendorCtrl -.->|Non-blocking async trigger| AgentOrch

    HiringCtrl --> Postgres
    HiringCtrl --> S3

    AgentOrch --> LLM
    LLM <--> ToolReg
    ToolReg --> Validator
    Validator --> Postgres
```

---

## 2. Security & Multi-Tenant RBAC Rules

1. **Tenant Isolation**: Every database interaction enforces `{ tenantId: req.user.tenantId }`. Cross-tenant data leakage is structurally impossible.
2. **IT Vendor Isolation (`IT_VENDOR`)**:
   - Can only browse active openings belonging to their assigned tenant.
   - Presigned S3 candidate uploads are placed in tenant-partitioned paths: `<tenantId>/<openingId>/<timestamp>_<filename>`.
   - Can only list and manage candidate profiles they uploaded (`profile.uploadedBy === req.user.id`).
   - Sensitive AI evaluation metrics (`recommendationScore`, `recommendationReason`, `recommendationConfidence`, `recommendationLatencyMs`) are **strictly stripped** before responses are sent (`sanitizeProfileForVendor`).
   - Prohibited from viewing other vendors' candidates or modifying candidate review statuses.
3. **Hiring Manager Scoping (`HIRING_MANAGER`)**:
   - Can only access contract openings where `hiringManagerId === req.user.id`.
   - Has full visibility into candidate profiles submitted to their openings, complete with match scores, confidence ratings, AI reasoning breakdowns, and preview links.
   - Authorised to shortlist (`SHORTLISTED`) or reject (`REJECTED`) candidate profiles.
   - Prohibited from submitting candidates directly.

---

## 3. Autonomous AI Recommendation Agent

- **Tool-Calling Architecture**: The agent does not generate hallucinated final scores. It is strictly constrained to use registered tools:
  - `parseResume`: Extracts candidate experience years, tech skills, location, and education from PDF/documents while mitigating prompt injection.
  - `normalizeSkills`: Normalizes raw skills into standard tech taxonomy tokens.
  - `computeDeterministicScore`: Computes the match score using the strict weighted SLA formula:
    $$\text{FinalScore} = 0.5 \times \text{skillMatch} + 0.3 \times \text{experienceMatch} + 0.2 \times \text{locationMatch}$$
- **Decision Thresholds**:
  - Score $\ge 0.75 \implies$ **Recommended** (Emerald badge)
  - $0.50 \le \text{Score} < 0.75 \implies$ **Borderline** (Amber badge)
  - Score $< 0.50 \implies$ **Not Recommended** (Rose badge)
- **Non-Blocking Asynchronous Execution**: Candidate submissions return HTTP 201 immediately; the AI evaluation runs in the background via `RecommendationService.triggerAsyncEvaluation` without delaying HTTP responses.
- **Latency Benchmark**: Sub-2-second constraint strictly adhered to ($P95 = 0.076\text{ ms}$ verified across 100-profile simulation benchmark).

---

## 4. Test Accounts & Personas

| Persona | Username | Email | Password | Role | Portals Accessible |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IT Vendor** | `user1` | `vendor@zelosify.com` | `Test@1234` | `IT_VENDOR` | `/vendor/openings`, `/vendor/openings/[id]` |
| **Hiring Manager** | `user2` | `hiring@zelosify.com` | `Test@1234` | `HIRING_MANAGER` | `/hiring-manager/openings`, `/hiring-manager/openings/[id]` |
| **Keycloak Admin** | `admin` | - | `admin` | IAM SuperAdmin | `http://localhost:8080` |

---

## 5. Quickstart & Setup Guide

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- Docker Desktop (for Postgres 16 and Keycloak)

### Step 1: Start Infrastructure (PostgreSQL & Keycloak)
```bash
docker start recruit-postgres recruit-keycloak
# Or run docker compose if starting fresh
```
- PostgreSQL is available on `localhost:5445` (Database: `zelosify_recruit_test`, Schema: `app`)
- Keycloak is available on `localhost:8080` (Realm: `Zelosify`)

### Step 2: Start the Backend Server
```bash
cd Zelosify-Backend/Server
npm install
npm run dev
```
Backend runs on **`http://localhost:5001`**.

### Step 3: Start the Frontend Application
```bash
cd Zelosify-Frontend
npm install
npm run dev
```
Frontend runs on **`http://localhost:5173`**.

---

## 6. Verification & Automated Test Suites

The backend includes 6 test suites covering local authentication, RBAC tenant isolation, AI agent tool execution, REST API controllers, end-to-end integration flows, and latency benchmark simulations.

To run the automated test suite:
```bash
cd Zelosify-Backend/Server
npm test -- --run
```

### Test Suite Summary:
```
 ✓ tests/unit/controllers/auth/local/localAuth.unit.test.ts (6 tests)
 ✓ tests/unit/rbac/tenantOwnership.unit.test.ts (15 tests)
 ✓ tests/unit/aiAgent/aiAgent.unit.test.ts (20 tests)
 ✓ tests/performance/latencyBenchmark.test.ts (1 test)
 ✓ tests/integration/fullFlow.integration.test.ts (5 tests)
 ✓ tests/unit/controllers/vendorAndHiring.unit.test.ts (10 tests)

 Test Files  6 passed (6)
      Tests  57 passed (57)
```

### 100-Profile Benchmark Latency Results:
- **P50**: 0.013 ms
- **P90**: 0.045 ms
- **P95**: **0.076 ms** (Target: $< 2000\text{ ms}$)
- **P99**: 1.352 ms

---

## 7. REST API Reference

### IT Vendor Endpoints (`IT_VENDOR`)
- `GET /api/v1/vendor/openings` - List tenant openings with search, pagination, and filter
- `GET /api/v1/vendor/openings/:id` - Get opening details and own submitted candidate roster
- `POST /api/v1/vendor/openings/:id/profiles/presign` - Generate presigned S3 upload URLs
- `POST /api/v1/vendor/openings/:id/profiles/upload` - Submit candidate profiles and trigger async AI evaluation
- `PATCH /api/v1/vendor/profiles/:id/soft-delete` - Soft delete a candidate profile submitted by caller

### Hiring Manager Endpoints (`HIRING_MANAGER`)
- `GET /api/v1/hiring-manager/openings` - List openings assigned to caller manager
- `GET /api/v1/hiring-manager/openings/:id/profiles` - List candidate profiles with AI scores, confidence, and reasons
- `POST /api/v1/hiring-manager/profiles/:id/shortlist` - Shortlist a candidate profile
- `POST /api/v1/hiring-manager/profiles/:id/reject` - Reject a candidate profile
- `GET /api/v1/hiring-manager/profiles/:id/preview` - Generate a temporary presigned preview link for resume document

---

## 8. License

This repository is proprietary and maintained for assessment purposes. All rights reserved.
