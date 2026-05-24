#! /usr/bin/env bash

set -e
set -x

# Fetch OpenAPI schema from Spring Boot backend
curl -s http://localhost:8080/v3/api-docs > frontend/openapi.json

cd frontend
bun run generate-client
cd ..
bun run lint
