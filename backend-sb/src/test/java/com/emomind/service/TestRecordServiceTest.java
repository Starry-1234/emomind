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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestRecordServiceTest {

    @Mock
    private TestRecordRepository testRecordRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TestRecordMapper testRecordMapper;

    @InjectMocks
    private TestRecordService testRecordService;

    @Test
    void shouldCreateRecordSuccessfully() {
        UUID ownerId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        TestRecordCreateRequest request = new TestRecordCreateRequest();
        request.setTestName("PHQ-9");
        request.setQuestions(List.of(Map.of("text", "Q1")));
        request.setAnswers(List.of(Map.of("score", 1)));

        when(userRepository.findById(ownerId)).thenReturn(Optional.of(owner));
        when(testRecordRepository.save(any(TestRecord.class))).thenAnswer(inv -> inv.getArgument(0));
        when(testRecordMapper.toResponse(any(TestRecord.class))).thenReturn(new TestRecordResponse());

        TestRecordResponse result = testRecordService.createRecord(ownerId, request);

        assertThat(result).isNotNull();
        verify(testRecordRepository).save(any(TestRecord.class));
    }

    @Test
    void shouldThrowWhenOwnerNotFoundOnCreate() {
        UUID ownerId = UUID.randomUUID();
        TestRecordCreateRequest request = new TestRecordCreateRequest();

        when(userRepository.findById(ownerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> testRecordService.createRecord(ownerId, request))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void shouldGetRecordForOwner() {
        UUID ownerId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        TestRecord record = TestRecord.builder().id(recordId).owner(owner).build();

        when(testRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(testRecordMapper.toResponse(record)).thenReturn(new TestRecordResponse());

        TestRecordResponse result = testRecordService.getRecord(recordId, ownerId);

        assertThat(result).isNotNull();
    }

    @Test
    void shouldThrowWhenRecordNotFound() {
        UUID recordId = UUID.randomUUID();
        when(testRecordRepository.findById(recordId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> testRecordService.getRecord(recordId, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Test record not found");
    }

    @Test
    void shouldThrowWhenAccessingOthersRecord() {
        UUID ownerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        TestRecord record = TestRecord.builder().id(recordId).owner(owner).build();

        when(testRecordRepository.findById(recordId)).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> testRecordService.getRecord(recordId, otherId))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Not enough permissions");
    }

    @Test
    void shouldUpdateRecordSuccessfully() {
        UUID ownerId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        TestRecord record = TestRecord.builder().id(recordId).owner(owner).testName("Old").build();
        TestRecordUpdateRequest request = new TestRecordUpdateRequest();
        request.setTestName("New");

        when(testRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(testRecordRepository.save(any(TestRecord.class))).thenAnswer(inv -> inv.getArgument(0));
        when(testRecordMapper.toResponse(any(TestRecord.class))).thenReturn(new TestRecordResponse());

        TestRecordResponse result = testRecordService.updateRecord(recordId, ownerId, request);

        assertThat(result).isNotNull();
        assertThat(record.getTestName()).isEqualTo("New");
    }

    @Test
    void shouldDeleteRecordSuccessfully() {
        UUID ownerId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        TestRecord record = TestRecord.builder().id(recordId).owner(owner).build();

        when(testRecordRepository.findById(recordId)).thenReturn(Optional.of(record));

        testRecordService.deleteRecord(recordId, ownerId);

        verify(testRecordRepository).delete(record);
    }

    @Test
    void shouldGetAllRecords() {
        Page<TestRecord> page = new PageImpl<>(List.of(TestRecord.builder().build()));
        when(testRecordRepository.findAll(any(PageRequest.class))).thenReturn(page);
        when(testRecordMapper.toResponseList(any())).thenReturn(List.of(new TestRecordResponse()));

        PageResponse<TestRecordResponse> result = testRecordService.getAllRecords(null, PageRequest.of(0, 10));

        assertThat(result.getCount()).isEqualTo(1);
    }

    @Test
    void shouldDeleteAnyRecordAsAdmin() {
        UUID recordId = UUID.randomUUID();
        TestRecord record = TestRecord.builder().id(recordId).build();

        when(testRecordRepository.findById(recordId)).thenReturn(Optional.of(record));

        testRecordService.deleteAnyRecord(recordId);

        verify(testRecordRepository).delete(record);
    }
}
