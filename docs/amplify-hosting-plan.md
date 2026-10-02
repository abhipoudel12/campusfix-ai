# Amplify Hosting deployment — 2026-10-02

## Live address and scope

**Public site:** https://production.d3gggdwgsp652a.amplifyapp.com/

The site is one static Amplify Hosting app named `campusfix-ai` in `us-east-1`, with a manually deployed `production` branch and Amplify's default HTTPS address. It has no Git connection, custom domain, Amplify backend, WAF, or SSR service. The existing backend API remains `https://mkebx3gwm5.execute-api.us-east-1.amazonaws.com`.

## Build and deployment record

- The approved dark cyan/violet theme remains. `.env.production` embeds the public API URL in `npm run build`. The local `npm run dev` flow remains the labeled sample-data demo.
- The production build passed all 23 repository tests and was packaged with `index.html` at the ZIP root plus only the generated CSS and JavaScript assets. No source, photo, credential, or `node_modules` was uploaded. The corrected connected-mode wording was deployed to the **same** app in manual deployment job `2`, which finished `SUCCEED`.
- The AWS account was checked immediately before creation and remained `FREE` / `ACTIVE` with a positive credit balance. No Paid plan or account upgrade was required.
- The existing `campusfix-backend` CloudFormation stack's `AllowedOrigin` changed from `http://localhost:5173` to the exact site origin, `https://production.d3gggdwgsp652a.amplifyapp.com`. The inspected change set `campusfix-amplify-origin-20261002T205844Z` listed only in-place changes to `ApiFunction` environment, dependent `ApiIntegration` URI, and `HttpApi` CORS. It listed no table, IAM role, route, or artifact change. The stack reached `UPDATE_COMPLETE` with the same physical report table, Lambda, and IAM role. `ArtifactKey` remained `backend/campusfix-backend-schema-20261002T2033Z.zip`, and the Lambda code checksum matched that artifact.

## Read-only verification

- Amplify deployment job `2` succeeded. The public `index.html`, CSS, and JavaScript returned HTTP 200 and matched the verified local build byte for byte.
- `OPTIONS /reports` from the exact hosted origin returned HTTP 204 with that origin allowed and POST permitted. `GET /reports` from the same origin returned HTTP 200 with the matching CORS header, one existing report on the page, and the previously verified score-85 sidewalk example. The cursor shape was valid.
- Headless Chrome rendered connected mode with the exact notice “Reports are saved here; facilities teams are not notified.” The public-data notice, AI analysis wording, actual workflow panel, saved report, and disabled status editor were verified in the visible DOM. A true 390-pixel viewport had no horizontal overflow. Actual desktop, mobile, and report-result screenshots are linked from the README.
- No photo was submitted and Bedrock was not invoked. The strongly consistent October 2 application inference-attempt counter remained **5**.

## Cost and Free Plan

Manual upload uses no Amplify build minutes. At a planning month of 0.05 GB CDN storage and 1 GB transfer, [Amplify's published rates](https://aws.amazon.com/amplify/pricing/) imply **$0.15115** of metered hosting usage before allowances (0.05 × $0.023 + 1 × $0.15). Applicable monthly allowances of 5 GB storage and 15 GB transfer would cover that scenario without consuming hosting credits while eligible. Usage above allowances and the existing API Gateway, Lambda, Bedrock, DynamoDB PITR, CloudWatch Logs, and S3 artifact usage are separate; this estimate is not a spending cap. [AWS lists Amplify as eligible for new-customer Free Tier credits](https://aws.amazon.com/amplify/pricing/) and describes [Free Plan duration and credit limits](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html).

API Gateway CORS is scoped to the hosted origin, but [CORS is not authentication](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html). The API and its saved reports remain public. Local connected browser builds now need a reviewed CORS change; the local sample-data demo works without the API.
