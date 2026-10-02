# Backend architecture and operations

This guide covers the deployed API, its configuration, code updates, cost controls, and cleanup. See the [progress log](progress.md) for development history and the [Amplify guide](amplify-hosting-plan.md) for frontend deployment and CORS updates. The commands here are instructions, not a record of actions taken during this documentation change.

## Deployed resources and configuration

The backend is the `campusfix-backend` CloudFormation stack in `us-east-1`, defined by [infra/backend.yaml](../infra/backend.yaml). It uses:

| Service | Implemented role |
| --- | --- |
| API Gateway HTTP API | Public `POST /reports` and `GET /reports`, exact hosted-origin CORS, and stage throttling at one request per second with burst two. |
| Node.js 22 Lambda | Validates requests and images, checks duplicate fingerprints and daily quota, calls Nova Lite, validates output, scores, and saves reports. Configuration: 256 MiB, 25-second timeout, shared account concurrency without a reserved-concurrency setting. |
| Bedrock Nova Lite | One image analysis attempt for each new validated submission that passes duplicate and quota checks; the SDK has `maxAttempts: 1` and an 18-second abort signal. |
| DynamoDB | On-demand report table with a newest-ready-report index, temporary processing and quota items, TTL for temporary items, default AWS owned encryption, and point-in-time recovery. The table has `Retain` policies. |
| IAM and CloudWatch Logs | A Lambda role scoped to required table operations, one model, and logs; sanitized diagnostics in a log group with seven-day retention. |
| S3 artifact stack | Private SSE-S3 bucket for Lambda ZIPs with a seven-day object lifecycle. [infra/artifact-bucket.yaml](../infra/artifact-bucket.yaml) defines it. Submitted photos are never stored there. |

The API base URL is `https://mkebx3gwm5.execute-api.us-east-1.amazonaws.com`. The frontend is hosted at [CampusFix AI](https://production.d3gggdwgsp652a.amplifyapp.com/). The backend `AllowedOrigin` is that exact HTTPS origin. CORS limits cooperative browsers; it does not authenticate callers. The API and stored locations and notes are public. Connected mode has no status-update route or anonymous status editor.

| Stack parameter | Deployed setting | Purpose |
| --- | --- | --- |
| `AllowedOrigin` | `https://production.d3gggdwgsp652a.amplifyapp.com` | Exact browser origin allowed by API Gateway and Lambda responses. |
| `ArtifactBucket` | Output of the `campusfix-artifacts` stack | S3 bucket for deployment code only. |
| `ArtifactKey` | Existing deployed ZIP key | Lambda code object; change only for a reviewed code update. |
| `DailyInferenceLimit` | `20` | Maximum new inference attempts per UTC day, not a billing cap. |

## Request and report behavior

`POST /reports` requires exactly `imageBase64`, `mimeType`, `location`, and `notes`. The image must be JPEG, PNG, or WebP, at most 3 MiB decoded, with a valid signature and detected dimensions no greater than 8,000 pixels per side. Location is required and trimmed to at most 120 characters; notes may be empty or at most 500 characters. For a new report, photo bytes pass inline to Bedrock and are not retained in DynamoDB, S3, or logs.

The report ID is SHA-256 of decoded image bytes, a NUL separator, and location after trimming, lowercasing, and collapsing whitespace. A conditional DynamoDB write claims a processing marker. A new saved report returns HTTP 201; a ready duplicate returns HTTP 200 before quota increment or model invocation. An active processing match returns HTTP 409. A failed request releases its own marker; an abandoned marker can be reclaimed after a 60-second lease and eventually expires. Notes are excluded from the fingerprint. This is exact byte/location matching, not visual similarity. A crash after model output but before persistence can still lead to another billable attempt on a later submission.

Before saving, the server requires exactly seven model fields: `title`, `category`, `severity`, `hazard`, `recurring`, `description`, and `action`. It accepts harmless surrounding whitespace and enum casing differences, but rejects missing or extra fields, unknown categories or severity values, wrong boolean types, and empty or overlong text. Failure diagnostics log fixed phase and reason codes, never photo data, notes, prompts, or model response text. The score uses Low / Medium / High = 25 / 50 / 70, hazard +15, recurrence +5, capped at 100; current inputs yield 25–90. Saved reports start at `Open`.

`GET /reports` returns up to 50 newest ready reports and an opaque `nextCursor` for the next page. An invalid request returns HTTP 400, the daily limit returns HTTP 429, and an analysis or persistence failure returns HTTP 502. There is no status-update API. Saved report text persists across browser refreshes.

## Deployment and configuration

The repository root has `npm test`; backend dependencies are installed under `backend/`. The Lambda ZIP must contain `handler.js`, `scoring.js`, `package.json`, and production `node_modules` at its root. The stack sets Lambda `TABLE_NAME` from the report table, `MODEL_ID` to `amazon.nova-lite-v1:0`, `ALLOWED_ORIGIN` from the parameter above, and `DAILY_INFERENCE_LIMIT` from the configured limit. Use an AWS profile for credentials; the frontend API URL in [`.env.production`](../.env.production) is public configuration.

For an **existing backend code update**, build a new ZIP under a unique S3 key and change only `ArtifactKey`. These are example commands from the repository root; choose a new ZIP name and key, inspect the archive and change set, and confirm the Free Plan and credits before any update:

```sh
npm --prefix backend ci --omit=dev
npm test
cd backend
zip -q -r /private/tmp/campusfix-backend-reviewed.zip handler.js scoring.js package.json node_modules
cd ..
CAMPUSFIX_BUCKET=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-artifacts --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketName`].OutputValue | [0]' --output text)
CAMPUSFIX_KEY='backend/campusfix-backend-reviewed-UNIQUE.zip'
aws --profile campusfix-ai --region us-east-1 s3 cp /private/tmp/campusfix-backend-reviewed.zip "s3://$CAMPUSFIX_BUCKET/$CAMPUSFIX_KEY"
aws --profile campusfix-ai --region us-east-1 cloudformation create-change-set --stack-name campusfix-backend --change-set-name campusfix-code-review-UNIQUE --change-set-type UPDATE --template-body file://infra/backend.yaml --capabilities CAPABILITY_IAM --parameters ParameterKey=AllowedOrigin,UsePreviousValue=true ParameterKey=ArtifactBucket,UsePreviousValue=true ParameterKey=ArtifactKey,ParameterValue="$CAMPUSFIX_KEY" ParameterKey=DailyInferenceLimit,UsePreviousValue=true
aws --profile campusfix-ai --region us-east-1 cloudformation wait change-set-create-complete --stack-name campusfix-backend --change-set-name campusfix-code-review-UNIQUE
aws --profile campusfix-ai --region us-east-1 cloudformation describe-change-set --stack-name campusfix-backend --change-set-name campusfix-code-review-UNIQUE --query 'Changes[].ResourceChange.{Action:Action,LogicalResourceId:LogicalResourceId,Replacement:Replacement,Details:Details}'
# Execute only after verifying no table replacement, IAM expansion, or unrelated change.
aws --profile campusfix-ai --region us-east-1 cloudformation execute-change-set --stack-name campusfix-backend --change-set-name campusfix-code-review-UNIQUE
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-update-complete --stack-name campusfix-backend
```

For a new environment, deploy [the artifact stack](../infra/artifact-bucket.yaml), upload a ZIP, then deploy [the backend stack](../infra/backend.yaml) with `AllowedOrigin`, `ArtifactBucket`, `ArtifactKey`, and `DailyInferenceLimit` set explicitly. The deployed stack's `ArtifactKey` must reference an object that still exists when Lambda code is updated; the artifact bucket expires objects after seven days. The [hosting guide](amplify-hosting-plan.md) gives the corresponding static frontend and CORS procedure.

## Cost assumptions and limits

The handler allows at most 20 inference attempts per UTC day and increments that counter before the model call; failed analyses count. The API stage throttle, 3 MiB image limit, one Bedrock SDK attempt, duplicate reuse, and the existing billing alert reduce expected use but are **not spending caps**. The Lambda function has no reserved-concurrency limit. DynamoDB point-in-time recovery, public API calls, Lambda, Bedrock, logs, S3, and Amplify can all consume eligible credits or incur charges depending on plan and usage.

A planning workload is 20 unique photos of about 1 MiB each, around 1,500 input tokens and 200 output tokens per analysis, five seconds of Lambda time at 256 MiB, 20 list calls, small report text, and seven days of minimal logs and code artifacts. Image token use and actual Bedrock billing for the verified example were not measured, so these assumptions are not a cost guarantee. Recheck [Bedrock](https://aws.amazon.com/bedrock/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [Lambda](https://aws.amazon.com/lambda/pricing/), [DynamoDB](https://aws.amazon.com/dynamodb/pricing/), [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/), and [S3](https://aws.amazon.com/s3/pricing/) prices before projecting a larger workload.

## Destructive cleanup — documentation only

**These commands are destructive and were not executed.** Deleting the Amplify app stops the public site. Deleting the backend stack removes the API and Lambda but **retains the DynamoDB table** under its `Retain` policy. **The `dynamodb delete-table` command permanently deletes stored reports and the table's recovery history.** Emptying the artifact bucket removes deployment packages. Confirm the account, stack outputs, table contents, and data-retention decision before any cleanup.

```sh
aws --profile campusfix-ai --region us-east-1 amplify delete-app --app-id d3gggdwgsp652a
CAMPUSFIX_TABLE=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-backend --query 'Stacks[0].Outputs[?OutputKey==`ReportsTableName`].OutputValue | [0]' --output text)
CAMPUSFIX_BUCKET=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-artifacts --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketName`].OutputValue | [0]' --output text)
aws --profile campusfix-ai --region us-east-1 cloudformation delete-stack --stack-name campusfix-backend
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-delete-complete --stack-name campusfix-backend
# PERMANENTLY DELETES STORED REPORTS AND RECOVERY HISTORY; omit unless disposal is intended.
aws --profile campusfix-ai --region us-east-1 dynamodb delete-table --table-name "$CAMPUSFIX_TABLE"
aws --profile campusfix-ai --region us-east-1 dynamodb wait table-not-exists --table-name "$CAMPUSFIX_TABLE"
aws --profile campusfix-ai --region us-east-1 s3 rm "s3://$CAMPUSFIX_BUCKET" --recursive
aws --profile campusfix-ai --region us-east-1 cloudformation delete-stack --stack-name campusfix-artifacts
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-delete-complete --stack-name campusfix-artifacts
```
