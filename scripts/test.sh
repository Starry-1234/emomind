#! /usr/bin/env bash

# Run Spring Boot backend tests for the emomind-lg branch.
#
# Pre-conditions:
#   - `pgvector-test` container must be running on localhost:55432 (used by
#     V4MigrationTest). This script auto-starts it if missing — see
#     backend-sb/src/test/java/com/emomind/migration/V4MigrationTest.java for
#     why Testcontainers cannot manage it directly on this Windows host.
set -e
set -x

if ! docker ps --format '{{.Names}}' | grep -q '^pgvector-test$'; then
  echo ">>> pgvector-test container not running — starting it"
  if ! docker ps -a --format '{{.Names}}' | grep -q '^pgvector-test$'; then
    docker run -d --name pgvector-test -p 55432:5432 \
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=emomind_test pgvector/pgvector:pg17
  else
    docker start pgvector-test
  fi
fi

cd backend-sb
mvn test "$@"
