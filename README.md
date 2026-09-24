# CampusFix AI

CampusFix AI turns a photo of a campus maintenance issue into a structured, prioritized report. This repository tracks a small AWS Zero to Shipped Hackathon MVP.

## MVP

1. A visitor uploads an image and may enter a location and description.
2. Bedrock analyzes the image and suggests an issue, category, severity, and maintenance action.
3. The application stores the image and report and displays reports in a public dashboard.

AI output is a suggestion for human review, especially for safety-related issues. The app must not claim that a facilities team has received or acted on a report.

## Proposed architecture (verify before deployment)

- Static Vite/vanilla JavaScript frontend on AWS Amplify Hosting.
- One AWS Lambda backend with a Function URL for submission and dashboard reads.
- Amazon S3 for compressed images, Amazon DynamoDB for issue metadata, and Amazon Bedrock Nova Lite for image analysis.
- No login for the judging demo. Before opening AI inference to the public, add request bounds and a practical abuse control; a budget alert and reserved concurrency alone do not cap total spend.

## Project status

Initial repository and decision log. No AWS resources or public application have been created yet. The frontend, backend, and deployment instructions will be added in small, tested commits.

## Development and submission evidence

See [docs/progress.md](docs/progress.md) for decisions, test results, AWS usage, coding-agent evidence, screenshots to capture, and deployment notes. Do not commit credentials or account identifiers.

## Category and lane

Proposed: `#workplace-efficiency` and `#community`. Campus maintenance triage fits workplace workflows; the Social Good category has narrower focus areas.
