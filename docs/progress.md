# CampusFix AI development progress

Milestones in the coding agent’s work. See the [README](../README.md) for product behavior, the [backend guide](backend.md) for operations, and the [hosting guide](amplify-hosting-plan.md) for deployment.

## MVP and frontend

The agent built a responsive dark cyan/violet reporting interface with photo preview, location and notes fields, an attention score explanation, and a sortable dashboard. The first version used clearly labeled local sample scenarios; it did not analyze photos or save reports across refreshes. Demo logic was checked with local tests, a Vite build, and browser inspection.

## AWS Agent Toolkit connection

The agent established a read-only AWS Agent Toolkit connection and checked the model catalog. Separate CLI profile checks confirmed the intended Free Plan account before deployment. The catalog check showed Nova Lite availability but could not prove inference access. Sanitized [connection](screenshots/aws-mcp-connected.png) and [identity-check](screenshots/aws-mcp-identity-check.png) images preserve the evidence without account identifiers.

## Backend implementation and deployment

The agent implemented CloudFormation, API Gateway, Lambda validation and duplicate handling, Bedrock analysis, deterministic scoring, and DynamoDB report storage. The deployed table uses default DynamoDB encryption and point-in-time recovery; Lambda uses shared concurrency. Stack completion, API responses, and mocked validation, quota, duplicate, and pagination tests were verified.

## Deployment and model-output repairs

Early stack attempts exposed an encryption-key validation problem and a reserved-concurrency limit. The agent adjusted the template and deployed the backend. Four controlled photo attempts then failed. Sanitized diagnostics identified JSON parsing and schema-value failures without logging photo data, notes, or model text. The agent tightened the seven-field prompt and validator, added fixed reason codes, and verified the changes with focused mocked tests.

## Live inference and duplicate verification

A later controlled, nonprivate sidewalk photo produced a validated report and deterministic score. The agent checked API retrieval and DynamoDB storage without photo bytes. An identical duplicate returned the same report without another inference attempt. This verifies one live example after earlier failures; it does not establish a general model success rate.

## Public hosting and final checks

The agent built the connected site, manually deployed it to [Amplify Hosting](https://production.d3gggdwgsp652a.amplifyapp.com/), and updated CORS through an inspected in-place change set. A wording audit separated connected analysis from the local demo. Browser checks confirmed saved-report loading, no connected status editor, and usable desktop and mobile layouts; authentic [desktop](screenshots/campusfix-desktop.png), [mobile](screenshots/campusfix-mobile.png), and [report-result](screenshots/campusfix-report-result.png) screenshots are retained. The Builder Center entry has not been published.
