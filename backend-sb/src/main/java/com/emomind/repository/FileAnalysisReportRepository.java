package com.emomind.repository;

import com.emomind.entity.FileAnalysisReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface FileAnalysisReportRepository extends JpaRepository<FileAnalysisReport, UUID> {

    Page<FileAnalysisReport> findByOwnerId(UUID ownerId, Pageable pageable);

    long countByCreatedAtAfter(LocalDateTime dateTime);
}
