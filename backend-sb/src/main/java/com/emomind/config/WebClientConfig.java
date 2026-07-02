package com.emomind.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.util.concurrent.TimeUnit;

@Configuration
public class WebClientConfig {

    private final LangGraphProperties langGraphProperties;

    public WebClientConfig(LangGraphProperties langGraphProperties) {
        this.langGraphProperties = langGraphProperties;
    }

    @Bean
    public WebClient aiRuntimeWebClient() {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) langGraphProperties.getConnectTimeoutMs())
            .doOnConnected(conn ->
                conn.addHandlerLast(new ReadTimeoutHandler(
                    langGraphProperties.getResponseTimeoutMs(), TimeUnit.MILLISECONDS)));

        return WebClient.builder()
            .baseUrl(langGraphProperties.getRuntimeUrl())
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
    }
}
