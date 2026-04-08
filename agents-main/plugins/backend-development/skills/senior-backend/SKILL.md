---
name: senior-backend
description: Comprehensive backend development skill for building scalable backend systems using NodeJS, Express, Go, Python, Postgres, GraphQL, REST APIs. Includes API scaffolding, database optimization, security implementation, and performance tuning. Use when designing APIs, optimizing database queries, implementing business logic, handling authentication/authorization, or reviewing backend code.
---

# Senior Backend

Complete toolkit for senior backend with modern tools and best practices. Kaynak: [claude-code-templates](https://github.com/davila7/claude-code-templates) (senior-backend skill).

## Quick Start

### Main Capabilities

- **API scaffolding**: Best practices, configurable templates, quality checks.
- **Database migration / optimization**: Deep analysis, performance metrics, recommendations, automated fixes.
- **API load testing**: Custom configurations, production-grade output.

## Core Capabilities

### 1. API Scaffolding

- Automated scaffolding with best practices built-in.
- Configurable templates and quality checks.
- Use consistent resource naming (nouns), HTTP method semantics (GET, POST, PUT, PATCH, DELETE), and clear URL hierarchies.

### 2. Database Optimization

- Analyze queries, indexes, and schema; measure before optimizing.
- Use appropriate caching and optimize critical paths.
- Prefer parameterized queries; avoid N+1; document migration decisions.

### 3. API Load Testing

- Define realistic workloads and thresholds.
- Integrate with CI where appropriate; produce actionable reports.

## Tech Stack (Bu skill ile uyumlu)

**Languages:** TypeScript, JavaScript, Python, Go  
**Backend:** Node.js, Express, GraphQL, REST APIs  
**Database:** PostgreSQL, Prisma, NeonDB, Supabase  
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions  
**Cloud:** AWS, GCP, Azure  

## Development Workflow

1. **Setup**: Install dependencies (`npm install` / `pip install -r requirements.txt`), configure environment (`.env` from `.env.example`).
2. **Quality**: Run linters, tests, and optional analyzers before committing.
3. **Implement**: Follow API design patterns, database optimization guides, and backend security practices.

## Best Practices Summary

### Code Quality

- Follow established patterns; write comprehensive tests; document decisions; review regularly.

### Performance

- Measure before optimizing; use appropriate caching; optimize critical paths; monitor in production.

### Security

- Validate all inputs; use parameterized queries; implement proper authentication/authorization; keep dependencies updated.

### Maintainability

- Write clear code; use consistent naming; add helpful comments; keep it simple.

## Common Commands

```bash
# Development
npm run dev
npm run build
npm run test
npm run lint

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

## Referanslar (isteğe bağlı)

Tam referans dokümanları ve script’ler (api_scaffolder, database_migration_tool, api_load_tester) için: [claude-code-templates / senior-backend](https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/skills/development/senior-backend).
