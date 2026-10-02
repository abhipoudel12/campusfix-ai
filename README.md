# CampusFix AI

CampusFix AI is a campus maintenance reporting demo. A photo and location can become a suggested report with a transparent attention score. The dashboard helps people review issues, but it does not notify a facilities team or replace an inspection.

## What it does

- Accepts a JPEG, PNG, or WebP photo, a location, and optional notes.
- Checks whether the same photo and normalized location already have a report before requesting AI analysis.
- Uses Amazon Nova Lite to suggest seven report fields for a new issue: title, category, severity, hazard, recurring, description, and action. The backend validates every field and rejects unusable output.
- Calculates a deterministic Campus Attention Score: Low / Medium / High contributes 25 / 50 / 70 points, hazard adds 15, recurring adds 5, and the result is capped at 100. It is a triage aid, not a safety rating.
- Displays saved reports with sorting, status filtering, refresh, and paginated loading.

## Workflow

```mermaid
flowchart LR
  A[Photo + location] --> B[API Gateway]
  B --> C[Lambda: validate and check duplicate]
  C -->|Existing report| G[DynamoDB report]
  C -->|New report| D[Bedrock Nova Lite: one inference attempt]
  D --> E[Validate analysis + calculate score]
  E --> G
  G --> H[Dashboard]
```

The backend accepts the image bytes inline through API Gateway and Lambda, passes them inline to Bedrock for a new report, and does **not** retain photos. DynamoDB stores report text, score, status, and temporary processing/quota records. The existing S3 bucket stores Lambda deployment code only, not submitted photos.

Duplicate detection uses SHA-256 over the decoded photo bytes, a NUL separator, and the location after trimming, lowercasing, and collapsing whitespace. A completed report with that fingerprint is returned without incrementing the inference counter or calling Bedrock. A matching submission still being processed receives HTTP 409; a stale processing lease can be reclaimed. Notes are not part of the fingerprint, so changing only notes does not create another report. Different image bytes or a different normalized location can create a new report.

## Connected mode and local demo

The production build has the deployed API URL in [`.env.production`](.env.production). **Connected demo** sends the photo to the public AWS API, requests AI analysis only for a new fingerprint, and loads persistent reports from DynamoDB. Anyone with the API URL can read reports, so use nonprivate demo data. Anonymous status editing is disabled. Failed submissions show an error; the browser does not retry automatically. If the connection drops, the outcome may be unknown, so check saved reports before submitting again.

Run `npm run dev` without a development API URL for **Local demo**. It does not upload or analyze the photo. The selected sample scenario supplies the report facts, and reports exist only in browser memory until refresh. Status editing is available only in this local mode.

One controlled live test on October 2, 2026 returned a report for a damaged sidewalk with `Grounds`, `High`, hazard `true`, recurring `false`, and score **85**. The report was retrieved from the API and checked in DynamoDB. An identical second submission returned that report without another inference attempt; the application counter went **4 → 5 → 5**. This verifies one example, not the reliability of every future model response. See [the progress log](docs/progress.md) for test history and diagnostics.

## Run locally

Use Node.js 22.12+ and npm. From the repository root:

```sh
npm ci
npm --prefix backend ci
npm test
npm run dev
```

Open `http://localhost:5173` for the local demo. `npm run build` creates the connected production site in `dist/`; `npm run preview` previews that build. The API currently allows the localhost development origin for connected browser testing. After the planned Amplify CORS update, that allowance changes to the exact hosted origin unless CORS is reviewed again.

## AWS deployment and costs

The deployed backend in `us-east-1` uses API Gateway HTTP API, Lambda, Bedrock Nova Lite, DynamoDB with point-in-time recovery, CloudWatch Logs, CloudFormation, IAM, and an S3 bucket for Lambda artifacts. The public frontend is **not hosted yet**. The proposed simplest path is a manual upload of the static `dist` contents to AWS Amplify Hosting, followed by a reviewed CORS update to the existing backend. No custom domain or Amplify backend is needed. See the [hosting plan](docs/amplify-hosting-plan.md) for exact steps and an estimate.

Cost controls include one Bedrock SDK attempt per new submission, a 20-attempt daily application limit, API throttling at one request per second with burst two, duplicate reuse, and image size limits. These controls are not a spending cap. Hosting, API, Lambda, Bedrock, DynamoDB, logs, and artifact storage can incur usage; Free Plan eligibility and remaining credits must be checked before hosting. The API has no user authentication, and reports are public demo data. AI classifications may be wrong; status changes are unavailable in connected mode.

## Evidence and screenshots

The existing AWS MCP evidence shows the connected tooling and a read-only identity check. It is not a screenshot of the hosted app.

![AWS MCP connection evidence](docs/screenshots/aws-mcp-connected.png)

![AWS MCP read-only identity check](docs/screenshots/aws-mcp-identity-check.png)

The Amplify public URL and actual desktop, mobile, and report-result screenshots will be added after hosting and browser verification. No hosted screenshots are available yet.
