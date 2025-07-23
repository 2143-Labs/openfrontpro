use axum::http::Request;
//use chrono::Utc;
use tower_http::trace::{OnRequest, OnResponse};
use tracing::{Span, info};

/// Current date and time as YYYY/MM/DD HH:MM:SST00:00 using chrono crate
//fn ts_formatted() -> String {
//Utc::now().format("%Y/%m/%d %H:%M:%ST%z").to_string()
//}

#[derive(Clone)]
pub struct LogOnRequest;
impl<B> OnRequest<B> for LogOnRequest {
    fn on_request(&mut self, request: &Request<B>, _span: &Span) {
        let method = request.method().clone();
        let path = request.uri().path().to_string();
        if path == "/health" {
            // Don't log health checks
            return;
        }

        //let ts_formatted = ts_formatted();
        let _ = _span.enter();
        if let Some(query) = request.uri().query() {
            info!("<{method} {path}?{query}",);
        } else {
            info!("<{method} {path}",);
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
        let _ent = _span.enter();
        let status = response.status();
        //let ts_formatted = ts_formatted();

        let us = latency.as_micros();
        let ms = (us / 100) as f32 / 10.0;

        // Log also the method and path from the prev
        // Use tracing to get the span value
        if ms > 4.0 {
            info!(">{status} ({ms}ms)",);
        }
    }
}
