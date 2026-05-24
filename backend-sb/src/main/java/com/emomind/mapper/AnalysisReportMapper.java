package com.emomind.mapper;

import com.emomind.dto.response.AnalysisReportResponse;
import com.emomind.entity.FileAnalysisReport;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring", uses = UserMapper.class)
public interface AnalysisReportMapper {

    @Mapping(source = "owner", target = "owner")
    AnalysisReportResponse toResponse(FileAnalysisReport report);

    List<AnalysisReportResponse> toResponseList(List<FileAnalysisReport> reports);
}
