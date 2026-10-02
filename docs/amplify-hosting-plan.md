# Amplify Hosting plan — approval draft (2026-10-02)

## Current gate

The backend API is deployed in `us-east-1` and passed one controlled photo submission and identical duplicate test. The frontend build is prepared locally. No Amplify app, public frontend URL, hosted browser check, or Amplify-origin CORS update exists yet. Hosting and the CORS update require approval after this plan is reviewed; a further live inference is outside this plan.

## Build and behavior

- Node.js 22: `npm ci`, `npm --prefix backend ci`, `npm test`, `npm run build`. Vite publishes static files in `dist/`.
- [`.env.production`](../.env.production) embeds `VITE_API_URL=https://mkebx3gwm5.execute-api.us-east-1.amazonaws.com` in the production build. This public API URL is not a credential. `npm run dev` without a development API URL remains the labeled local demo.
- The approved dark cyan/violet theme remains. Connected mode sends photos inline, loads persistent reports, supports refresh and cursor pagination, and shows no status editor. A new report uses one AI attempt after the duplicate check; an existing report returns without inference. Local demo uses sample scenarios in browser memory and allows local-only status changes.
- HTTP 502 explains that no report was saved. A lost connection explains that the outcome is unknown and asks the user to check saved reports. The frontend does not retry a failed POST.

## Exact sequence after approval

1. Recheck the AWS account's `FREE` / `ACTIVE` status, credit balance, and Amplify eligibility in `us-east-1`. Confirm the committed build passed tests and the `dist` files contain the deployed API URL. Create a ZIP with the **contents** of `dist` at the ZIP root, so `index.html` is at the root. Do not include source, photos, credentials, or `node_modules`.
2. In the [Amplify console](https://console.aws.amazon.com/amplify/) in `us-east-1`, choose **Create new app → Deploy without Git → Next**. Name it `campusfix-ai`, set branch name `production`, choose **Drag and drop**, select the ZIP, and choose **Save and deploy**. This static manual deployment needs no GitHub connection, Amplify build instance, Amplify backend, custom domain, WAF, or SSR service. Record the assigned `https://production.<app-id>.amplifyapp.com` URL and verify that the page loads. [AWS manual deployment steps](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html); [default domain format](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html).
3. Set the existing CloudFormation stack's `AllowedOrigin` from `http://localhost:5173` to that exact HTTPS origin. First create and inspect the change set below. It should alter the HTTP API CORS configuration and Lambda origin configuration in place, with **no** report table replacement, IAM expansion, route change, or artifact change. Execute only the reviewed change set, then wait for `UPDATE_COMPLETE`. This is a backend configuration update and needs the hosting-plan approval.
4. From the hosted browser, check **Connected demo**, report loading, refresh, loading/error feedback, pagination when a next cursor exists, disabled status editing, and responsive desktop/mobile layout. Inspect `OPTIONS /reports` and API responses for `Access-Control-Allow-Origin` matching the exact hosted origin. Existing saved reports can verify report-result rendering without another inference. Capture actual desktop, mobile, and report-result screenshots and add them with the public URL to the README after verification. Do not submit a photo as part of this plan without separate authorization.

```sh
CAMPUSFIX_ORIGIN='https://production.<app-id>.amplifyapp.com'
aws --profile campusfix-ai --region us-east-1 cloudformation create-change-set \
  --stack-name campusfix-backend \
  --change-set-name campusfix-amplify-origin \
  --change-set-type UPDATE \
  --template-body file://infra/backend.yaml \
  --capabilities CAPABILITY_IAM \
  --parameters \
    ParameterKey=AllowedOrigin,ParameterValue="$CAMPUSFIX_ORIGIN" \
    ParameterKey=ArtifactBucket,UsePreviousValue=true \
    ParameterKey=ArtifactKey,UsePreviousValue=true \
    ParameterKey=DailyInferenceLimit,UsePreviousValue=true
aws --profile campusfix-ai --region us-east-1 cloudformation wait change-set-create-complete \
  --stack-name campusfix-backend --change-set-name campusfix-amplify-origin
aws --profile campusfix-ai --region us-east-1 cloudformation describe-change-set \
  --stack-name campusfix-backend --change-set-name campusfix-amplify-origin \
  --query 'Changes[].ResourceChange.{Action:Action,LogicalResourceId:LogicalResourceId,Replacement:Replacement,Details:Details}'
# Execute only after reviewing the change set and receiving hosting-plan approval.
aws --profile campusfix-ai --region us-east-1 cloudformation execute-change-set \
  --stack-name campusfix-backend --change-set-name campusfix-amplify-origin
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-update-complete \
  --stack-name campusfix-backend
```

API Gateway HTTP API handles browser preflight and CORS for the configured origin. [CORS does not authenticate callers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html); the API and saved reports remain public. Replacing the single allowed origin removes localhost connected-browser access unless a later CORS change is reviewed.

## Resources, credits, and Free Plan

The only new AWS resource in this proposal is **one Amplify Hosting app** with its `production` branch and default `amplifyapp.com` HTTPS address. The CORS step updates the existing `campusfix-backend` CloudFormation stack; it should create no new backend resource. Manual upload uses no Amplify build minutes. For a planning month of 0.05 GB CDN storage and 1 GB transfer, [Amplify's published rates](https://aws.amazon.com/amplify/pricing/) imply **$0.15115** of metered hosting usage before allowances (0.05 × $0.023 + 1 × $0.15). Eligible monthly allowances are 5 GB stored and 15 GB transfer, so this scenario would use **$0 in Amplify Hosting credits** while those allowances apply. More traffic, stored deployments, or ineligible usage can consume credits; this is not a cap.

[AWS lists Amplify as eligible for new-customer Free Tier credits](https://aws.amazon.com/amplify/pricing/). The account was last verified `FREE` / `ACTIVE` with **$140 remaining** before the October 2 backend test; recheck immediately before app creation. [Free Plan ends when credits or the plan period expire](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html). Existing API Gateway, Lambda, Bedrock, DynamoDB PITR, CloudWatch Logs, and S3 artifact usage are separate from the hosting estimate. No plan upgrade or billing change is proposed.
