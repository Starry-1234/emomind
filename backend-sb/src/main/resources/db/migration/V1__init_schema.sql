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
