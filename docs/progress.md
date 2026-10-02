# CampusFix AI development progress

This log records the main implementation decisions and what was verified. The [README](../README.md) explains the live app; the [backend guide](milestone-2-backend.md) and [hosting record](amplify-hosting-plan.md) hold operational detail.

## MVP definition and frontend development

The project began as a campus maintenance reporting demo: a photo and location lead to a suggested report and dashboard entry. The coding agent built the responsive dark cyan/violet interface, original campus mark, upload preview, location and notes form, score explanation, sorting, and filtering. The first local mode deliberately used predefined sample scenarios; it did not analyze photos or retain reports after refresh. This local mode remains available through `npm run dev` without an API URL.

**Verified:** Local sample-report and score tests, a Vite build, and browser-visible controls. The connected mode was added later and has different behavior.

## AWS Agent Toolkit connection

The coding agent used the AWS Agent Toolkit for a sanitized read-only account and model-catalog check. The connection and identity-check evidence is preserved in the [AWS MCP screenshots](screenshots/aws-mcp-connected.png) and [identity screenshot](screenshots/aws-mcp-identity-check.png). A separate AWS CLI profile check confirmed the intended Free Plan account before deployment actions; the MCP connection image alone did not prove profile selection.

**Verified:** Read-only access, `FREE` / `ACTIVE` plan status, a positive credit balance, and Nova Lite catalog availability. Catalog listing by itself did not verify inference access. No credential or account identifier is recorded here.

## Backend implementation and deployment

The coding agent implemented the CloudFormation templates and Node.js Lambda handler. API Gateway exposes public `POST /reports` and `GET /reports`; Lambda validates input, computes an exact photo/location fingerprint, checks duplicates and the daily limit, invokes Bedrock Nova Lite for new accepted reports, validates seven output fields, calculates a deterministic score, and saves report text in DynamoDB. S3 holds Lambda deployment ZIPs only. The backend stack was deployed in `us-east-1` with a retained DynamoDB table, point-in-time recovery, limited model permission, sanitized CloudWatch diagnostics, and API throttling. Connected-mode anonymous status editing was removed; local sample status editing remains.

**Verified:** CloudFormation stack completion, healthy Lambda, preserved table identity, safe GET and invalid-input API responses, and mocked tests for validation, duplicate, quota, and pagination behavior. Those checks alone did not prove live model output would pass validation.

## Deployment and model-output issues resolved

Two early backend stack attempts rolled back. One table creation failed with a KMS validation error; omitting the explicit managed-key selection let DynamoDB use its default AWS owned encryption. A later Lambda configuration failed because reserving concurrency would violate this account's unreserved minimum; removing the reserved-concurrency setting allowed deployment. The precise cause of the earlier KMS key absence was not established.

Four controlled photo submissions then returned HTTP 502 without a saved report. Sanitized diagnostics narrowed one failure to JSON parsing and a later failure to schema values, while deliberately excluding photo bytes, notes, and model response text. The coding agent tightened the seven-field prompt, accepted only harmless whitespace and enum-case differences, retained strict missing/extra/type/value checks, and added fixed field-specific reason codes with focused mocked tests. The exact contents of the failed model responses were not logged, so their full causes remain unknown. The [backend guide](milestone-2-backend.md) retains the engineering details of the resolved deployment problems.

**Verified:** Focused mocked parser, validator, scoring, failure, and redaction tests. The repairs did not create fallback analysis or change the selected model.

## Successful live inference and duplicate check

One controlled submission of a reviewed, nonprivate sidewalk image returned HTTP 201 with all seven validated analysis fields: `Grounds`, `High`, hazard `true`, recurring `false`, and a deterministic score of **85**. The report was retrieved through `GET /reports` and checked as a ready DynamoDB item without photo bytes. One identical duplicate returned HTTP 200 with the same report ID and no new inference attempt; the application counter followed **4 → 5 → 5**.

The coding agent prepared the focused checks and compared the API, table, and counter results. This is one verified live example after four failures. It does not establish a general model success rate or direct Bedrock billing totals.

## Public hosting and final checks

The coding agent built the connected Vite site with the deployed API URL and manually deployed its static files to one Amplify Hosting app at **https://production.d3gggdwgsp652a.amplifyapp.com/**. An inspected CloudFormation change set updated the existing backend's CORS origin in place, preserving its Lambda artifact, DynamoDB table, and IAM role. A final interface audit corrected connected-mode headings, helper text, loading feedback, and status summaries while retaining explicit local sample labeling and the approved theme.

**Verified:** All **23 repository tests** and the production build passed. The public page and assets matched the verified build; CORS preflight and saved-report GET passed. Headless Chrome rendered the connected wording, the saved report, and no status editor. A mobile viewport had no horizontal overflow, and authentic [desktop](screenshots/campusfix-desktop.png), [mobile](screenshots/campusfix-mobile.png), and [report-result](screenshots/campusfix-report-result.png) screenshots were captured. No photo was submitted during hosting; the inference-attempt counter remained **5**.

The public app and repository evidence are ready for a Builder Center entry. The project description, category tags, and final submission have not been published.
