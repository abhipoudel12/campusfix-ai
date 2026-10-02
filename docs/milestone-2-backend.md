# Milestone 2 backend preparation

Prepared locally on 2026-10-01. The artifact stack remains deployed. Two initial backend attempts rolled back; after the approved empty-table cleanup and concurrency repair, the backend deployed successfully on 2026-10-02. Four controlled photo submissions returned HTTP 502. A later reviewed prompt/validator update passed one controlled real-photo submission: all seven analysis fields, deterministic score 85, persisted report, and identical duplicate with no counter increase were verified. The October 2 UTC counter remains at 5. One successful test does not establish broader model reliability or actual Bedrock billing. The frontend is now [hosted on Amplify](amplify-hosting-plan.md); the deployment preparation and failure notes below are historical. See the [latest checkpoint](progress.md#2026-10-02--public-amplify-deployment-cors-update-and-interface-audit).

## Read-only AWS verification

The previously approved, sanitized AWS MCP script called STS `GetCallerIdentity`, Free Tier `GetAccountPlanState`, and Bedrock `ListFoundationModels` for `us-east-1`. It returned only a success flag, plan fields, credit balance, and image-capable model metadata. Identity check succeeded; the account reported `FREE` / `ACTIVE`, a positive credit balance, and expiration `2027-03-24T20:44:03Z`. The catalog lists `amazon.nova-lite-v1:0` as active, image-input/text-output, and `ON_DEMAND`. Listing a model does **not** confirm inference access. The MCP response did not independently prove selection of the local `campusfix-ai` profile. No model was invoked.

[AWS Free plan documentation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) describes plan expiration and activities that automatically upgrade an account. The proposed resources are listed for the Free plan experience in [AWS's supported-services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html). Recheck the plan, credits, and service eligibility before approving deployment. The existing $5 monthly budget sends alerts; it does not cap charges.

## Architecture and complete resource list

The [artifact template](../infra/artifact-bucket.yaml) creates a separate stack with an S3 bucket and bucket policy. The bucket holds a temporary Lambda ZIP only. It blocks public access, uses SSE-S3, denies non-TLS requests, and expires objects after seven days. It never holds submitted images. The ZIP is required because the backend stack's `AWS::Lambda::Function` references an existing S3 object during creation.

The [backend template](../infra/backend.yaml) creates:

| Resource | Purpose |
| --- | --- |
| DynamoDB table and `state-createdAt` GSI | Report text, short processing locks, and daily inference-attempt counters; on-demand billing, default AWS owned encryption, TTL, and point-in-time recovery (PITR). The table has `Retain` on deletion. |
| IAM Lambda execution role with inline policy | Table operations, `bedrock:InvokeModel` for only `amazon.nova-lite-v1:0` in this region, and writes to the Lambda log group. |
| CloudWatch log group | Lambda logs, seven-day retention. |
| Node.js 22 Lambda | `handler.handler`, 256 MiB, 25-second timeout; uses the account's unreserved concurrency pool. |
| API Gateway HTTP API | Public API with exact-origin browser CORS. |
| API integration, two routes, and `$default` stage | `POST /reports` and `GET /reports`; stage rate one request/second and burst two. Connected-mode status editing is disabled. |
| Lambda invoke permission | Scoped to this API's report routes. |

The ZIP has `handler.js`, `scoring.js`, `package.json` with `type: module`, and production `node_modules` at its root. The JavaScript AWS SDK v3 dependencies are bundled in the ZIP. Lambda gets region-scoped credentials from its role; the frontend receives only the API URL. The `Converse` call uses Nova Lite in-region and one image. Its [model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html) documents image input and Converse support. Nova Lite does not provide native structured output here, so the handler validates the JSON response locally.

## API behavior and boundaries

`POST /reports` accepts only JPEG, PNG, or WebP. The browser and Lambda limit decoded images to 3 MiB; Lambda checks MIME type, base64 canonical encoding, file signature, and detected dimensions from 1 to 8,000 pixels on either side. Bedrock's [Converse message specification](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Message.html) allows these formats, at most 3.75 MB per image and 8,000 × 8,000 pixels. The API Gateway [HTTP API payload limit](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html) is 10 MB; base64 JSON for a 3 MiB image is about 4 MiB. Location and notes are length-checked. Image bytes are passed to Bedrock and then discarded, never saved in DynamoDB or logged. Header validation cannot prove an image is fully decodable; Bedrock can still reject a corrupt file.

A SHA-256 digest of image bytes plus normalized location is the report ID. A conditional DynamoDB write claims an in-progress lock. Repeated bytes at the same normalized location return the saved report without inference, or HTTP 409 while processing. A failed request conditionally deletes its own lock. If Lambda stops before cleanup, the 60-second lease can be reclaimed with a conditional update; TTL eventually removes an abandoned lock after roughly one hour. Different image bytes or locations create a new submission. A later retry after a model response but before report persistence may cause another billable inference. The lease and daily attempt counter limit that risk; they cannot guarantee exactly-once billing.

The Bedrock client has `maxAttempts: 1` and each send has an 18-second abort signal. Lambda times out at 25 seconds, below the [HTTP API 30-second integration limit](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html), leaving time for DynamoDB cleanup. The DynamoDB client retains SDK retries; a retry of a conditional write may fail safely. The daily DynamoDB counter increments before each attempted model call and permits at most 20 attempts per UTC day. It counts failed analyses and reclaimed locks. It does not count an SDK retry because Bedrock retries are disabled. A timed-out or aborted Bedrock request can still incur model usage.

The model must return exactly `title`, `category`, `severity`, `hazard`, `recurring`, `description`, and `action`, with bounded strings and allowed enum values. The server computes the deterministic Campus Attention Score: Low/Medium/High = 25/50/70, hazard +15, recurring +5, capped at 100. Model classifications remain suggestions. `GET /reports` returns up to 50 newest ready reports and an opaque `nextCursor`; the frontend offers “Load more reports.” Sorting and filtering in the browser apply to loaded pages. Saved reports begin with Open status. Connected mode displays status badges but has no status-update endpoint or controls. Local demo status controls remain.

**Both deployed endpoints are anonymous and public.** Anyone who knows the API URL could submit a photo and read every saved report including location and notes. Anonymous status changes are disabled. CORS restricts cooperative browsers by origin; it does not authenticate callers. Do not submit personal or private photos, names, or notes. Authentication and authorization are required before a wider deployment. Stage throttling, the account's Lambda concurrency limit, and the daily counter are practical demo controls, **not hard spending caps**. The function has no separate concurrency cap with the current account quota. Public callers could still generate API, Lambda, DynamoDB, and log usage. The existing $5 budget is an alert only.

The frontend defaults to the approved local demo with sample scenarios and status controls. Setting `VITE_API_URL` for a build enables connected mode. The dark cyan/violet design, logo, photo preview, sorting, and filtering remain; connected-mode status controls are hidden.

## Current cost basis and estimate

AWS's [public Bedrock price-list file for `us-east-1`](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/us-east-1/index.json), published `2026-09-30T23:02:55Z`, lists Nova Lite on-demand input at **$0.000060 per 1,000 tokens** and output at **$0.000240 per 1,000 tokens** (equivalently $0.06 and $0.24 per million). This is current AWS pricing data, rather than the older indicative blog rate. The [Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/) describes the modality and tier rules. The template uses standard on-demand in-region inference, no provisioned throughput.

Planning scenario: 20 unique photos of about 1 MiB each, 1,500 billed input tokens per image and prompt, 200 output tokens, 20 list calls, 5 seconds of Lambda time per submission at 256 MiB, less than 1 MiB of stored report data, minimal logs, and one small ZIP held up to seven days. Bedrock estimate: `20 × (1,500 × $0.06/1,000,000 + 200 × $0.24/1,000,000) = $0.00276`. Image token count must be measured from real responses; the 1,500-token assumption is unverified. The handler allows up to 350 output tokens, so actual output could be higher.

[HTTP API pricing](https://aws.amazon.com/api-gateway/pricing/) meters calls in 512 KiB increments: 20 approximately 1.33 MiB JSON uploads are about 60 billable request units, plus 20 small list calls. At the listed $1 per million HTTP API calls, this is about $0.00008 before eligible free usage. [Lambda pricing](https://aws.amazon.com/lambda/pricing/) includes a monthly free tier of one million requests and 400,000 GB-seconds; these submissions use about 25 GB-seconds. [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/) covers on-demand reads/writes and storage; PITR is additionally billed by table size (the page's US example uses $0.20/GB-month). [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/) logs and [S3](https://aws.amazon.com/s3/pricing/) storage/requests also have usage pricing. For the stated tiny workload, a planning allowance of **less than $0.05 metered usage** is reasonable, excluding unrelated account usage, heavy public traffic, additional inference after a crash, and taxes. This is not a spending guarantee. Active Free plan credits may cover eligible usage, but zero out-of-pocket spending cannot be guaranteed by a budget alert or this design.

## Reviewed deployment commands (do not rerun after rollback without review)

The artifact stack, ZIP upload, and backend deployment command were run under the user's controlled deployment approval. The backend failed and rolled back; **do not rerun this sequence without resolving and reviewing the KMS failure**. The commands below are the reviewed procedure from the repository root, with the localhost frontend origin used in the attempt. A model invocation requires separate approval.

```sh
npm test
npm run build
npm --prefix backend ci --omit=dev
cd backend && zip -q -r /private/tmp/campusfix-backend.zip handler.js scoring.js package.json node_modules && cd ..
aws --profile campusfix-ai --region us-east-1 cloudformation deploy --stack-name campusfix-artifacts --template-file infra/artifact-bucket.yaml
CAMPUSFIX_BUCKET=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-artifacts --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketName`].OutputValue | [0]' --output text)
aws --profile campusfix-ai --region us-east-1 s3 cp /private/tmp/campusfix-backend.zip "s3://$CAMPUSFIX_BUCKET/backend/campusfix-backend.zip"
aws --profile campusfix-ai --region us-east-1 cloudformation deploy --stack-name campusfix-backend --template-file infra/backend.yaml --capabilities CAPABILITY_IAM --parameter-overrides AllowedOrigin=http://localhost:5173 ArtifactBucket="$CAMPUSFIX_BUCKET" ArtifactKey=backend/campusfix-backend.zip DailyInferenceLimit=20
aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-backend --query 'Stacks[0].Outputs' --output table
```

The connected frontend was later approved and deployed with `VITE_API_URL` set to the backend stack's `ApiUrl`. One controlled live photo and duplicate were approved and tested; further inference needs separate authorization. The same ZIP key can be deleted by the seven-day lifecycle policy; upload a new ZIP before a later Lambda code update.

## Exact cleanup commands for a later, separately approved run

These commands describe cleanup **after a successful backend deployment**. They do not apply verbatim to the current `ROLLBACK_COMPLETE` stack because it has no outputs; use the retained table name recorded in the [latest retry](#focused-backend-retry-2026-10-01) for any separately approved cleanup. Stop using the connected frontend first. Stack deletion intentionally retains report text and PITR charges on the DynamoDB table. The table deletion command below permanently removes that data and requires separate data-disposal approval. Review whether a retained table or other data still needs to be preserved before running it.

```sh
CAMPUSFIX_BUCKET=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-artifacts --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketName`].OutputValue | [0]' --output text)
CAMPUSFIX_TABLE=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-backend --query 'Stacks[0].Outputs[?OutputKey==`ReportsTableName`].OutputValue | [0]' --output text)
aws --profile campusfix-ai --region us-east-1 cloudformation delete-stack --stack-name campusfix-backend
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-delete-complete --stack-name campusfix-backend
aws --profile campusfix-ai --region us-east-1 dynamodb delete-table --table-name "$CAMPUSFIX_TABLE"
aws --profile campusfix-ai --region us-east-1 dynamodb wait table-not-exists --table-name "$CAMPUSFIX_TABLE"
aws --profile campusfix-ai --region us-east-1 s3 rm "s3://$CAMPUSFIX_BUCKET" --recursive
aws --profile campusfix-ai --region us-east-1 cloudformation delete-stack --stack-name campusfix-artifacts
aws --profile campusfix-ai --region us-east-1 cloudformation wait stack-delete-complete --stack-name campusfix-artifacts
```

After cleanup, inspect the CloudFormation stacks, retained table, S3 bucket, API, Lambda, log group, and billing dashboard. No cleanup command has been run.

## Local validation and remaining gates

`cfn-lint 1.57.1` validated both templates for `us-east-1` with no findings. `cfn-guard 3.2.1` checked relevant AWS Guard Rules Registry 1.0.2 rules. Enabling DynamoDB PITR resolved one real compliance finding. The registry S3 TLS rule still fails because it requires an exact `Resource: "*"` statement and boolean `false`; our policy denies non-TLS access to the specific bucket and its objects using AWS's usual string `"false"`. [AWS's S3 TLS policy example](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryptionInTransit.html) uses this same scoped ARN-list/string form, so the secure policy was retained. The registry's API Gateway execution-logging file contains no executable rule; it cannot validate this HTTP API. No API access log is configured. Mocked AWS tests and a frontend build pass; a local ZIP inspection confirms the handler and dependencies at the package root. These local checks do not verify actual model inference permission or runtime image token usage. A paid test request remains unapproved.

## Controlled deployment attempt, 2026-10-01

Before deployment, the connected-mode status controls, backend PATCH handler, API PATCH route, and CORS PATCH method were removed. Local demo status controls remain. The changed backend passed 11 local tests, a Vite build, `cfn-lint`, and applicable Guard checks. CloudFormation's read-only `ValidateTemplate` accepted the backend template and reported `CAPABILITY_IAM`.

A fresh, sanitized read-only check using CLI profile `campusfix-ai` reported identity check succeeded, plan `FREE` / `ACTIVE`, and a positive credit balance. The account plan was not upgraded. The `campusfix-artifacts` stack reached `CREATE_COMPLETE`: its S3 bucket and bucket policy were created. The reviewed 3,437,952-byte Lambda ZIP was uploaded as `backend/campusfix-backend.zip`; S3 metadata reports `AES256` server-side encryption. The bucket name is `campusfix-artifacts-artifactbucket-mg63evlxlg3q`.

The `campusfix-backend` stack failed during DynamoDB table creation and reached `ROLLBACK_COMPLETE`. CloudFormation reported a DynamoDB KMS validation `NotFoundException` for the encryption key. The log group creation was cancelled; the API, stage, and log group show `DELETE_COMPLETE`. The table shows `DELETE_SKIPPED` in stack history, but a read-only name-filtered DynamoDB check found no CampusFix table. The artifact stack and ZIP remain. There is **no API URL**, so deployed-API read-only and invalid-input checks could not run. No valid photo was submitted and Bedrock was not invoked. No retry or encryption change was attempted; the key error needs a separate diagnosis and reviewed fix before another deployment attempt.

The earlier preparation-only statements above remain historical where they say a step had not yet run. This section records the first rollback. An S3 artifact bucket can continue to incur small storage/request charges while it remains.

## Focused backend retry, 2026-10-01

Read-only checks reconfirmed the first `campusfix-backend` stack was `ROLLBACK_COMPLETE` and had no report table or data. The first failure event was DynamoDB's KMS validation `NotFoundException`. The template had `SSESpecification: {SSEEnabled: true}`. [AWS's CloudFormation property reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-dynamodb-table-ssespecification.html) says `true` uses an AWS managed KMS key, while an omitted specification uses the AWS owned key. [DynamoDB documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/EncryptionAtRest.html) confirms all tables are encrypted at rest and the AWS owned key is the default with no added KMS charge. This explains why removing the explicit managed-key selection is a compatible, smaller fix; the precise reason the managed key was missing was not established.

The only template behavior change was to omit `SSESpecification`; table metadata now records the intended AWS owned key. No resource type, IAM action, or permission scope changed. `cfn-lint` and read-only CloudFormation `ValidateTemplate` passed. The AWS Guard Rules Registry rule `DYNAMODB_TABLE_MUST_BE_ENCRYPTED` **failed** because it requires `SSESpecification.SSEEnabled == true`; this checks for an explicit AWS managed key rather than DynamoDB's default encryption. Other applicable Guard rules passed. The failure is documented as a rule mismatch, not evidence of unencrypted storage. No suppression was added.

Immediately before retry, a sanitized profile `campusfix-ai` check again reported identity success, `FREE` / `ACTIVE`, and a positive credit balance. The failed stack record was deleted. The backend stack was recreated with the same artifact bucket and ZIP and the same parameters; no frontend or model was invoked.

The retry failed at `ApiFunction` with CloudFormation `HandlerErrorCode: NotUpdatable` and ended `ROLLBACK_COMPLETE`. The exact Lambda-side cause remains unconfirmed. CloudFormation deleted the attempted API, stage, Lambda, role, and log group. The newly created DynamoDB report table was **retained** by its `DeletionPolicy`; it is `ACTIVE`, and a read-only check found PITR `ENABLED`. A read-only count-only scan found **0 items**, so no report data was found. The retained table is `campusfix-backend-ReportsTable-OSQWHS8RN39M`. The artifact bucket and ZIP also remain. **There is no API URL**, so API read-only and invalid-input checks cannot run. The empty table can incur on-demand storage and PITR charges until explicitly removed or reused. No table or data was deleted; no further deployment change was attempted.

The next deployment step requires diagnosing the unexpected Lambda failure and deciding what to do with the retained empty table. A third stack attempt, a Lambda configuration change, or table deletion is outside this retry authorization.

## Read-only Lambda failure diagnosis, 2026-10-01

The full sanitized CloudFormation event is recorded in [progress.md](progress.md#2026-10-01--read-only-lambda-failure-diagnosis). CloudFormation's newer filtered and unfiltered `DescribeEvents` calls returned zero events for this rollback; historical `DescribeStackEvents` returned the failure. CloudTrail provides the specific cause: `PutFunctionConcurrency` rejected `ReservedConcurrentExecutions: 2` with `InvalidParameterValueException` because it would reduce the account's unreserved concurrency below its minimum of 10. `GetAccountSettings` reported 10 total and 10 unreserved executions in `us-east-1`. `CreateFunction` itself succeeded, and CloudFormation deleted that function during rollback. [AWS's Lambda concurrency documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html) explains that reserved capacity is removed from the unreserved pool; [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) note that new accounts can have reduced quotas. The service's error gives the applicable minimum for this account.

The smallest local repair removes the function's `ReservedConcurrentExecutions` property. The Lambda then shares the account's 10 unreserved executions, with API stage throttling and the daily inference-attempt counter still in place. This weakens the per-function concurrency bound; those controls remain usage limits, not a billing cap. The retained table was reconfirmed `ACTIVE`, with zero scanned items and PITR `ENABLED`; the existing encrypted Lambda ZIP remains in the artifact bucket. For a fresh stack using the current template, the empty retained table needs a separate handling decision. The simplest retry path is explicit approval to delete that table after another count check, then delete the `ROLLBACK_COMPLETE` stack record and deploy again. Keeping the table requires a more involved import or template change; it must not be silently replaced or abandoned.

## Proposed single-image inference smoke test for separate approval

This earlier 1×1 PNG path check is superseded by the real-photo end-to-end plan in [progress.md](progress.md#2026-10-02--photo-test-prepared-inference-approval-pending) and [photo-e2e-test.py](../scripts/photo-e2e-test.py). It remains unrun.

After an approved backend fix and successful deployment, set `CAMPUSFIX_API_URL` to the backend stack's `ApiUrl`, then run **once**:

```sh
CAMPUSFIX_API_URL=$(aws --profile campusfix-ai --region us-east-1 cloudformation describe-stacks --stack-name campusfix-backend --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue | [0]' --output text)
export CAMPUSFIX_API_URL
python3 scripts/one-image-smoke-test.py
```

The [complete script](../scripts/one-image-smoke-test.py) sends one valid, tiny PNG with the synthetic location “Synthetic Test Campus / Hallway A” and synthetic notes. It makes one `POST /reports` request with no client retry and prints only response status, duplicate flag, report ID, and score. The image is only a path smoke test; it cannot assess classification quality. It was **not run**.

At the current [Nova Lite us-east-1 price](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/us-east-1/index.json), an assumed 1,500 input and 200 output tokens cost `1,500 × $0.06/1,000,000 + 200 × $0.24/1,000,000 = $0.000138` in Bedrock usage. At the handler's 350-output-token limit, the same input assumption yields $0.000174. The tiny image may use a different token count; a timed-out call may still be billed. API, Lambda, DynamoDB, and log usage add a small amount. Plan on **less than $0.01 metered usage for this single test under these assumptions**, without treating it as a hard cap or a guarantee of zero out-of-pocket cost.
