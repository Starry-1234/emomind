package com.emomind.repository;

import com.emomind.entity.TestRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface TestRecordRepository extends JpaRepository<TestRecord, UUID> {

    Page<TestRecord> findByOwnerId(UUID ownerId, Pageable pageable);

    Page<TestRecord> findAll(Pageable pageable);

    long countByCreatedAtAfter(LocalDateTime dateTime);
}
