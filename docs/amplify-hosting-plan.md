# Amplify Hosting plan — approval draft (2026-10-02)

## Current gate

The frontend is prepared locally; no Amplify app, branch, domain, or build has been created. The backend API is deployed, but the fourth controlled photo POST returned HTTP 502 with `model_output / invalid_values`; no live report has been saved. Keep hosting deployment pending until that limitation is accepted or the backend is repaired and separately retested.

## Build and behavior

- The repository-root [`amplify.yml`](../amplify.yml) selects Node.js 22, runs `npm ci`, installs backend test dependencies, runs `npm test`, builds Vite, and publishes `dist`. Select Amplify's AL2023 default build image, which supports Node.js 22. The site is static; it does not need an Amplify backend or SSR resources. [Amplify build specification](https://docs.aws.amazon.com/amplify/latest/userguide/yml-specification-syntax.html), [Node.js build image guidance](https://docs.aws.amazon.com/amplify/latest/userguide/troubleshooting-general.html).
- Set branch environment variable `VITE_API_URL=https://mkebx3gwm5.execute-api.us-east-1.amazonaws.com` before the first build. Vite embeds this public URL at build time; it is not a secret. [Amplify environment variables](https://docs.aws.amazon.com/amplify/latest/userguide/setting-env-vars.html).
- With the variable set, the UI explicitly says **Connected demo**, sends the photo to the backend, loads saved reports, exposes refresh and cursor pagination, and disables status editing. Without it, the UI explicitly says **Local demo** and creates in-memory scenario reports without uploading or analyzing the image. The approved dark cyan/violet theme is unchanged.
- A failed HTTP 502 says no report was saved. A lost connection says the submission outcome is unknown and tells the user to check saved reports before another attempt. Neither the API client nor the UI automatically retries a POST.

## Exact hosting sequence for later approval

1. Review and commit the local frontend/backend/docs changes, then push the intended `main` commit to the existing `origin`. These Git writes have **not** been done.
2. In the `us-east-1` [Amplify console](https://console.aws.amazon.com/amplify/), choose **New app → Host web app → GitHub**. Authorize the AWS Amplify GitHub App for only this repository, select `main`, and use repository-root `amplify.yml`. Choose the AL2023 default build image and Standard build instance, no Amplify backend, no custom domain, no WAF, and no SSR. Review the build output directory as `dist`. [GitHub connection steps](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html).
3. Before starting the first build, set `VITE_API_URL` to the API URL above for the `main` branch. Save and deploy. Record the assigned `https://main.<app-id>.amplifyapp.com` URL and build result. The exact app ID is known only after creation. [Default domain format](https://docs.aws.amazon.com/amplify/latest/userguide/multi-environments.html).
4. Update the existing CloudFormation backend stack's **AllowedOrigin** from `http://localhost:5173` to the exact HTTPS Amplify origin. This updates HTTP API CORS and the Lambda response header. Inspect the change set for no table replacement or IAM expansion before executing. Use the commands below after replacing the origin; this is a **backend deployment** and is not authorized by the current request.
5. From the hosted page, verify the connected label, report loading, validation, a separately authorized valid photo submission, failure messages, refresh, pagination when enough reports exist, and the absence of status controls. Check a browser preflight `OPTIONS /reports` and response `Access-Control-Allow-Origin` for the exact Amplify origin. A live photo test is not included in hosting approval unless separately stated.

```sh
CAMPUSFIX_ORIGIN='https://main.<app-id>.amplifyapp.com'
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
  --query 'Changes[].ResourceChange.{Action:Action,LogicalResourceId:LogicalResourceId,Replacement:Replacement}'
# Execute only after reviewing the change set and separately approving the backend update.
aws --profile campusfix-ai --region us-east-1 cloudformation execute-change-set \
  --stack-name campusfix-backend --change-set-name campusfix-amplify-origin
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-update-complete \
  --stack-name campusfix-backend
```

API Gateway's HTTP API CORS configuration supplies browser CORS headers for allowed origins and preflight requests. CORS is not authentication: this API and its saved reports remain public to direct callers. [HTTP API CORS documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html). Switching the single `AllowedOrigin` value to Amplify ends the current localhost browser allowance; local connected browser testing would need a later reviewed CORS change.

## Hosting cost estimate

[Amplify's current hosting price page](https://aws.amazon.com/amplify/pricing/) lists Standard builds at $0.01/minute, CDN storage at $0.023/GB-month, and transfer at $0.15/GB beyond applicable free allowances. It lists monthly free allowances of 1,000 Standard build minutes, 5 GB storage, and 15 GB transfer for eligible use. For one month with 10 build minutes, 0.05 GB stored, and 1 GB transferred, metered usage before allowances is **$0.25115** ($0.10 + $0.00115 + $0.15); under those free allowances it would be **$0 Amplify Hosting charge**. This is a planning scenario, not a cap. The active $140 Free Plan credits and eligibility must be rechecked before creation; API, Lambda, DynamoDB PITR, logs, S3 artifact storage, and any Bedrock inferences are separate charges. No billing or plan setting is changed by this plan.
