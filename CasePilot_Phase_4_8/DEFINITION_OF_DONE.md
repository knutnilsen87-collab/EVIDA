# DEFINITION_OF_DONE

## Feature-level done
A feature is done only when:
- It is implemented end-to-end.
- It has server-side authorization.
- It has validation for user input.
- It has useful loading, empty, and error states.
- It records audit/activity events where relevant.
- It has tests proportional to risk.
- It is documented enough for the next developer to understand it.

## MVP-level done
The MVP is done when:
- A pilot team can manage real cases in the system.
- Core workflows are not dependent on manual database edits.
- AI summaries are clearly drafts until approved.
- Basic dashboard/reporting works.
- Admin can manage users/roles.
- Production deployment is repeatable.
- Backups and monitoring are configured.

## Not done if
- Permissions only exist in the UI.
- AI text is mixed with human-entered facts without status.
- File URLs are public by default.
- Migrations are not tracked.
- Errors fail silently.
- A new developer cannot run the app locally from docs.

## Quality bar
The product should feel boringly reliable before it feels clever.
