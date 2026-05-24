#! /usr/bin/env bash

set -e
set -x

# Run Spring Boot backend tests
cd backend-sb
./mvnw test "$@"
