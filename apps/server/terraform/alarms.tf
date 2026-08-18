variable "alarm_email" {
  description = "Where cost/abuse alarms are sent. Requires a one-time click on a confirmation email from AWS SNS before alarms actually deliver."
  type        = string
  default     = "hofs@mediato.dev"
}

resource "aws_sns_topic" "alarms" {
  name = "notion-ultimate-brain-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Fires within ~1 minute of concurrency reaching 5 — a fixed early-warning
# line, independent of reserved_concurrent_executions (10, in main.tf). Not
# derived as a fraction of the reservation on purpose: the reservation stays
# at 10 as a cost ceiling, while this warns well before that ceiling is
# actually approached.
resource "aws_cloudwatch_metric_alarm" "concurrency" {
  alarm_name          = "notion-ultimate-brain-concurrency-near-limit"
  alarm_description   = "ConcurrentExecutions has reached 5 — worth a look before it gets anywhere near the reserved_concurrent_executions ceiling."
  namespace           = "AWS/Lambda"
  metric_name         = "ConcurrentExecutions"
  dimensions          = { FunctionName = aws_lambda_function.notion_backend.function_name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# 200/hour, sized for real scale (25 downloads, single-digit regular users) —
# a generous multiple of realistic peak (a handful of active users in the
# same hour, each running heavy sessions), not a generic "obviously wrong"
# guess. Raise this in big, deliberate steps if downloads/engagement grow and
# it starts firing on legitimate use.
resource "aws_cloudwatch_metric_alarm" "invocations" {
  alarm_name          = "notion-ultimate-brain-invocation-spike"
  alarm_description   = "Hourly invocation volume is far above normal for current usage levels."
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  dimensions          = { FunctionName = aws_lambda_function.notion_backend.function_name }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 200
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# AWS Budgets is ACCOUNT-WIDE, not per-project — there's exactly one of these
# across every stack in the account. It lives here (rather than duplicated in
# tallinja's stack, or split into a third "shared" stack) because this is the
# repo the account owner actively deploys to most. If tallinja and this
# project ever end up in separate AWS accounts, copy this block into
# tallinja's terraform/alarms.tf and give each its own threshold.
resource "aws_budgets_budget" "account_monthly" {
  name        = "account-monthly-cost"
  budget_type = "COST"
  # $2/mo, matching real usage at this scale (25 downloads, single-digit
  # regular users) rather than a generic guess. Expected baseline spend is
  # near $0 at this traffic — Lambda, CloudFront, and CloudWatch all fall
  # within free-tier — so a tight budget shouldn't cause false alarms, it'll
  # just actually catch it early if something goes wrong.
  limit_amount = "2"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Three tiers, not two: at $2 total, the gap between an 80% and 100%
  # breakpoint is only 40 cents — not much lead time. 50% adds a full
  # dollar of runway before the later, more urgent breakpoints fire.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alarm_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alarm_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alarm_email]
  }
}

# Stub, disabled by default (see the enable_waf variable in main.tf). A
# rate-based rule per IP; flip enable_waf to true to turn this on — no other
# change needed, main.tf already wires web_acl_id onto the distribution.
resource "aws_wafv2_web_acl" "notion_backend" {
  count = var.enable_waf ? 1 : 0

  name  = "notion-ultimate-brain-backend"
  scope = "CLOUDFRONT"
  # CLOUDFRONT-scope web ACLs must be created against us-east-1 regardless of
  # where the distribution's origin lives — this provider already defaults
  # there (versions.tf), so no aliased provider is needed.

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000 # requests per 5-minute window, per IP
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "notion-backend-rate-limit"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "notion-backend"
  }
}
