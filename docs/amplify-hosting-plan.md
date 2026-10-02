# Amplify Hosting deployment and updates

This document records the live static frontend and explains how to reproduce a reviewed frontend or CORS update. Backend implementation, model limits, and destructive cleanup are in the [backend guide](backend.md). Commands below are documentation only and were not run during this repository review.

## Current deployment

- **Public site:** https://production.d3gggdwgsp652a.amplifyapp.com/
- **AWS region:** `us-east-1`; one Amplify Hosting app named `campusfix-ai`, app ID `d3gggdwgsp652a`, branch `production`.
- **Method:** Manual upload of static Vite `dist/` contents. The app has no Git connection, custom domain, Amplify backend, WAF, or SSR service. The corrected connected-mode bundle is manual deployment job `2`, which succeeded.
- **API:** `https://mkebx3gwm5.execute-api.us-east-1.amazonaws.com`, embedded at build time by [`.env.production`](../.env.production). This URL is public configuration, not a credential. The existing backend stack's `AllowedOrigin` is the exact Amplify HTTPS origin.

The deployed CORS change set modified only the Lambda environment, dependent API integration reference, and HTTP API CORS in place. It replaced no resources, expanded no IAM permissions, and preserved the report table and Lambda artifact. The backend stack completed successfully.

## Rebuild and manually deploy the static site

Use Node.js 22.12+ from the repository root. Review the intended source and confirm `.env.production` points to the deployed API. Run `npm ci`, `npm --prefix backend ci`, `npm test`, and `npm run build`. ZIP **the contents of `dist`** with `index.html` at the archive root, for example with `cd dist && zip -q -r ../campusfix-frontend-UNIQUE.zip . && cd ..`. Keep source, credentials, private photos, and `node_modules` out of the archive.

For a new manual app, use the [Amplify console](https://console.aws.amazon.com/amplify/) in `us-east-1`: **Create new app → Deploy without Git → production branch → Drag and drop** the ZIP. For this existing app, open `campusfix-ai` and manually deploy the new ZIP to its `production` branch. Review the app ID and branch before uploading; a manual upload does not require an Amplify build instance. [AWS manual deployment instructions](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html).

When deployment completes, verify the public page and generated asset responses against the build. The deployed site should show **Connected demo**, saved-report loading, the public-data notice, and no status editor. The local `npm run dev` flow remains the separate sample-data demo.

## Exact-origin CORS update

A new Amplify app or branch may receive a different default origin. If that happens, update only the existing `campusfix-backend` stack's `AllowedOrigin`. Preserve the previous artifact bucket, artifact key, and daily limit. Create and inspect a CloudFormation change set before execution; stop if it replaces resources, touches the report table, changes IAM permissions, or changes the Lambda artifact. The commands below use the **current** hosted origin as an example and need a unique change-set name for a future update:

```sh
CAMPUSFIX_ORIGIN='https://production.d3gggdwgsp652a.amplifyapp.com'
CAMPUSFIX_CHANGE_SET='campusfix-cors-reviewed-UNIQUE'
aws --profile campusfix-ai --region us-east-1 cloudformation create-change-set --stack-name campusfix-backend --change-set-name "$CAMPUSFIX_CHANGE_SET" --change-set-type UPDATE --template-body file://infra/backend.yaml --capabilities CAPABILITY_IAM --parameters ParameterKey=AllowedOrigin,ParameterValue="$CAMPUSFIX_ORIGIN" ParameterKey=ArtifactBucket,UsePreviousValue=true ParameterKey=ArtifactKey,UsePreviousValue=true ParameterKey=DailyInferenceLimit,UsePreviousValue=true
aws --profile campusfix-ai --region us-east-1 cloudformation wait change-set-create-complete --stack-name campusfix-backend --change-set-name "$CAMPUSFIX_CHANGE_SET"
aws --profile campusfix-ai --region us-east-1 cloudformation describe-change-set --stack-name campusfix-backend --change-set-name "$CAMPUSFIX_CHANGE_SET" --query 'Changes[].ResourceChange.{Action:Action,LogicalResourceId:LogicalResourceId,Replacement:Replacement,Details:Details}'
# Execute only if the reviewed scope contains the intended in-place CORS/configuration changes.
aws --profile campusfix-ai --region us-east-1 cloudformation execute-change-set --stack-name campusfix-backend --change-set-name "$CAMPUSFIX_CHANGE_SET"
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-update-complete --stack-name campusfix-backend
```

API Gateway handles the browser preflight. [CORS is not authentication](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html): direct callers can still use the public API and read saved reports. Replacing the single allowed origin also removes connected-browser access from the old origin. Do not submit a photo merely to test hosting; the existing saved report can verify dashboard loading.

## Verification and cost assumptions

The deployed `index.html`, CSS, and JavaScript returned HTTP 200 and matched the verified local build. `OPTIONS /reports` returned HTTP 204 with the exact hosted origin and POST allowed. `GET /reports` returned HTTP 200 with that origin, saved reports, and a valid cursor shape. Headless Chrome rendered the connected notice, saved reports, and absent status editor; 390-pixel and 320-pixel viewports had no horizontal overflow. Reduced-motion settings disabled the tested animations and smooth scrolling. The [README](../README.md) links authentic desktop and report-result screenshots; [mobile evidence](screenshots/campusfix-mobile.png) is available separately. No photo or model call was made during hosting checks.

Manual upload uses no Amplify build minutes. For planning, an illustrative month might store 0.05 GB and transfer 1 GB; storage and transfer remain metered under the [current Amplify Hosting rates](https://aws.amazon.com/amplify/pricing/). Actual usage, plan eligibility, backend services, and credit consumption vary. Check the current account plan and available credits before another deployment; the application limits are not spending caps.
