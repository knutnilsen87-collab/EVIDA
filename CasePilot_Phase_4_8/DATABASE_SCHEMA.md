# DATABASE_SCHEMA

## Recommended ORM naming
Use singular model names and explicit workspace scoping.

## Core tables

### users
- id
- email
- name
- image_url
- created_at
- updated_at

### workspaces
- id
- name
- slug
- plan
- created_at
- updated_at

### memberships
- id
- user_id
- workspace_id
- role
- status
- invited_by_user_id
- created_at
- updated_at

Unique:
- workspace_id + user_id

Roles:
- admin
- manager
- owner
- collaborator
- reviewer

### cases
- id
- workspace_id
- case_number
- title
- description
- status
- priority
- risk_level
- owner_user_id
- due_at
- archived_at
- created_by_user_id
- created_at
- updated_at

Indexes:
- workspace_id + status
- workspace_id + owner_user_id
- workspace_id + updated_at
- workspace_id + risk_level
- workspace_id + case_number unique

### case_collaborators
- id
- case_id
- user_id
- role
- created_at

Unique:
- case_id + user_id

### case_templates
- id
- workspace_id
- name
- description
- default_status
- default_priority
- default_fields_json
- archived_at
- created_at
- updated_at

### notes
- id
- workspace_id
- case_id
- author_user_id
- body
- archived_at
- created_at
- updated_at

### tasks
- id
- workspace_id
- case_id
- title
- description
- status
- assignee_user_id
- due_at
- completed_at
- created_by_user_id
- archived_at
- created_at
- updated_at

Task statuses:
- open
- in_progress
- blocked
- done
- canceled

### file_attachments
- id
- workspace_id
- case_id
- uploaded_by_user_id
- storage_key
- original_filename
- content_type
- byte_size
- checksum
- status
- archived_at
- created_at
- updated_at

File statuses:
- pending
- uploaded
- failed
- quarantined

### activity_events
- id
- workspace_id
- case_id
- actor_user_id
- event_type
- target_type
- target_id
- metadata_json
- created_at

Indexes:
- workspace_id + case_id + created_at
- workspace_id + event_type + created_at

### ai_summaries
- id
- workspace_id
- case_id
- requested_by_user_id
- approved_by_user_id
- prompt_version
- model
- provider
- input_refs_json
- summary_text
- recommendations_text
- status
- rejection_reason
- created_at
- reviewed_at

Statuses:
- draft
- approved
- rejected
- superseded
- failed

### ai_suggestions
- id
- workspace_id
- case_id
- ai_summary_id
- suggestion_type
- suggestion_text
- status
- reviewed_by_user_id
- created_at
- reviewed_at

Statuses:
- draft
- accepted
- edited
- rejected

### audit_logs
- id
- workspace_id
- actor_user_id
- action
- target_type
- target_id
- ip_address
- user_agent
- metadata_json
- created_at

## Soft deletion policy
Use archive fields for cases, notes, tasks, files, and templates in MVP. Avoid hard delete until retention policy exists.

## Multi-tenant rule
Every case-related table should carry workspace_id directly, even when it can be inferred. This makes permission checks and indexes simpler.
