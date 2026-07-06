variable "notion_api_key" {
  description = "Notion integration token (server/config.ts: NOTION_API_KEY)"
  type        = string
  sensitive   = true
}

variable "notion_tasks_db" {
  description = "Notion Tasks database ID"
  type        = string
}

variable "notion_notes_db" {
  description = "Notion Notes database ID"
  type        = string
}

variable "notion_projects_db" {
  description = "Notion Projects database ID"
  type        = string
}

variable "notion_tags_db" {
  description = "Notion Tags database ID"
  type        = string
}
