# EmoMind Spring Boot MVP 后端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 EmoMind Spring Boot 后端 MVP，实现认证 + 用户管理 + 健康检查核心链路。

**Architecture:** 经典分层架构（Controller → Service → Repository → Entity），Spring Security JWT 认证，PostgreSQL + Flyway 数据管理，严格 TDD 开发。

**Tech Stack:** Java 21, Spring Boot 3.2, Maven, Spring Data JPA, Spring Security, JWT (jjwt), Flyway, PostgreSQL, MapStruct, Lombok

---

## 文件结构总览

```
backend-sb/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/emomind/
│   │   │       ├── EmoMindApplication.java
│   │   │       ├── config/
│   │   │       │   ├── SecurityConfig.java
│   │   │       │   └── WebMvcConfig.java
│   │   │       ├── controller/
│   │   │       │   ├── LoginController.java
│   │   │       │   ├── UserController.java
│   │   │       │   └── UtilsController.java
│   │   │       ├── dto/
│   │   │       │   ├── request/
│   │   │       │   │   ├── LoginRequest.java
│   │   │       │   │   ├── UserRegisterRequest.java
│   │   │       │   │   ├── UserUpdateMeRequest.java
│   │   │       │   │   ├── UserCreateRequest.java
│   │   │       │   │   ├── UserUpdateRequest.java
│   │   │       │   │   ├── UpdatePasswordRequest.java
│   │   │       │   │   └── PasswordResetRequest.java
│   │   │       │   └── response/
│   │   │       │       ├── TokenResponse.java
│   │   │       │       ├── UserResponse.java
│   │   │       │       ├── PageResponse.java
│   │   │       │       └── MessageResponse.java
│   │   │       ├── entity/
│   │   │       │   ├── User.java
│   │   │       │   ├── FileAnalysisReport.java
│   │   │       │   └── TestRecord.java
│   │   │       ├── exception/
│   │   │       │   ├── GlobalExceptionHandler.java
│   │   │       │   ├── ServiceException.java
│   │   │       │   ├── ResourceNotFoundException.java
│   │   │       │   └── UnauthorizedException.java
│   │   │       ├── mapper/
│   │   │       │   └── UserMapper.java
│   │   │       ├── repository/
│   │   │       │   ├── UserRepository.java
│   │   │       │   ├── FileAnalysisReportRepository.java
│   │   │       │   └── TestRecordRepository.java
│   │   │       ├── security/
│   │   │       │   ├── JwtTokenProvider.java
│   │   │       │   ├── JwtAuthenticationFilter.java
│   │   │       │   ├── StreakUpdateFilter.java
│   │   │       │   ├── UserDetailsImpl.java
│   │   │       │   └── UserDetailsServiceImpl.java
│   │   │       └── service/
│   │   │           └── UserService.java
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       └── db/migration/
│   │           ├── V1__init_schema.sql
│   │           └── V2__seed_superuser.sql
│   └── test/
│       └── java/com/emomind/
│           ├── TestEmoMindApplication.java
│           ├── TestcontainersConfiguration.java
│           ├── entity/
│           │   └── UserEntityTest.java
│           ├── repository/
│           │   └── UserRepositoryTest.java
│           ├── security/
│           │   ├── JwtTokenProviderTest.java
│           │   └── SecurityFilterChainTest.java
│           ├── controller/
│           │   ├── LoginControllerTest.java
│           │   └── UserControllerTest.java
│           └── config/
│               └── TestSecurityConfig.java
└── .gitignore
```

---

## Phase 0: 项目脚手架

### Task 0.1: 创建 Maven 项目结构

**Files:**
- Create: `backend-sb/pom.xml`
- Create: `backend-sb/.gitignore`

- [ ] **Step 1: 编写 pom.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                             https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>

    <groupId>com.emomind</groupId>
    <artifactId>emomind-backend</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <name>EmoMind Backend</name>
    <description>EmoMind Psychological Assessment Platform - Spring Boot Backend</description>

    <properties>
        <java.version>21</java.version>
        <jjwt.version>0.12.3</jjwt.version>
        <mapstruct.version>1.5.5.Final</mapstruct.version>
        <lombok-mapstruct-binding.version>0.2.0</lombok-mapstruct-binding.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-mail</artifactId>
        </dependency>

        <!-- Database -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>

        <!-- JWT -->
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>${jjwt.version}</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>

        <!-- MapStruct -->
        <dependency>
            <groupId>org.mapstruct</groupId>
            <artifactId>mapstruct</artifactId>
            <version>${mapstruct.version}</version>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- OpenAPI -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.5.0</version>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>${java.version}</source>
                    <target>${java.version}</target>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                            <version>${lombok.version}</version>
                        </path>
                        <path>
                            <groupId>org.mapstruct</groupId>
                            <artifactId>mapstruct-processor</artifactId>
                            <version>${mapstruct.version}</version>
                        </path>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok-mapstruct-binding</artifactId>
                            <version>${lombok-mapstruct-binding.version}</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 2: 编写 .gitignore**

```
target/
*.class
*.jar
*.war
*.ear
*.logs
*.iml
.idea/
.vscode/
*.swp
*.swo
*~
.DS_Store
.env
application-local.yml
```

- [ ] **Step 3: 验证目录结构**

Run: `cd backend-sb && ls -la`
Expected: `pom.xml` 和 `.gitignore` 存在

---

### Task 0.2: 创建目录结构

- [ ] **Step 1: 创建所有目录**

Run:
```bash
cd backend-sb
mkdir -p src/main/java/com/emomind/{config,controller,dto/{request,response},entity,exception,mapper,repository,security,service}
mkdir -p src/main/resources/db/migration
mkdir -p src/test/java/com/emomind/{entity,repository,security,controller,config}
```

- [ ] **Step 2: 验证目录结构**

Run: `find src -type d | sort`
Expected: 所有目录正确创建

---

### Task 0.3: 配置 application.yml

**Files:**
- Create: `backend-sb/src/main/resources/application.yml`
- Create: `backend-sb/src/main/resources/application-dev.yml`

- [ ] **Step 1: 编写 application.yml**

```yaml
server:
  port: 8080

spring:
  application:
    name: emomind

  datasource:
    url: jdbc:postgresql://${POSTGRES_SERVER:localhost}:${POSTGRES_PORT:5433}/${POSTGRES_DB:emomind}
    username: ${POSTGRES_USER:postgres}
    password: ${POSTGRES_PASSWORD:}
    driver-class-name: org.postgresql.Driver
    hikari:
      minimum-idle: 5
      maximum-pool-size: 20
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000

  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc:
          time_zone: Asia/Shanghai
        format_sql: true
    show-sql: false

  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

  mail:
    host: ${SMTP_HOST:}
    port: ${SMTP_PORT:587}
    username: ${SMTP_USER:}
    password: ${SMTP_PASSWORD:}
    protocol: smtp
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: ${SMTP_TLS:true}

app:
  jwt:
    secret: ${SECRET_KEY:changeme-changeme-changeme-changeme}
    expiration: 691200000
  frontend:
    host: ${FRONTEND_HOST:http://localhost:5174}
  cors:
    origins: ${BACKEND_CORS_ORIGINS:http://localhost:5174}
  first-superuser:
    email: ${FIRST_SUPERUSER:}
    password: ${FIRST_SUPERUSER_PASSWORD:}

springdoc:
  api-docs:
    enabled: true
  swagger-ui:
    enabled: true
```

- [ ] **Step 2: 编写 application-dev.yml**

```yaml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true

logging:
  level:
    com.emomind: DEBUG
    org.springframework.security: DEBUG
```

- [ ] **Step 3: Commit**

```bash
git add backend-sb/
git commit -m "chore: initialize Spring Boot project scaffold with Maven"
```

---

## Phase 1: Database 模块

### Task 1.1: User Entity + 测试

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/entity/User.java`
- Create: `backend-sb/src/test/java/com/emomind/entity/UserEntityTest.java`

- [ ] **Step 1: 编写 User Entity**

```java
package com.emomind.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "hashed_password", nullable = false)
    private String hashedPassword;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "is_superuser", nullable = false)
    @Builder.Default
    private Boolean isSuperuser = false;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "streak_days", nullable = false)
    @Builder.Default
    private Integer streakDays = 0;

    @Column(name = "last_active_date")
    private LocalDateTime lastActiveDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: 编写 User Entity 测试**

```java
package com.emomind.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class UserEntityTest {

    @Test
    void shouldCreateUserWithDefaults() {
        User user = User.builder()
                .email("test@example.com")
                .hashedPassword("hashed123")
                .build();

        assertThat(user.getEmail()).isEqualTo("test@example.com");
        assertThat(user.getHashedPassword()).isEqualTo("hashed123");
        assertThat(user.getIsActive()).isTrue();
        assertThat(user.getIsSuperuser()).isFalse();
        assertThat(user.getStreakDays()).isZero();
        assertThat(user.getCreatedAt()).isNull();
    }

    @Test
    void shouldSetCreatedAtOnPersist() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setHashedPassword("hashed123");
        user.onCreate();

        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(user.getCreatedAt()).isBeforeOrEqualTo(LocalDateTime.now());
    }
}
```

- [ ] **Step 3: 运行测试**

Run: `cd backend-sb && ./mvnw test -Dtest=UserEntityTest -q`
Expected: 2 tests passed

---

### Task 1.2: FileAnalysisReport Entity

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/entity/FileAnalysisReport.java`

- [ ] **Step 1: 编写 FileAnalysisReport Entity**

```java
package com.emomind.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "file_analysis_report")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileAnalysisReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_type", nullable = false, length = 50)
    private String fileType;

    @Column(name = "file_size")
    private Integer fileSize;

    @Column(name = "analysis_result", nullable = false, columnDefinition = "TEXT")
    private String analysisResult;

    @Column(name = "conversation_id")
    private String conversationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

---

### Task 1.3: TestRecord Entity

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/entity/TestRecord.java`

- [ ] **Step 1: 编写 TestRecord Entity**

```java
package com.emomind.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "test_record")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "test_name", nullable = false, length = 255)
    private String testName;

    @Column(name = "user_topic", length = 500)
    private String userTopic;

    @Column(name = "total_score")
    private Integer totalScore;

    @Column(name = "total_max")
    private Integer totalMax;

    @Column(name = "result_description", columnDefinition = "TEXT")
    private String resultDescription;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "questions", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> questions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> answers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "scoring_ranges", columnDefinition = "jsonb")
    private List<Map<String, Object>> scoringRanges;

    @Column(name = "conversation_id")
    private String conversationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

---

### Task 1.4: Repository 接口

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/repository/UserRepository.java`
- Create: `backend-sb/src/main/java/com/emomind/repository/FileAnalysisReportRepository.java`
- Create: `backend-sb/src/main/java/com/emomind/repository/TestRecordRepository.java`

- [ ] **Step 1: 编写 UserRepository**

```java
package com.emomind.repository;

import com.emomind.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

- [ ] **Step 2: 编写 FileAnalysisReportRepository**

```java
package com.emomind.repository;

import com.emomind.entity.FileAnalysisReport;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FileAnalysisReportRepository extends JpaRepository<FileAnalysisReport, UUID> {
    List<FileAnalysisReport> findByOwnerId(UUID ownerId, Pageable pageable);
    long countByOwnerId(UUID ownerId);
}
```

- [ ] **Step 3: 编写 TestRecordRepository**

```java
package com.emomind.repository;

import com.emomind.entity.TestRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TestRecordRepository extends JpaRepository<TestRecord, UUID> {
    List<TestRecord> findByOwnerId(UUID ownerId, Pageable pageable);
    long countByOwnerId(UUID ownerId);
}
```

---

### Task 1.5: Flyway 迁移脚本

**Files:**
- Create: `backend-sb/src/main/resources/db/migration/V1__init_schema.sql`
- Create: `backend-sb/src/main/resources/db/migration/V2__seed_superuser.sql`

- [ ] **Step 1: 编写 V1__init_schema.sql**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_superuser BOOLEAN DEFAULT FALSE NOT NULL,
    full_name VARCHAR(255),
    streak_days INTEGER DEFAULT 0 NOT NULL,
    last_active_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE file_analysis_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    analysis_result TEXT NOT NULL,
    conversation_id VARCHAR,
    created_at TIMESTAMP NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE test_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(255) NOT NULL,
    user_topic VARCHAR(500),
    total_score INTEGER,
    total_max INTEGER,
    result_description TEXT,
    questions JSONB NOT NULL,
    answers JSONB NOT NULL,
    scoring_ranges JSONB,
    conversation_id VARCHAR,
    created_at TIMESTAMP NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_file_analysis_report_owner ON file_analysis_report(owner_id);
CREATE INDEX idx_file_analysis_report_created_at ON file_analysis_report(created_at);
CREATE INDEX idx_test_record_owner ON test_record(owner_id);
CREATE INDEX idx_test_record_created_at ON test_record(created_at);
```

- [ ] **Step 2: 编写 V2__seed_superuser.sql**

```sql
-- 超级用户由应用启动时根据环境变量自动创建
-- 此迁移脚本为空，仅作为版本标记
SELECT 1;
```

- [ ] **Step 3: Commit Database 模块**

```bash
git add backend-sb/src/main/java/com/emomind/entity/
git add backend-sb/src/main/java/com/emomind/repository/
git add backend-sb/src/main/resources/db/migration/
git add backend-sb/src/test/java/com/emomind/entity/
git commit -m "feat(database): add JPA entities, repositories and Flyway migrations"
```

---

## Phase 2: Security 模块

### Task 2.1: 异常类

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/exception/ServiceException.java`
- Create: `backend-sb/src/main/java/com/emomind/exception/ResourceNotFoundException.java`
- Create: `backend-sb/src/main/java/com/emomind/exception/UnauthorizedException.java`

- [ ] **Step 1: 编写 ServiceException**

```java
package com.emomind.exception;

public class ServiceException extends RuntimeException {
    public ServiceException(String message) {
        super(message);
    }
}
```

- [ ] **Step 2: 编写 ResourceNotFoundException**

```java
package com.emomind.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

- [ ] **Step 3: 编写 UnauthorizedException**

```java
package com.emomind.exception;

public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
```

---

### Task 2.2: JwtTokenProvider

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/security/JwtTokenProvider.java`
- Create: `backend-sb/src/test/java/com/emomind/security/JwtTokenProviderTest.java`

- [ ] **Step 1: 编写 JwtTokenProvider 测试**

```java
package com.emomind.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private JwtTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", "test-secret-key-that-is-long-enough-for-hs256");
        ReflectionTestUtils.setField(tokenProvider, "jwtExpiration", 86400000L);
    }

    @Test
    void shouldGenerateValidToken() {
        String userId = "550e8400-e29b-41d4-a716-446655440000";
        String token = tokenProvider.generateToken(userId);

        assertThat(token).isNotBlank();
        assertThat(tokenProvider.validateToken(token)).isTrue();
    }

    @Test
    void shouldExtractUserIdFromToken() {
        String userId = "550e8400-e29b-41d4-a716-446655440000";
        String token = tokenProvider.generateToken(userId);

        String extracted = tokenProvider.getUserIdFromToken(token);
        assertThat(extracted).isEqualTo(userId);
    }

    @Test
    void shouldValidateExpiredToken() throws InterruptedException {
        ReflectionTestUtils.setField(tokenProvider, "jwtExpiration", 1L);
        String token = tokenProvider.generateToken("user-id");
        Thread.sleep(10);

        assertThat(tokenProvider.validateToken(token)).isFalse();
    }

    @Test
    void shouldInvalidateMalformedToken() {
        assertThat(tokenProvider.validateToken("invalid-token")).isFalse();
    }
}
```

- [ ] **Step 2: 编写 JwtTokenProvider 实现**

```java
package com.emomind.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration}")
    private long jwtExpiration;

    public String generateToken(String userId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        return Jwts.builder()
                .subject(userId)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String getUserIdFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("Expired JWT token");
        } catch (UnsupportedJwtException e) {
            log.warn("Unsupported JWT token");
        } catch (MalformedJwtException e) {
            log.warn("Malformed JWT token");
        } catch (SecurityException e) {
            log.warn("Invalid JWT signature");
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims string is empty");
        }
        return false;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
}
```

- [ ] **Step 3: 运行测试**

Run: `cd backend-sb && ./mvnw test -Dtest=JwtTokenProviderTest -q`
Expected: 4 tests passed

---

### Task 2.3: UserDetailsImpl + UserDetailsServiceImpl

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/security/UserDetailsImpl.java`
- Create: `backend-sb/src/main/java/com/emomind/security/UserDetailsServiceImpl.java`

- [ ] **Step 1: 编写 UserDetailsImpl**

```java
package com.emomind.security;

import com.emomind.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

@Data
@AllArgsConstructor
public class UserDetailsImpl implements UserDetails {

    private UUID id;
    private String email;
    private Boolean isSuperuser;

    @JsonIgnore
    private String password;

    private Collection<? extends GrantedAuthority> authorities;

    public static UserDetailsImpl build(User user) {
        String role = Boolean.TRUE.equals(user.getIsSuperuser()) ? "ADMIN" : "USER";
        return new UserDetailsImpl(
                user.getId(),
                user.getEmail(),
                user.getIsSuperuser(),
                user.getHashedPassword(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
```

- [ ] **Step 2: 编写 UserDetailsServiceImpl**

```java
package com.emomind.security;

import com.emomind.entity.User;
import com.emomind.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        User user;
        try {
            UUID id = UUID.fromString(identifier);
            user = userRepository.findById(id)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + identifier));
        } catch (IllegalArgumentException e) {
            user = userRepository.findByEmail(identifier)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + identifier));
        }
        return UserDetailsImpl.build(user);
    }
}
```

---

### Task 2.4: JwtAuthenticationFilter

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/security/JwtAuthenticationFilter.java`

- [ ] **Step 1: 编写 JwtAuthenticationFilter**

```java
package com.emomind.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);
            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                String userId = tokenProvider.getUserIdFromToken(jwt);
                UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage());
        }
        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
```

---

### Task 2.5: StreakUpdateFilter

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/security/StreakUpdateFilter.java`

- [ ] **Step 1: 编写 StreakUpdateFilter**

```java
package com.emomind.security;

import com.emomind.service.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class StreakUpdateFilter extends OncePerRequestFilter {

    private final UserService userService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl userDetails) {
            try {
                userService.updateStreakIfNeeded(userDetails.getId());
            } catch (Exception e) {
                log.debug("Failed to update streak: {}", e.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }
}
```

---

### Task 2.6: SecurityConfig

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/config/SecurityConfig.java`

- [ ] **Step 1: 编写 SecurityConfig**

```java
package com.emomind.config;

import com.emomind.security.JwtAuthenticationFilter;
import com.emomind.security.StreakUpdateFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    @Value("${app.cors.origins:http://localhost:5174}")
    private String corsOrigins;

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final StreakUpdateFilter streakUpdateFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/login/access-token").permitAll()
                        .requestMatchers("/api/v1/login/test-token").authenticated()
                        .requestMatchers("/api/v1/password-recovery/**").permitAll()
                        .requestMatchers("/api/v1/reset-password/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/users/signup").permitAll()
                        .requestMatchers("/api/v1/utils/health-check/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(streakUpdateFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return new ProviderManager(provider);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        Map<String, PasswordEncoder> encoders = new HashMap<>();
        encoders.put("bcrypt", new BCryptPasswordEncoder(10));
        encoders.put("argon2", org.springframework.security.crypto.argon2.Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8());
        return new DelegatingPasswordEncoder("bcrypt", encoders);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.asList(corsOrigins.split(","));
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
```

---

### Task 2.7: GlobalExceptionHandler

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/exception/GlobalExceptionHandler.java`

- [ ] **Step 1: 编写 GlobalExceptionHandler**

```java
package com.emomind.exception;

import com.emomind.dto.response.MessageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ServiceException.class)
    public ResponseEntity<MessageResponse> handleServiceException(ServiceException e) {
        return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<MessageResponse> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse(e.getMessage()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<MessageResponse> handleUnauthorized(UnauthorizedException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<MessageResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new MessageResponse("Not enough permissions"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException e) {
        List<Map<String, Object>> errors = e.getBindingResult().getFieldErrors().stream()
                .map(this::mapFieldError)
                .collect(Collectors.toList());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("detail", errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MessageResponse> handleException(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Internal server error"));
    }

    private Map<String, Object> mapFieldError(FieldError error) {
        Map<String, Object> map = new HashMap<>();
        map.put("loc", Arrays.asList("body", error.getField()));
        map.put("msg", error.getDefaultMessage());
        map.put("type", "value_error");
        return map;
    }
}
```

- [ ] **Step 2: Commit Security 模块**

```bash
git add backend-sb/src/main/java/com/emomind/security/
git add backend-sb/src/main/java/com/emomind/exception/
git add backend-sb/src/main/java/com/emomind/config/SecurityConfig.java
git add backend-sb/src/test/java/com/emomind/security/
git commit -m "feat(security): add JWT authentication, filters and exception handling"
```

---

## Phase 3: Auth 模块

### Task 3.1: DTO 类

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/dto/response/TokenResponse.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/response/UserResponse.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/response/PageResponse.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/response/MessageResponse.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/LoginRequest.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/UserRegisterRequest.java`

- [ ] **Step 1: 编写 TokenResponse**

```java
package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenResponse {
    private String accessToken;
    private String tokenType;
}
```

- [ ] **Step 2: 编写 UserResponse**

```java
package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private UUID id;
    private String email;
    private Boolean isActive;
    private Boolean isSuperuser;
    private String fullName;
    private Integer streakDays;
    private LocalDateTime lastActiveDate;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 3: 编写 PageResponse**

```java
package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {
    private List<T> data;
    private Long count;
}
```

- [ ] **Step 4: 编写 MessageResponse**

```java
package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private String message;
}
```

- [ ] **Step 5: 编写 LoginRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;
}
```

- [ ] **Step 6: 编写 UserRegisterRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserRegisterRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    private String fullName;
}
```

---

### Task 3.2: UserMapper

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/mapper/UserMapper.java`

- [ ] **Step 1: 编写 UserMapper**

```java
package com.emomind.mapper;

import com.emomind.dto.response.UserResponse;
import com.emomind.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(source = "hashedPassword", target = "hashedPassword", ignore = true)
    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);
}
```

---

### Task 3.3: UserService

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/service/UserService.java`

- [ ] **Step 1: 编写 UserService**

```java
package com.emomind.service;

import com.emomind.dto.request.*;
import com.emomind.dto.response.*;
import com.emomind.entity.User;
import com.emomind.exception.ServiceException;
import com.emomind.exception.UnauthorizedException;
import com.emomind.mapper.UserMapper;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;
    private final UserMapper userMapper;

    public TokenResponse login(String email, String password) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, password));
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String token = tokenProvider.generateToken(userDetails.getId().toString());
        return new TokenResponse(token, "bearer");
    }

    public UserResponse register(UserRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ServiceException("Email already registered");
        }
        User user = User.builder()
                .email(request.getEmail())
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .isActive(true)
                .isSuperuser(false)
                .streakDays(0)
                .build();
        User saved = userRepository.save(user);
        return userMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Could not validate credentials"));
        return userMapper.toResponse(user);
    }

    public UserResponse updateCurrentUser(UUID userId, UserUpdateMeRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Could not validate credentials"));
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ServiceException("Email already registered");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        return userMapper.toResponse(userRepository.save(user));
    }

    public void deleteCurrentUser(UUID userId) {
        userRepository.deleteById(userId);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getAllUsers(Pageable pageable) {
        var page = userRepository.findAll(pageable);
        return new PageResponse<>(userMapper.toResponseList(page.getContent()), page.getTotalElements());
    }

    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ServiceException("Email already registered");
        }
        User user = User.builder()
                .email(request.getEmail())
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .isSuperuser(request.getIsSuperuser() != null ? request.getIsSuperuser() : false)
                .streakDays(0)
                .build();
        return userMapper.toResponse(userRepository.save(user));
    }

    public UserResponse updateUser(UUID userId, UserUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ServiceException("User not found"));
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ServiceException("Email already registered");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        }
        if (request.getIsSuperuser() != null) {
            user.setIsSuperuser(request.getIsSuperuser());
        }
        if (request.getPassword() != null) {
            user.setHashedPassword(passwordEncoder.encode(request.getPassword()));
        }
        return userMapper.toResponse(userRepository.save(user));
    }

    public void deleteUser(UUID userId) {
        userRepository.deleteById(userId);
    }

    public void updatePassword(UUID userId, UpdatePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Could not validate credentials"));
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getHashedPassword())) {
            throw new UnauthorizedException("Incorrect password");
        }
        user.setHashedPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public void updateStreakIfNeeded(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        LocalDateTime lastActive = user.getLastActiveDate();

        if (lastActive == null) {
            user.setStreakDays(1);
        } else {
            LocalDate lastDate = lastActive.atZone(ZoneId.of("Asia/Shanghai")).toLocalDate();
            if (lastDate.equals(today)) {
                return;
            } else if (lastDate.plusDays(1).equals(today)) {
                user.setStreakDays(user.getStreakDays() + 1);
            } else {
                user.setStreakDays(1);
            }
        }
        user.setLastActiveDate(LocalDateTime.now(ZoneId.of("Asia/Shanghai")));
        userRepository.save(user);
    }
}
```

---

### Task 3.4: LoginController

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/controller/LoginController.java`

- [ ] **Step 1: 编写 LoginController**

```java
package com.emomind.controller;

import com.emomind.dto.request.LoginRequest;
import com.emomind.dto.request.PasswordResetRequest;
import com.emomind.dto.response.MessageResponse;
import com.emomind.dto.response.TokenResponse;
import com.emomind.dto.response.UserResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LoginController {

    private final UserService userService;

    @PostMapping("/login/access-token")
    public ResponseEntity<TokenResponse> login(@Valid @ModelAttribute LoginRequest request) {
        return ResponseEntity.ok(userService.login(request.getUsername(), request.getPassword()));
    }

    @PostMapping("/login/test-token")
    public ResponseEntity<UserResponse> testToken(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok(userService.getCurrentUser(user.getId()));
    }

    @PostMapping("/password-recovery/{email}")
    public ResponseEntity<MessageResponse> recoverPassword(@PathVariable String email) {
        // TODO: Implement email sending in next iteration
        return ResponseEntity.ok(new MessageResponse("Password recovery email sent"));
    }

    @PostMapping("/reset-password/")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        // TODO: Implement password reset in next iteration
        return ResponseEntity.ok(new MessageResponse("Password updated successfully"));
    }
}
```

---

### Task 3.5: UserController

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/controller/UserController.java`

- [ ] **Step 1: 编写 UserController**

```java
package com.emomind.controller;

import com.emomind.dto.request.*;
import com.emomind.dto.response.*;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<UserResponse>> getAllUsers(Pageable pageable) {
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @PostMapping("/")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.ok(userService.createUser(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok(userService.getCurrentUser(user.getId()));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserResponse> updateCurrentUser(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody UserUpdateMeRequest request) {
        return ResponseEntity.ok(userService.updateCurrentUser(user.getId(), request));
    }

    @DeleteMapping("/me")
    public ResponseEntity<MessageResponse> deleteCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) {
        userService.deleteCurrentUser(user.getId());
        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }

    @PatchMapping("/me/password")
    public ResponseEntity<MessageResponse> updatePassword(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody UpdatePasswordRequest request) {
        userService.updatePassword(user.getId(), request);
        return ResponseEntity.ok(new MessageResponse("Password updated successfully"));
    }

    @PostMapping("/signup")
    public ResponseEntity<UserResponse> signup(@Valid @RequestBody UserRegisterRequest request) {
        return ResponseEntity.ok(userService.register(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getCurrentUser(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }
}
```

---

### Task 3.6: 剩余 DTO

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/dto/request/UserUpdateMeRequest.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/UserCreateRequest.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/UserUpdateRequest.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/UpdatePasswordRequest.java`
- Create: `backend-sb/src/main/java/com/emomind/dto/request/PasswordResetRequest.java`

- [ ] **Step 1: 编写 UserUpdateMeRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UserUpdateMeRequest {
    @Email(message = "Invalid email format")
    private String email;
    private String fullName;
}
```

- [ ] **Step 2: 编写 UserCreateRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserCreateRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    private String fullName;
    private Boolean isActive;
    private Boolean isSuperuser;
}
```

- [ ] **Step 3: 编写 UserUpdateRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UserUpdateRequest {
    @Email(message = "Invalid email format")
    private String email;
    private String fullName;
    private Boolean isActive;
    private Boolean isSuperuser;
    private String password;
}
```

- [ ] **Step 4: 编写 UpdatePasswordRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdatePasswordRequest {
    @NotBlank(message = "Current password is required")
    private String currentPassword;

    @NotBlank(message = "New password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String newPassword;
}
```

- [ ] **Step 5: 编写 PasswordResetRequest**

```java
package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PasswordResetRequest {
    @NotBlank(message = "Token is required")
    private String token;

    @NotBlank(message = "New password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String newPassword;
}
```

- [ ] **Step 6: Commit Auth 模块**

```bash
git add backend-sb/src/main/java/com/emomind/dto/
git add backend-sb/src/main/java/com/emomind/mapper/
git add backend-sb/src/main/java/com/emomind/service/
git add backend-sb/src/main/java/com/emomind/controller/
git commit -m "feat(auth): add authentication and user management controllers, services and DTOs"
```

---

## Phase 4: Health Check 模块

### Task 4.1: UtilsController

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/controller/UtilsController.java`

- [ ] **Step 1: 编写 UtilsController**

```java
package com.emomind.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/utils")
public class UtilsController {

    @GetMapping("/health-check/")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend-sb/src/main/java/com/emomind/controller/UtilsController.java
git commit -m "feat(health): add health check endpoint"
```

---

## Phase 5: 应用入口与启动

### Task 5.1: EmoMindApplication

**Files:**
- Create: `backend-sb/src/main/java/com/emomind/EmoMindApplication.java`

- [ ] **Step 1: 编写 EmoMindApplication**

```java
package com.emomind;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class EmoMindApplication {

    public static void main(String[] args) {
        SpringApplication.run(EmoMindApplication.class, args);
    }
}
```

---

### Task 5.2: 编译验证

- [ ] **Step 1: 编译项目**

Run: `cd backend-sb && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 2: 运行测试**

Run: `cd backend-sb && ./mvnw test -q`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add backend-sb/src/main/java/com/emomind/EmoMindApplication.java
git commit -m "feat(app): add Spring Boot application entry point"
```

---

## 集成测试任务

### Task I.1: LoginController 集成测试

**Files:**
- Create: `backend-sb/src/test/java/com/emomind/controller/LoginControllerTest.java`

- [ ] **Step 1: 编写 LoginControllerTest**

```java
package com.emomind.controller;

import com.emomind.dto.request.UserRegisterRequest;
import com.emomind.dto.response.TokenResponse;
import com.emomind.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LoginControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() throws Exception {
        userRepository.deleteAll();
    }

    @Test
    void shouldRegisterAndLogin() throws Exception {
        // Register
        UserRegisterRequest registerReq = new UserRegisterRequest();
        registerReq.setEmail("test@example.com");
        registerReq.setPassword("password123");
        registerReq.setFullName("Test User");

        mockMvc.perform(post("/api/v1/users/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"));

        // Login
        var loginResult = mockMvc.perform(post("/api/v1/login/access-token")
                        .param("username", "test@example.com")
                        .param("password", "password123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").exists())
                .andReturn();

        String responseBody = loginResult.getResponse().getContentAsString();
        TokenResponse tokenResponse = objectMapper.readValue(responseBody, TokenResponse.class);
        assertThat(tokenResponse.getTokenType()).isEqualTo("bearer");

        // Test token
        mockMvc.perform(post("/api/v1/login/test-token")
                        .header("Authorization", "Bearer " + tokenResponse.getAccessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    void shouldReturn401ForInvalidLogin() throws Exception {
        mockMvc.perform(post("/api/v1/login/access-token")
                        .param("username", "nonexistent@example.com")
                        .param("password", "wrong"))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 运行测试**

Run: `cd backend-sb && ./mvnw test -Dtest=LoginControllerTest -q`
Expected: 2 tests passed

---

### Task I.2: UserController 集成测试

**Files:**
- Create: `backend-sb/src/test/java/com/emomind/controller/UserControllerTest.java`

- [ ] **Step 1: 编写 UserControllerTest**

```java
package com.emomind.controller;

import com.emomind.dto.request.UpdatePasswordRequest;
import com.emomind.dto.request.UserRegisterRequest;
import com.emomind.entity.User;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String userToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        User user = new User();
        user.setEmail("user@example.com");
        user.setHashedPassword(passwordEncoder.encode("password123"));
        user.setIsActive(true);
        user.setIsSuperuser(false);
        user = userRepository.save(user);
        userToken = tokenProvider.generateToken(user.getId().toString());

        User admin = new User();
        admin.setEmail("admin@example.com");
        admin.setHashedPassword(passwordEncoder.encode("password123"));
        admin.setIsActive(true);
        admin.setIsSuperuser(true);
        admin = userRepository.save(admin);
        adminToken = tokenProvider.generateToken(admin.getId().toString());
    }

    @Test
    void shouldGetCurrentUser() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("user@example.com"));
    }

    @Test
    void shouldUpdatePassword() throws Exception {
        UpdatePasswordRequest request = new UpdatePasswordRequest();
        request.setCurrentPassword("password123");
        request.setNewPassword("newpassword123");

        mockMvc.perform(patch("/api/v1/users/me/password")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password updated successfully"));
    }

    @Test
    void shouldDenyNonAdminAccessToUserList() throws Exception {
        mockMvc.perform(get("/api/v1/users/")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldAllowAdminToListUsers() throws Exception {
        mockMvc.perform(get("/api/v1/users/")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }
}
```

- [ ] **Step 2: 运行测试**

Run: `cd backend-sb && ./mvnw test -Dtest=UserControllerTest -q`
Expected: 4 tests passed

- [ ] **Step 3: Commit 测试**

```bash
git add backend-sb/src/test/java/com/emomind/controller/
git commit -m "test(integration): add controller integration tests for auth and user management"
```

---

## 最终验证

### Task F.1: 全量测试 + 编译

- [ ] **Step 1: 全量编译**

Run: `cd backend-sb && ./mvnw clean compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 2: 全量测试**

Run: `cd backend-sb && ./mvnw test -q`
Expected: All tests passed

- [ ] **Step 3: 打包验证**

Run: `cd backend-sb && ./mvnw package -DskipTests -q`
Expected: BUILD SUCCESS, target/emomind-backend-1.0.0-SNAPSHOT.jar 生成

- [ ] **Step 4: 最终 Commit**

```bash
git add backend-sb/
git commit -m "feat(mvp): complete backend core authentication pipeline with TDD"
```
