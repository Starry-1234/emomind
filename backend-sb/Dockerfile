# syntax=docker/dockerfile:1

# ---- Stage 1: build ----
# Use a full JDK with Maven to compile the Spring Boot fat jar. This stage
# is the only one that needs the JDK; the final image uses a slim JRE.
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /src

# Copy pom first so dependency resolution is cached separately from sources
COPY backend-sb/pom.xml ./pom.xml
RUN mvn -B -q -DskipTests dependency:go-offline

# Copy sources and build the fat jar
COPY backend-sb/src ./src
RUN mvn -B -q -DskipTests package \
    && cp target/emomind-backend-1.0.0-SNAPSHOT.jar /app.jar

# ---- Stage 2: runtime ----
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the fat jar from the build stage
COPY --from=build /app.jar ./app.jar

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/utils/health-check/ || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
