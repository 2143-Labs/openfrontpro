// BEGIN UTILS
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use chrono::Utc;
use std::net::SocketAddr;
use std::time::SystemTime;
use tower_http::trace::{OnRequest, OnResponse, TraceLayer};
use tracing::{Span, info};

/// Current date and time as YYYY/MM/DD HH:MM:SST00:00 using chrono crate
fn ts_formatted() -> String {
    Utc::now().format("%Y/%m/%d %H:%M:%ST%z").to_string()
}

#[derive(Clone)]
pub struct LogOnRequest;
impl<B> OnRequest<B> for LogOnRequest {
    fn on_request(&mut self, request: &Request<B>, _span: &Span) {
        let method = request.method().clone();
        let path = request.uri().path().to_string();

        let ts_formatted = ts_formatted();
        _span.enter();
        if let Some(query) = request.uri().query() {
            info!("<{ts_formatted} {method} {path}?{query}",);
        } else {
            info!("<{ts_formatted} {method} {path}",);
        }
    }
}

#[derive(Clone)]
pub struct LogOnResponse;
impl<B> OnResponse<B> for LogOnResponse {
    fn on_response(
        self,
        response: &axum::http::Response<B>,
        latency: std::time::Duration,
        _span: &Span,
    ) {
        _span.enter();
        let status = response.status();
        let ts_formatted = ts_formatted();

        let us = latency.as_micros();
        let ms = (us / 100) as f32 / 10.0;
        info!(">{ts_formatted} {status} ({ms}ms)",);
    }
}
// END UTILS
