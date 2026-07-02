package com.emomind.service;

import com.emomind.dto.request.TestRecordCreateRequest;
import com.emomind.dto.request.TestRecordUpdateRequest;
import com.emomind.dto.response.PageResponse;
import com.emomind.dto.response.TestRecordResponse;
import com.emomind.entity.TestRecord;
import com.emomind.entity.User;
import com.emomind.exception.ResourceNotFoundException;
import com.emomind.exception.UnauthorizedException;
import com.emomind.mapper.TestRecordMapper;
import com.emomind.repository.TestRecordRepository;
import com.emomind.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TestRecordService {

    private final TestRecordRepository testRecordRepository;
    private final UserRepository userRepository;
    private final TestRecordMapper testRecordMapper;

    @Transactional(readOnly = true)
    public PageResponse<TestRecordResponse> getRecords(UUID ownerId, Pageable pageable) {
        var page = testRecordRepository.findByOwnerId(ownerId, pageable);
        return new PageResponse<>(testRecordMapper.toResponseList(page.getContent()), page.getTotalElements());
    }

    public TestRecordResponse createRecord(UUID ownerId, TestRecordCreateRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new UnauthorizedException("凭证验证失败"));

        TestRecord record = TestRecord.builder()
                .testName(request.getTestName())
                .userTopic(request.getUserTopic())
                .totalScore(request.getTotalScore())
                .totalMax(request.getTotalMax())
                .resultDescription(request.getResultDescription())
                .questions(request.getQuestions())
                .answers(request.getAnswers())
                .scoringRanges(request.getScoringRanges())
                .conversationId(request.getConversationId())
                .owner(owner)
                .build();

        return testRecordMapper.toResponse(testRecordRepository.save(record));
    }

    @Transactional(readOnly = true)
    public TestRecordResponse getRecord(UUID recordId, UUID ownerId) {
        TestRecord record = testRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Test record not found"));
        if (!record.getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("权限不足");
        }
        return testRecordMapper.toResponse(record);
    }

    public TestRecordResponse updateRecord(UUID recordId, UUID ownerId, TestRecordUpdateRequest request) {
        TestRecord record = testRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Test record not found"));
        if (!record.getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("权限不足");
        }

        if (request.getTestName() != null) {
            record.setTestName(request.getTestName());
        }
        if (request.getUserTopic() != null) {
            record.setUserTopic(request.getUserTopic());
        }
        if (request.getTotalScore() != null) {
            record.setTotalScore(request.getTotalScore());
        }
        if (request.getTotalMax() != null) {
            record.setTotalMax(request.getTotalMax());
        }
        if (request.getResultDescription() != null) {
            record.setResultDescription(request.getResultDescription());
        }
        if (request.getQuestions() != null) {
            record.setQuestions(request.getQuestions());
        }
        if (request.getAnswers() != null) {
            record.setAnswers(request.getAnswers());
        }
        if (request.getScoringRanges() != null) {
            record.setScoringRanges(request.getScoringRanges());
        }
        if (request.getConversationId() != null) {
            record.setConversationId(request.getConversationId());
        }

        return testRecordMapper.toResponse(testRecordRepository.save(record));
    }

    public void deleteRecord(UUID recordId, UUID ownerId) {
        TestRecord record = testRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Test record not found"));
        if (!record.getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("权限不足");
        }
        testRecordRepository.delete(record);
    }

    @Transactional(readOnly = true)
    public PageResponse<TestRecordResponse> getAllRecords(UUID userId, Pageable pageable) {
        var page = userId != null
                ? testRecordRepository.findByOwnerId(userId, pageable)
                : testRecordRepository.findAll(pageable);
        return new PageResponse<>(testRecordMapper.toResponseList(page.getContent()), page.getTotalElements());
    }

    public void deleteAnyRecord(UUID recordId) {
        TestRecord record = testRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Test record not found"));
        testRecordRepository.delete(record);
    }
}
