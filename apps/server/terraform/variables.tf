variable "debug" {
  description = "\"true\" forces the lambda to log full response bodies on every call, not just failures. Set via TF_VAR_debug in CI from the DEBUG GitHub Actions repository variable."
  type        = string
  default     = "false"
}
