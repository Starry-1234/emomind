# syntax=docker/dockerfile:1

# Build stage
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Copy pom.xml first for dependency caching
COPY backend-sb/pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY backend-sb/src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built JAR from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/utils/health-check/ || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
