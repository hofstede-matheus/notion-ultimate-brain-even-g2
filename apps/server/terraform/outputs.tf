output "function_url" {
  description = "Direct Function URL — kept for debugging. Stops answering once lock_function_url_to_cloudfront is true."
  value       = trimsuffix(aws_lambda_function_url.notion_backend.function_url, "/")
}

output "cloudfront_domain" {
  description = "The new VITE_API_BASE, and the app.json network whitelist entry, once the glasses app is rebuilt to use it."
  value       = "https://${aws_cloudfront_distribution.notion_backend.domain_name}"
}
