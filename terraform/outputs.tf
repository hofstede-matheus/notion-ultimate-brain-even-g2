output "function_url" {
  description = "Lambda Function URL — set as VITE_API_BASE when building the glasses webview"
  value       = trimsuffix(aws_lambda_function_url.notion_backend.function_url, "/")
}
