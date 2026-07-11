# Lets GitHub Actions assume an AWS role via OIDC to deploy this stack —
# no long-lived AWS access keys stored anywhere. Bootstrap this file with a
# LOCAL `terraform apply` (your own AWS credentials) before the workflow can
# run: CI can't create the very role it needs to authenticate.

variable "github_repository" {
  description = "GitHub \"owner/repo\" allowed to assume the deploy role (only from the main branch)"
  type        = string
  default     = "hofstede-matheus/notion-ultimate-brain-even-g2"
}

data "aws_caller_identity" "current" {}

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "notion-ultimate-brain-github-actions-deploy"

  # Restricted to this exact repo, and only workflow runs triggered from
  # pushes to `main` — a PR from a fork, or a push to any other branch,
  # cannot assume this role.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

# Scoped to exactly what `terraform apply` needs for this stack: full control
# over the app's own Lambda function and its execution role, plus read-only
# access to this role and the OIDC provider (so CI can refresh/plan them
# without erroring) — but no permission to modify its own trust policy or
# grant itself broader access. Widening who can assume this role always
# requires a human to run `terraform apply` locally with their own
# credentials.
resource "aws_iam_role_policy" "github_actions_deploy_scope" {
  name = "deploy-scope"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ManageAppLambda"
        Effect   = "Allow"
        Action   = "lambda:*"
        Resource = "arn:aws:lambda:us-east-1:${data.aws_caller_identity.current.account_id}:function:notion-ultimate-brain-backend*"
      },
      {
        Sid      = "ManageAppLambdaExecutionRole"
        Effect   = "Allow"
        Action   = "iam:*"
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/notion-ultimate-brain-lambda"
      },
      {
        Sid      = "PassAppLambdaExecutionRole"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/notion-ultimate-brain-lambda"
      },
      {
        Sid    = "ReadOwnRoleAndOidcProvider"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:GetOpenIDConnectProvider",
        ]
        Resource = [
          aws_iam_role.github_actions_deploy.arn,
          aws_iam_openid_connect_provider.github_actions.arn,
        ]
      },
    ]
  })
}

output "github_actions_deploy_role_arn" {
  description = "Paste this into the GitHub repo's Actions variable AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_actions_deploy.arn
}
