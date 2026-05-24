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
