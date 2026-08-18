provider "aws" {
  region = "us-east-1"
}

variable "lock_function_url_to_cloudfront" {
  description = <<-EOT
    false (default): the Function URL stays publicly invocable, so the
    currently shipped glasses build (which points VITE_API_BASE straight at
    it) keeps working while CloudFront is stood up and a new app version is
    submitted.

    true: the Function URL flips to AWS_IAM and only CloudFront (via the
    origin access control below) can invoke it. Flip this ONLY after an app
    version pointing at the CloudFront domain (see the cloudfront_domain
    output) is live — it breaks every client still using the direct
    lambda-url.* hostname.
  EOT
  type        = bool
  default     = false
}

variable "enable_waf" {
  description = <<-EOT
    false (default): no WAF web ACL exists. Per-IP throttling relies on
    reserved concurrency instead — this distribution doesn't cache (see
    below), so caching can't absorb volume the way it does for tallinja.

    true: attaches a rate-based WAF web ACL to the distribution. Costs a
    fixed ~$6-8/month (a $5/mo web ACL, $1/mo per rule, plus request volume)
    regardless of traffic, on top of whatever CloudFront/Lambda usage costs.
  EOT
  type        = bool
  default     = false
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../dist-lambda"
  output_path = "${path.module}/dist-lambda.zip"
}

resource "aws_iam_role" "lambda" {
  name = "notion-ultimate-brain-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "notion_backend" {
  name = "/aws/lambda/notion-ultimate-brain-backend"

  # Lambda auto-creates this group with retention set to "never expire", so a
  # flood's log lines are ingested once ($0.50/GB) and then stored forever.
  # Declaring it here caps that. This is a storage-lifetime setting, not a
  # logging-behavior switch — it doesn't conflict with the "no env var may
  # change what's logged" rule below.
  retention_in_days = 14
}

resource "aws_lambda_function" "notion_backend" {
  function_name = "notion-ultimate-brain-backend"

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  memory_size   = 128
  timeout       = 10

  # The hard cost ceiling, and the single most important line in this file.
  # Without it this function can scale into the account's 1000 unreserved
  # concurrency slots: a flood costs ~100x what it should AND starves every
  # other function in the account of capacity. 10 is generous for this
  # workload; raise it only with a reason. Setting it to 0 is an instant kill
  # switch — stops all invocations and all spend — the right first move if
  # this is actively being hit.
  reserved_concurrent_executions = 10

  role = aws_iam_role.lambda.arn

  # No environment variables, deliberately. The function's logging guarantee is
  # published on the landing page's legal.html: nothing on success, and no user
  # data on failure. Don't add a verbosity flag here — a promise that a deploy
  # variable can switch off isn't a promise. If logging needs to change, that's
  # a code change in src/lambda/logger.ts, with tests to argue with.

  depends_on = [aws_cloudwatch_log_group.notion_backend]
}

resource "aws_lambda_function_url" "notion_backend" {
  function_name = aws_lambda_function.notion_backend.function_name

  # See the lock_function_url_to_cloudfront variable above.
  authorization_type = var.lock_function_url_to_cloudfront ? "AWS_IAM" : "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PATCH", "DELETE"]
    allow_headers = ["content-type", "x-notion-config", "x-notion-token"]
  }
}

# Only while the URL is still public (see lock_function_url_to_cloudfront).
resource "aws_lambda_permission" "public_function_url" {
  count = var.lock_function_url_to_cloudfront ? 0 : 1

  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.notion_backend.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Only once locked down: CloudFront (via OAC) is the sole permitted invoker.
resource "aws_lambda_permission" "cloudfront_function_url" {
  count = var.lock_function_url_to_cloudfront ? 1 : 0

  statement_id           = "AllowCloudFrontFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.notion_backend.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.notion_backend.arn
  function_url_auth_type = "AWS_IAM"
}

# Signs CloudFront -> Lambda Function URL requests with SigV4, so the origin
# can require AWS_IAM auth and still be reachable from CloudFront without a
# long-lived credential anywhere.
resource "aws_cloudfront_origin_access_control" "notion_backend" {
  name                              = "notion-ultimate-brain-backend"
  description                       = "Signs CloudFront -> Lambda Function URL requests with SigV4"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# This distribution exists to enforce the OAC lockdown above and give a
# future WAF something to attach to — NOT to cache. Every response here is
# one tenant's Notion data, and the tenant is identified by the
# X-Notion-Config / X-Notion-Token headers, neither of which is part of any
# cache key CloudFront could use safely. Caching anything here risks serving
# one user's tasks and notes to another, so caching stays disabled.
resource "aws_cloudfront_distribution" "notion_backend" {
  enabled = true

  price_class = "PriceClass_100"

  origin {
    domain_name = trimsuffix(
      replace(aws_lambda_function_url.notion_backend.function_url, "https://", ""),
      "/"
    )
    origin_id                = "lambda-backend"
    origin_access_control_id = aws_cloudfront_origin_access_control.notion_backend.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "lambda-backend"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Managed-CachingDisabled — see the comment above the distribution. This
    # must stay disabled; do not swap it for a caching policy.
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # Forwarding the viewer's Host header breaks SigV4 (the signature is
    # computed over the origin's own hostname) — this managed policy forwards
    # everything except Host.
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  web_acl_id = var.enable_waf ? aws_wafv2_web_acl.notion_backend[0].arn : null
}
