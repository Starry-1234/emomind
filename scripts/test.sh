#! /usr/bin/env bash

# Run Spring Boot backend tests for the emomind-lg branch.
#
# Pre-conditions:
#   - `pgvector-test` container must be running on localhost:25432 (used by
#     V4MigrationTest, ConversationMetaTest, ConversationMetaControllerTest).
#     This script auto-starts it if missing.
#
# Note on port: 25432 instead of 55432. Some Windows + Docker Desktop
# configurations forbid binding certain low-numbered ports in the host's
# NAT (e.g. 55432 returns "An attempt was made to access a socket in a way
# forbidden by its access permissions"). 25432 binds cleanly on this host.
# See backend-sb/src/test/java/com/emomind/migration/V4MigrationTest.java.
set -e
set -x

if ! docker ps --format '{{.Names}}' | grep -q '^pgvector-test$'; then
  echo ">>> pgvector-test container not running — starting it"
  if ! docker ps -a --format '{{.Names}}' | grep -q '^pgvector-test$'; then
    docker run -d --name pgvector-test -p 25432:5432 \
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=emomind_test pgvector/pgvector:pg17
  else
    docker start pgvector-test
  fi
fi

cd backend-sb
mvn test "$@"
