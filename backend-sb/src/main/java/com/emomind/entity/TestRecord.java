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
