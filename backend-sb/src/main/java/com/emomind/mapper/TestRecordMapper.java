package com.emomind.mapper;

import com.emomind.dto.response.TestRecordResponse;
import com.emomind.entity.TestRecord;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring", uses = UserMapper.class)
public interface TestRecordMapper {

    @Mapping(source = "owner", target = "owner")
    TestRecordResponse toResponse(TestRecord testRecord);

    List<TestRecordResponse> toResponseList(List<TestRecord> testRecords);
}
