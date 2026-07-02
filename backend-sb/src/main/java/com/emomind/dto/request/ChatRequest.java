package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public class ChatRequest {

    @NotBlank
    private String graph;

    private String threadId;

    @NotNull
    private Map<String, Object> input;

    public String getGraph() { return graph; }
    public void setGraph(String graph) { this.graph = graph; }

    public String getThreadId() { return threadId; }
    public void setThreadId(String threadId) { this.threadId = threadId; }

    public Map<String, Object> getInput() { return input; }
    public void setInput(Map<String, Object> input) { this.input = input; }
}
