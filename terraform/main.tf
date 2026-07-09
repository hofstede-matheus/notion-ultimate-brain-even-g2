provider "aws" {
  region = "us-east-1"
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

resource "aws_lambda_function" "notion_backend" {
  function_name = "notion-ultimate-brain-backend"

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  memory_size   = 128
  timeout       = 10

  role = aws_iam_role.lambda.arn
}

resource "aws_lambda_function_url" "notion_backend" {
  function_name      = aws_lambda_function.notion_backend.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PATCH", "DELETE"]
    allow_headers = ["content-type", "x-notion-config"]
  }
}

resource "aws_lambda_permission" "public_function_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.notion_backend.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
