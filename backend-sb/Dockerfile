# syntax=docker/dockerfile:1

# Build stage - copy pre-built JAR from host
FROM eclipse-temurin:17-jre-alpine AS builder

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy pre-built JAR
COPY backend-sb/target/emomind-backend-1.0.0-SNAPSHOT.jar app.jar

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/utils/health-check/ || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
