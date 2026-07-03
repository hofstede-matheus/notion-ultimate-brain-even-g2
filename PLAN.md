# Implementation Plan — Wire Up All Stub Screens

## Overview

Tasks domain alone covers 16 Notion views + 1 derived (`Overdue`) + 1 voice
input screen. Notes, Projects, and Tags add more. Each screen requires work
across 4 layers: server endpoint → client API → state → screen + router
wiring.

The plan is organized per-domain (Tasks → Notes → Projects → Tags) so each
chunk is independently testable.

---

## Phase 1: Complete Notion View Discovery

Fetch linked-database views from the remaining dashboard sub-pages using the
Notion MCP tool so we know exact filter/sort logic for every screen.

### Already discovered (Tasks)

All 16 view IDs from `v=…` in Notion URLs. Filter logic resolved — see
"Appendix: Resolved View Filters → Tasks" below.

| View             | ID                                       |
|------------------|------------------------------------------|
| Inbox            | `1f63c6e7dd228163aa74000c8101dfdf`       |
| Today            | `1f63c6e7dd22814eada0000c2807038b`       |
| @Didomi          | `1fa3c6e7dd228071a8d4000c7cc1a1d4`       |
| @Mediato         | `1fa3c6e7dd228070a320000ca3fd4c5b`       |
| Next 7 Days      | `1f63c6e7dd2280649133000c99a2abbc`       |
| Tomorrow         | `1f63c6e7dd2280418ffa000c04b59526`       |
| Today Habits     | `2063c6e7dd22807cb888000c88f5331d`       |
| All              | `1f63c6e7dd22819c9cfd000c4dbf65d2`       |
| Week             | `1f63c6e7dd2281479acc000c5d18af95`       |
| Month            | `1f63c6e7dd2281518e48000ce4341089`       |
| Scheduled        | `1f63c6e7dd22815d8d5d000c9784a09c`       |
| No Due           | `1f63c6e7dd22810c9b8b000c4e6251ca`       |
| Recurring        | `1f63c6e7dd22817e856e000cf2cd05ca`       |
| Active Projects  | `1f63c6e7dd228119be3e000c545d05b3`       |
| Active Content   | `1f63c6e7dd22818d9ba4000c7e5872c5`       |
| Done             | `1f63c6e7dd2281e89a75000cf303aafd`       |

Note: `Overdue` is not a Notion view — it's a client-side filter on the
`Today` data source (`Due < today`). Keep `enterOverdue` as a derived list
from `state.todayTasks`, no separate view ID.

### Still need to fetch

Only view IDs matter (the `v=…` value from each Notion submenu URL). Page IDs
are irrelevant — they identify the dashboard page that hosts the linked DB
view, not the view itself.

| Domain   | View name   | View ID |
|----------|-------------|---------|
|          |             | _all done_ |

### How to fetch a view's filter/sort config

Once `kilo_code` has access to a view, retrieve its filter and sort logic via
the **Views API** (note: this is a different endpoint from `/v1/data_sources/{id}`).
The Views endpoint exposes the saved view config (`filter`, `sorts`,
`quick_filters`, `configuration`).

```
POST https://api.notion.com/v1/views/{view_id}
```

```bash
# Curl
curl -sS "https://api.notion.com/v1/views/1f63c6e7dd228163aa74000c8101dfdf" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2026-03-11" \
  | jq '{id, name, data_source_id, parent, filter, sorts, quick_filters}'
```

```bash
# Postman
postman request 'https://api.notion.com/v1/views/1f63c6e7dd228163aa74000c8101dfdf' \
  --header 'Authorization: Bearer ntn_xxx' \
  --header 'Notion-Version: 2026-03-11'
```

**Live response for the Inbox view** (`1f63c6e7dd228163aa74000c8101dfdf`):

```json
{
  "object": "view",
  "id": "1f63c6e7-dd22-8163-aa74-000c8101dfdf",
  "parent": {
    "type": "database_id",
    "database_id": "1f63c6e7-dd22-810d-85cc-d1f4516dd1ac"
  },
  "data_source_id": "1f63c6e7-dd22-8112-8575-000be0f5cc06",
  "name": "Inbox",
  "type": "list",
  "filter": {
    "and": [
      { "property": "mO?c",  "status":   { "does_not_equal": "Complete" } },
      { "or":  [ { "property": "mvxY", "relation": { "is_empty": true } } ] },
      { "and": [
        { "property": "Mt_P", "select": { "does_not_equal": ["Do Next","Delegated","Someday"] } },
        { "property": "UAOD", "date":   { "is_empty": true } }
      ]}
    ]
  },
  "sorts": [ { "property": "wnds", "direction": "ascending" } ]
}
```

**Key fields to grab per view:**

| Field            | Purpose                                                            |
|------------------|--------------------------------------------------------------------|
| `name`           | Human label for logs/debug                                         |
| `data_source_id` | Pass this to `POST /v1/data_sources/{id}/query` to fetch rows      |
| `parent.database_id` | The dashboard page hosting this linked view (informational)     |
| `filter`         | Translate this 1:1 to the server-side Notion query filter          |
| `sorts`          | Translate this 1:1 to the server-side Notion query `sorts` array   |
| `quick_filters`  | Optional UI filters shown in Notion — usually ignore for server    |
| `configuration.properties` | Which columns are visible — ignore for server (we render our own) |

**Server implementation note:** instead of hand-translating each view's
filter JSON into hardcoded TypeScript predicates, store the raw
`{ filter, sorts }` config from the Views API and forward it verbatim into
the Notion SDK's `databases.query({ filter, sorts })` (or
`dataSources.query({ filter, sorts })` for the new API). One generic
endpoint covers all 30 views across all 4 databases.

```ts
// server/index.ts (sketch)
const VIEWS: Record<string, { db: string; viewId: string }> = {
  'inbox':           { db: 'NOTION_TASKS_DB',    viewId: '1f63c6e7dd228163aa74000c8101dfdf' },
  // …
}

app.get('/api/:domain/:view', async (req, res) => {
  const cfg = VIEWS[`${req.params.domain}-${req.params.view}`]
  const view = await notion.views.retrieve({ view_id: cfg.viewId })  // caches filter/sorts
  const rows = await notion.dataSources.query({
    data_source_id: view.data_source_id,
    filter: view.filter,
    sorts: view.sorts,
  })
  res.json({ [req.params.domain]: rows.results.map(toResult) })
})
```

**Notion-Version header:** use `2026-03-11` (or newer) for the Views
endpoint. Older versions (`2022-06-28`, `2025-09-03`) don't expose
`/v1/views/{id}`.

---


## Appendix: Resolved View Filters (from Notion Views API)

Every view ID below was fetched via `GET https://api.notion.com/v1/views/{view_id}` (header `Notion-Version: 2026-03-11`), then each view's `filter`/`sorts` had its obfuscated property IDs (e.g. `mO?c`) resolved to human-readable names (e.g. `Status`) by cross-referencing `GET /v1/data_sources/{data_source_id}` for each of the 4 databases. These are the exact, verified filter/sort configs — use them verbatim in `databases.query({ filter, sorts })` / `dataSources.query({ filter, sorts })`.

**Correction (found while debugging Today/Overdue showing wrong tasks):** the
original resolution mistook the `status` property's *group* labels for real
option values in two places. Verified via `GET /v1/databases/{id}` against
the live Tasks and Projects databases — a status property's `status.options`
array holds the actual selectable values; `status.groups` are just display
categories (e.g. Notion's built-in "To-do / In Progress / Complete" buckets)
that don't exist as filterable option strings themselves:
- Tasks status only has options `To Do` / `Doing` / `Done` — every
  `"Complete"` below (the group wrapping `Done`) has been corrected to
  `"Done"`.
- Projects status only has options `Planned` / `On Hold` / `Doing` /
  `Ongoing` / `Done` — Active's `"In progress"` (the group wrapping
  `Doing`+`Ongoing`) has been corrected to an OR of both.

### Tasks

#### Tasks → Inbox
- View ID: `1f63c6e7dd228163aa74000c8101dfdf`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "or": [
        {
          "property": "Project",
          "relation": {
            "is_empty": true
          }
        }
      ]
    },
    {
      "and": [
        {
          "property": "Smart List",
          "select": {
            "does_not_equal": [
              "Do Next",
              "Delegated",
              "Someday"
            ]
          }
        },
        {
          "property": "Snooze",
          "date": {
            "is_empty": true
          }
        }
      ]
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Created",
    "direction": "ascending"
  }
]
```

#### Tasks → Today
- View ID: `1f63c6e7dd22814eada0000c2807038b`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "on_or_before": "today"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Project",
    "direction": "ascending"
  },
  {
    "property": "Name",
    "direction": "ascending"
  }
]
```

#### Tasks → @Didomi
- View ID: `1fa3c6e7dd228071a8d4000c7cc1a1d4`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "on_or_before": "today"
      }
    },
    {
      "property": "Project",
      "relation": {
        "contains": "1f63c6e7-dd22-8096-80dc-d0b48dba4ff2"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Project",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → @Mediato
- View ID: `1fa3c6e7dd228070a320000ca3fd4c5b`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "on_or_before": "today"
      }
    },
    {
      "property": "Project",
      "relation": {
        "contains": "1f63c6e7-dd22-80b7-8391-f6a43de34062"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Project",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → Next 7 Days
- View ID: `1f63c6e7dd2280649133000c99a2abbc`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "on_or_before": "one_week_from_now"
      }
    },
    {
      "property": "Project",
      "relation": {
        "does_not_contain": "2063c6e7-dd22-808b-9e0d-e6ee814d9442"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Project",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → Tomorrow
- View ID: `1f63c6e7dd2280418ffa000c04b59526`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "equals": "tomorrow"
      }
    },
    {
      "property": "Project",
      "relation": {
        "does_not_contain": "2063c6e7-dd22-808b-9e0d-e6ee814d9442"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Project",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → Today Habits
- View ID: `2063c6e7dd22807cb888000c88f5331d`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "on_or_before": "today"
      }
    },
    {
      "property": "Project",
      "relation": {
        "contains": "2063c6e7-dd22-808b-9e0d-e6ee814d9442"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Project",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → All
- View ID: `1f63c6e7dd22819c9cfd000c4dbf65d2`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "property": "Status",
  "status": {
    "does_not_equal": "Done"
  }
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  }
]
```

#### Tasks → Week
- View ID: `1f63c6e7dd2281479acc000c5d18af95`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `calendar`
- Filter: _none (calendar/board view with no row filter)_
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → Month
- View ID: `1f63c6e7dd2281518e48000ce4341089`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `calendar`
- Filter: _none (calendar/board view with no row filter)_
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → Scheduled
- View ID: `1f63c6e7dd22815d8d5d000c9784a09c`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "is_not_empty": true
      }
    },
    {
      "property": "Project",
      "relation": {
        "does_not_contain": "2063c6e7-dd22-808b-9e0d-e6ee814d9442"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → No Due
- View ID: `1f63c6e7dd22810c9b8b000c4e6251ca`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Due",
      "date": {
        "is_empty": true
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Edited",
    "direction": "descending"
  }
]
```

#### Tasks → Recurring
- View ID: `1f63c6e7dd22817e856e000cf2cd05ca`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "property": "Recur Interval",
  "number": {
    "greater_than_or_equal_to": 1
  }
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

#### Tasks → Active Projects
- View ID: `1f63c6e7dd228119be3e000c545d05b3`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Project Active",
      "formula": {
        "equals": true
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  }
]
```

#### Tasks → Active Content
- View ID: `1f63c6e7dd22818d9ba4000c7e5872c5`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    {
      "property": "Project Active",
      "formula": {
        "equals": true
      }
    },
    {
      "property": "Content",
      "relation": {
        "is_not_empty": true
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "ascending"
  }
]
```

#### Tasks → Done
- View ID: `1f63c6e7dd2281e89a75000cf303aafd`
- Data source ID: `1f63c6e7-dd22-8112-8575-000be0f5cc06`
- View type: `list`
- Filter:
```json
{
  "property": "Status",
  "status": {
    "equals": "Done"
  }
}
```
- Sorts:
```json
[
  {
    "property": "Due",
    "direction": "descending"
  },
  {
    "property": "Sub-Task Sorter",
    "direction": "ascending"
  }
]
```

---

### Notes

#### Notes → Inbox
- View ID: `1f63c6e7dd22817f9658000c6ca54bbf`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "and": [
        {
          "property": "Tag",
          "relation": {
            "is_empty": true
          }
        },
        {
          "property": "Project",
          "relation": {
            "is_empty": true
          }
        }
      ]
    },
    {
      "property": "Type",
      "select": {
        "does_not_equal": [
          "Daily",
          "Book",
          "Recipe",
          "Journal",
          "Meeting"
        ]
      }
    },
    {
      "property": "Content",
      "relation": {
        "is_empty": true
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

#### Notes → Fav.
- View ID: `1f63c6e7dd228177960d000cf537a0a8`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Favorite",
      "checkbox": {
        "equals": true
      }
    }
  ]
}
```
- Sorts: _none_

#### Notes → By Tag
- View ID: `20a3c6e7dd22804e9b36000cc777f3e9`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "does_not_equal": [
          "Journal",
          "Meeting",
          "Web Clip",
          "Daily"
        ]
      }
    },
    {
      "or": [
        {
          "property": "URL",
          "url": {
            "is_empty": true
          }
        },
        {
          "property": "Type",
          "select": {
            "equals": "Voice Note"
          }
        }
      ]
    },
    {
      "property": "Content",
      "relation": {
        "is_empty": true
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

#### Notes → Notes
- View ID: `1f63c6e7dd2281439930000c1e5c16e0`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "does_not_equal": [
          "Journal",
          "Meeting",
          "Web Clip",
          "Daily"
        ]
      }
    },
    {
      "or": [
        {
          "property": "URL",
          "url": {
            "is_empty": true
          }
        },
        {
          "property": "Type",
          "select": {
            "equals": "Voice Note"
          }
        }
      ]
    },
    {
      "property": "Content",
      "relation": {
        "is_empty": true
      }
    },
    {
      "or": [
        {
          "property": "Project",
          "relation": {
            "is_not_empty": true
          }
        },
        {
          "property": "Tag",
          "relation": {
            "is_not_empty": true
          }
        }
      ]
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

#### Notes → Meetings
- View ID: `1f63c6e7dd228150bc87000c71d7fc38`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "equals": "Meeting"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Note Date",
    "direction": "descending"
  }
]
```

#### Notes → By Project
- View ID: `20a3c6e7dd228069a07b000c58601134`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "does_not_equal": [
          "Journal",
          "Meeting",
          "Web Clip",
          "Daily"
        ]
      }
    },
    {
      "or": [
        {
          "property": "URL",
          "url": {
            "is_empty": true
          }
        },
        {
          "property": "Type",
          "select": {
            "equals": "Voice Note"
          }
        }
      ]
    },
    {
      "property": "Content",
      "relation": {
        "is_empty": true
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

#### Notes → Clips
- View ID: `1f63c6e7dd22814493c9000c21a4e246`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "does_not_equal": "Voice Note"
      }
    },
    {
      "or": [
        {
          "property": "URL",
          "url": {
            "is_not_empty": true
          }
        },
        {
          "property": "Type",
          "select": {
            "equals": "Web Clip"
          }
        }
      ]
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

#### Notes → Voice
- View ID: `1f63c6e7dd2281aea08a000ccadb8e97`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "equals": "Voice Note"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

#### Notes → Journal
- View ID: `1f63c6e7dd2281958950000c87ad8197`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Type",
      "select": {
        "equals": [
          "Daily",
          "Journal"
        ]
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Note Date",
    "direction": "descending"
  }
]
```

#### Notes → All
- View ID: `1f63c6e7dd2281428014000cfaf59bdf`
- Data source ID: `1f63c6e7-dd22-81a5-9b2a-000b1664d1cb`
- View type: `list`
- Filter:
```json
{
  "property": "Archived",
  "checkbox": {
    "equals": false
  }
}
```
- Sorts:
```json
[
  {
    "property": "Updated",
    "direction": "descending"
  }
]
```

---

### Projects

#### Projects → Active
- View ID: `1f63c6e7dd2281c0b8d5000c6a0be1b4`
- Data source ID: `1f63c6e7-dd22-81c8-99c2-000b060e663c`
- View type: `list`
- Filter — **corrected**: "In progress" is a status *group* label, not a
  real option (confirmed via `GET /v1/databases/{id}` on the Projects DB).
  The group's actual options are "Doing" and "Ongoing":
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "or": [
        { "property": "Status", "status": { "equals": "Doing" } },
        { "property": "Status", "status": { "equals": "Ongoing" } }
      ]
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Meta",
    "direction": "ascending"
  }
]
```

#### Projects → Planned
- View ID: `1f63c6e7dd228171bb66000cf84eef29`
- Data source ID: `1f63c6e7-dd22-81c8-99c2-000b060e663c`
- View type: `list`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Status",
      "status": {
        "equals": "Planned"
      }
    }
  ]
}
```
- Sorts:
```json
[
  {
    "property": "Meta",
    "direction": "ascending"
  }
]
```

#### Projects → Board
- View ID: `1f63c6e7dd22811d98f4000c7d097f60`
- Data source ID: `1f63c6e7-dd22-81c8-99c2-000b060e663c`
- View type: `board`
- Filter:
```json
{
  "property": "Archived",
  "checkbox": {
    "equals": false
  }
}
```
- Sorts:
```json
[
  {
    "property": "Target Deadline",
    "direction": "ascending"
  },
  {
    "property": "Latest Activity",
    "direction": "descending"
  }
]
```

#### Projects → Archived
- View ID: `22f3c6e7dd2280aba9d8000c2866f14d`
- Data source ID: `1f63c6e7-dd22-81c8-99c2-000b060e663c`
- View type: `table`
- Filter:
```json
{
  "property": "Archived",
  "checkbox": {
    "equals": true
  }
}
```
- Sorts:
```json
[
  {
    "property": "Latest Activity",
    "direction": "descending"
  }
]
```

---

### Tags

#### Tags → Recent
- View ID: `1f63c6e7dd22813cb84a000c221a121b`
- Data source ID: `1f63c6e7-dd22-81a8-89a9-000b73834059`
- View type: `list`
- Filter:
```json
{
  "property": "Archived",
  "checkbox": {
    "equals": false
  }
}
```
- Sorts:
```json
[
  {
    "property": "Latest Activity",
    "direction": "descending"
  }
]
```

#### Tags → Fav.
- View ID: `1f63c6e7dd2281848b2a000c4082d6b7`
- Data source ID: `1f63c6e7-dd22-81a8-89a9-000b73834059`
- View type: `gallery`
- Filter:
```json
{
  "and": [
    {
      "property": "Archived",
      "checkbox": {
        "equals": false
      }
    },
    {
      "property": "Favorite",
      "checkbox": {
        "equals": true
      }
    }
  ]
}
```
- Sorts: _none_

#### Tags → A-Z
- View ID: `1f63c6e7dd2281ecb86c000c4a49831a`
- Data source ID: `1f63c6e7-dd22-81a8-89a9-000b73834059`
- View type: `list`
- Filter:
```json
{
  "property": "Archived",
  "checkbox": {
    "equals": false
  }
}
```
- Sorts:
```json
[
  {
    "property": "Name",
    "direction": "ascending"
  }
]
```

#### Tags → Types
- View ID: `1f63c6e7dd22814388fe000cd1880e0d`
- Data source ID: `1f63c6e7-dd22-81a8-89a9-000b73834059`
- View type: `list`
- Filter:
```json
{
  "property": "Archived",
  "checkbox": {
    "equals": false
  }
}
```
- Sorts:
```json
[
  {
    "property": "Name",
    "direction": "ascending"
  }
]
```

---
## Phase 2: Tasks Domain (16 views + 1 derived + 1 voice)

16 Notion views from the table above plus `Overdue` (derived client-side from
`Today`) plus `Add Task (Voice)` (already implemented).

### 2a. Server endpoints — `server/index.ts`

All use existing `NOTION_TASKS_DB`. Filter/sort logic for each view is
resolved and verified — see "Appendix: Resolved View Filters → Tasks" above
for the exact `filter`/`sorts` JSON to pass into `dataSources.query()`.

```
GET /api/tasks/inbox           → query data source 1f63c6e7dd228163aa74000c8101dfdf
GET /api/tasks/today           → query data source 1f63c6e7dd22814eada0000c2807038b
GET /api/tasks/didomi          → query data source 1fa3c6e7dd228071a8d4000c7cc1a1d4
GET /api/tasks/mediato         → query data source 1fa3c6e7dd228070a320000ca3fd4c5b
GET /api/tasks/next-7-days     → query data source 1f63c6e7dd2280649133000c99a2abbc
GET /api/tasks/tomorrow        → query data source 1f63c6e7dd2280418ffa000c04b59526
GET /api/tasks/today-habits    → query data source 2063c6e7dd22807cb888000c88f5331d
GET /api/tasks/all             → query data source 1f63c6e7dd22819c9cfd000c4dbf65d2
GET /api/tasks/week            → query data source 1f63c6e7dd2281479acc000c5d18af95
GET /api/tasks/month           → query data source 1f63c6e7dd2281518e48000ce4341089
GET /api/tasks/scheduled       → query data source 1f63c6e7dd22815d8d5d000c9784a09c
GET /api/tasks/no-due          → query data source 1f63c6e7dd22810c9b8b000c4e6251ca
GET /api/tasks/recurring       → query data source 1f63c6e7dd22817e856e000cf2cd05ca
GET /api/tasks/active-projects → query data source 1f63c6e7dd228119be3e000c545d05b3
GET /api/tasks/active-content  → query data source 1f63c6e7dd22818d9ba4000c7e5872c5
GET /api/tasks/done            → query data source 1f63c6e7dd2281e89a75000cf303aafd
```

Each returns `{ tasks: TaskResult[] }` using the existing `pageToTask()`
helper. `Overdue` is derived client-side from `todayTasks` (filter
`Due < today`), no separate endpoint.

### 2b. Client API — `src/api.ts`

```ts
fetchInboxTasks():         Promise<Task[]>
fetchTodayTasks():         Promise<Task[]>   // already exists
fetchDidomiTasks():        Promise<Task[]>
fetchMediatoTasks():       Promise<Task[]>
fetchNext7DaysTasks():     Promise<Task[]>
fetchTomorrowTasks():      Promise<Task[]>
fetchTodayHabitsTasks():   Promise<Task[]>
fetchAllTasks():           Promise<Task[]>
fetchWeekTasks():          Promise<Task[]>
fetchMonthTasks():         Promise<Task[]>
fetchScheduledTasks():     Promise<Task[]>
fetchNoDueTasks():         Promise<Task[]>
fetchRecurringTasks():     Promise<Task[]>
fetchActiveProjectsTasks(): Promise<Task[]>
fetchActiveContentTasks(): Promise<Task[]>
fetchDoneTasks():          Promise<Task[]>
```

### 2c. State — `src/state.ts`

Add to `Screen` union type:

```ts
| 'tasks-inbox'              // already routed
| 'tasks-today'              // already routed
| 'tasks-overdue'            // already routed (derived)
| 'tasks-didomi'
| 'tasks-mediato'
| 'tasks-next-7-days'
| 'tasks-tomorrow'
| 'tasks-today-habits'
| 'tasks-all'
| 'tasks-week'
| 'tasks-month'
| 'tasks-scheduled'
| 'tasks-no-due'
| 'tasks-recurring'
| 'tasks-active-projects'
| 'tasks-active-content'
| 'tasks-done'
| 'tasks-add-task'           // already exists
```

Add to `AppState`:

```ts
inboxTasks:           Task[]
todayTasks:           Task[]   // already exists
overdueTasks:         Task[]   // derived from todayTasks
didomiTasks:          Task[]
mediatoTasks:         Task[]
next7DaysTasks:       Task[]
tomorrowTasks:        Task[]
todayHabitsTasks:     Task[]
allTasks:             Task[]
weekTasks:            Task[]
monthTasks:           Task[]
scheduledTasks:       Task[]
noDueTasks:           Task[]
recurringTasks:       Task[]
activeProjectsTasks:  Task[]
activeContentTasks:   Task[]
doneTasks:            Task[]

// selected-index fields for each new list screen
inboxSelectedIndex:           number   // already exists
todaySelectedIndex:           number   // already exists
overdueSelectedIndex:         number   // already exists
didomiSelectedIndex:          number
mediatoSelectedIndex:         number
next7DaysSelectedIndex:       number
tomorrowSelectedIndex:        number
todayHabitsSelectedIndex:     number
allSelectedIndex:             number
weekSelectedIndex:            number
monthSelectedIndex:           number
scheduledSelectedIndex:       number
noDueSelectedIndex:           number
recurringSelectedIndex:       number
activeProjectsSelectedIndex:  number
activeContentSelectedIndex:   number
doneSelectedIndex:            number
```

### 2d. Context — `src/glasses/context.ts` + `src/glasses/types.ts`

Add `GlassCtx` entry points (same pattern as `enterToday`/`enterInbox`):

```ts
enterInbox():           void   // already exists
enterToday():           void   // already exists
enterOverdue():         void   // already exists (derived, no fetch)
enterDidomi():          void
enterMediato():         void
enterNext7Days():       void
enterTomorrow():        void
enterTodayHabits():     void
enterAll():             void
enterWeek():            void
enterMonth():           void
enterScheduled():       void
enterNoDue():           void
enterRecurring():       void
enterActiveProjects():  void
enterActiveContent():   void
enterDone():            void
```

Each follows the existing `enterOverdueOrToday` cache-then-fetch pattern:
1. Reset selected index → 0
2. Load cached tasks (new cache keys)
3. Navigate to screen
4. Start spinner + fetch fresh data
5. Stop spinner + re-render

`enterOverdue` stays as-is: it reuses `state.todayTasks` and derives the
filtered list client-side (no extra fetch, no new cache key).

### 2e. Screens — `src/glasses/screens/tasks/*.ts`

Existing files already in place for every view in the 16-row table. Replace
each `makeStubScreen(...)` body with a real implementation following the
existing `today.ts` / `inbox.ts` pattern:

```ts
// Example: src/glasses/screens/tasks/next-7-days.ts
display(state, nav) → {
  const tasks = getNext7DaysFlatTasks(state)
  if (state.loading && tasks.length === 0) → "Fetching…" text
  if (tasks.length === 0)                  → "No tasks" text
  else                                     → { mode: 'list', header, items }
}

action(action, nav, state, ctx) → {
  GO_BACK       → ctx.navigate('tasks-menu')
  SELECT_HIGHLIGHTED → (future: open detail)
}
```

Add helper functions to `shared.ts`:

```ts
getInboxFlatTasks(state):           Task[]   // state.inboxTasks
getTodayFlatTasks(state):           Task[]   // state.todayTasks
getOverdueFlatTasks(state):         Task[]   // derived: filter todayTasks
getDidomiFlatTasks(state):          Task[]   // state.didomiTasks
getMediatoFlatTasks(state):         Task[]   // state.mediatoTasks
getNext7DaysFlatTasks(state):       Task[]   // state.next7DaysTasks
getTomorrowFlatTasks(state):        Task[]   // state.tomorrowTasks
getTodayHabitsFlatTasks(state):     Task[]   // state.todayHabitsTasks
getAllFlatTasks(state):             Task[]   // state.allTasks
getWeekFlatTasks(state):            Task[]   // state.weekTasks
getMonthFlatTasks(state):           Task[]   // state.monthTasks
getScheduledFlatTasks(state):       Task[]   // state.scheduledTasks
getNoDueFlatTasks(state):           Task[]   // state.noDueTasks
getRecurringFlatTasks(state):       Task[]   // state.recurringTasks
getActiveProjectsFlatTasks(state):  Task[]   // state.activeProjectsTasks
getActiveContentFlatTasks(state):   Task[]   // state.activeContentTasks
getDoneFlatTasks(state):            Task[]   // state.doneTasks
```

### 2f. Router + Menu wiring

**`router.ts`** — register every screen in the `SCREENS` map.

**`tasks/menu.ts`** — wire targets for every item (existing order matches the
16-view list):

```ts
items: [
  { label: 'Today',           target: 'tasks-today' },
  { label: 'Overdue',         target: 'tasks-overdue' },          // derived, no view ID
  { label: 'Inbox',           target: 'tasks-inbox' },
  { label: '@Didomi',         target: 'tasks-didomi' },
  { label: '@Mediato',        target: 'tasks-mediato' },
  { label: 'Next 7 Days',     target: 'tasks-next-7-days' },
  { label: 'Tomorrow',        target: 'tasks-tomorrow' },
  { label: 'Today Habits',    target: 'tasks-today-habits' },
  { label: 'All',             target: 'tasks-all' },
  { label: 'Week',            target: 'tasks-week' },
  { label: 'Month',           target: 'tasks-month' },
  { label: 'Scheduled',       target: 'tasks-scheduled' },
  { label: 'No Due',          target: 'tasks-no-due' },
  { label: 'Recurring',       target: 'tasks-recurring' },
  { label: 'Active Projects', target: 'tasks-active-projects' },
  { label: 'Active Content',  target: 'tasks-active-content' },
  { label: 'Done',            target: 'tasks-done' },
  { label: 'Add Task (Voice)', target: 'tasks-add-task' },
]
```

**`tasks/menu.ts` `open()` router** — add cases for every target calling the
corresponding `ctx.enter*()` method. `enterOverdue` keeps its existing
client-side derivation; the rest trigger a fetch.

### 2g. Render — `src/glasses/render.ts`

Add `show*()` functions for each new screen (same pattern as `showOverdue`,
`showToday`, `showInbox`).

### 2h. Cache — `src/cache.ts`

Add cache keys for each new task list:

```ts
CACHE_KEY_INBOX
CACHE_KEY_TODAY            // already exists
CACHE_KEY_DIDOMI
CACHE_KEY_MEDIATO
CACHE_KEY_NEXT_7_DAYS
CACHE_KEY_TOMORROW
CACHE_KEY_TODAY_HABITS
CACHE_KEY_ALL
CACHE_KEY_WEEK
CACHE_KEY_MONTH
CACHE_KEY_SCHEDULED
CACHE_KEY_NO_DUE
CACHE_KEY_RECURRING
CACHE_KEY_ACTIVE_PROJECTS
CACHE_KEY_ACTIVE_CONTENT
CACHE_KEY_DONE
```

---

## Phase 3: Notes Domain (10 views)

All 10 view IDs from `v=…` in Notion URLs. Filter logic resolved — see
"Appendix: Resolved View Filters → Notes" above.

| View        | ID                                       |
|-------------|------------------------------------------|
| Inbox       | `1f63c6e7dd22817f9658000c6ca54bbf`       |
| Fav.        | `1f63c6e7dd228177960d000cf537a0a8`       |
| By Tag      | `20a3c6e7dd22804e9b36000cc777f3e9`       |
| Notes       | `1f63c6e7dd2281439930000c1e5c16e0`       |
| Meetings    | `1f63c6e7dd228150bc87000c71d7fc38`       |
| By Project  | `20a3c6e7dd228069a07b000c58601134`       |
| Clips       | `1f63c6e7dd22814493c9000c21a4e246`       |
| Voice       | `1f63c6e7dd2281aea08a000ccadb8e97`       |
| Journal     | `1f63c6e7dd2281958950000c87ad8197`       |
| All         | `1f63c6e7dd2281428014000cfaf59bdf`       |

### 3a. Server endpoints — `server/index.ts`

All use existing `NOTION_NOTES_DB`. Filter/sort logic for each view is
resolved and verified — see "Appendix: Resolved View Filters → Notes" above.

```
GET /api/notes/inbox       → query data source 1f63c6e7dd22817f9658000c6ca54bbf
GET /api/notes/favorites   → query data source 1f63c6e7dd228177960d000cf537a0a8
GET /api/notes/by-tag      → query data source 20a3c6e7dd22804e9b36000cc777f3e9
GET /api/notes/notes       → query data source 1f63c6e7dd2281439930000c1e5c16e0
GET /api/notes/meetings    → query data source 1f63c6e7dd228150bc87000c71d7fc38
GET /api/notes/by-project  → query data source 20a3c6e7dd228069a07b000c58601134
GET /api/notes/clips       → query data source 1f63c6e7dd22814493c9000c21a4e246
GET /api/notes/voice       → query data source 1f63c6e7dd2281aea08a000ccadb8e97
GET /api/notes/journal     → query data source 1f63c6e7dd2281958950000c87ad8197
GET /api/notes/all         → query data source 1f63c6e7dd2281428014000cfaf59bdf
```

Each returns `{ notes: NoteResult[] }` with a new `pageToNote()` helper
extracting `id`, `name`, `icon?`, `lastEdited?`.

### 3b. Types

```ts
// server/index.ts
interface NoteResult { id: string; name: string }

// src/state.ts
export interface Note { id: string; name: string }
```

### 3c. Client API — `src/api.ts`

```ts
fetchInboxNotes():       Promise<Note[]>
fetchFavoriteNotes():    Promise<Note[]>
fetchByTagNotes():       Promise<Note[]>
fetchNotes():            Promise<Note[]>
fetchMeetingNotes():     Promise<Note[]>
fetchByProjectNotes():   Promise<Note[]>
fetchClipsNotes():       Promise<Note[]>
fetchVoiceNotes():       Promise<Note[]>
fetchJournalNotes():     Promise<Note[]>
fetchAllNotes():         Promise<Note[]>
```

### 3d. State — `src/state.ts`

Add to `Screen`:

```ts
| 'notes-inbox'
| 'notes-favorites'
| 'notes-by-tag'
| 'notes-list'
| 'notes-meetings'
| 'notes-by-project'
| 'notes-clips'
| 'notes-voice'
| 'notes-journal'
| 'notes-all'
```

Add to `AppState`:

```ts
inboxNotes:         Note[]
favoriteNotes:      Note[]
byTagNotes:         Note[]
notes:              Note[]
meetingNotes:       Note[]
byProjectNotes:     Note[]
clipsNotes:         Note[]
voiceNotes:         Note[]
journalNotes:       Note[]
allNotes:           Note[]

notesInboxSelectedIndex:        number
notesFavoritesSelectedIndex:    number
notesByTagSelectedIndex:        number
notesSelectedIndex:             number
notesMeetingsSelectedIndex:     number
notesByProjectSelectedIndex:    number
notesClipsSelectedIndex:        number
notesVoiceSelectedIndex:        number
notesJournalSelectedIndex:      number
notesAllSelectedIndex:          number
```

### 3e. Context, Screens, Router, Menu, Render, Cache

Same pattern as Tasks (Phase 2d–2h) adapted for Notes domain.

**`notes/menu.ts`** — wire targets (10 entries, order matches the Notion
submenu screenshot):

```ts
items: [
  { label: 'Inbox',      target: 'notes-inbox' },
  { label: 'Fav.',       target: 'notes-favorites' },
  { label: 'By Tag',     target: 'notes-by-tag' },
  { label: 'Notes',      target: 'notes-list' },
  { label: 'Meetings',   target: 'notes-meetings' },
  { label: 'By Project', target: 'notes-by-project' },
  { label: 'Clips',      target: 'notes-clips' },
  { label: 'Voice',      target: 'notes-voice' },
  { label: 'Journal',    target: 'notes-journal' },
  { label: 'All',        target: 'notes-all' },
]
```

**`notes/menu.ts` `open()` router** — add cases for every target calling the
corresponding `ctx.enter*()` method.

---

## Phase 4: Projects Domain (4 views)

All 4 view IDs from `v=…` in Notion URLs. Filter logic resolved — see
"Appendix: Resolved View Filters → Projects" above.

| View     | ID                                       |
|----------|------------------------------------------|
| Active   | `1f63c6e7dd2281c0b8d5000c6a0be1b4`       |
| Planned  | `1f63c6e7dd228171bb66000cf84eef29`       |
| Board    | `1f63c6e7dd22811d98f4000c7d097f60`       |
| Archived | `22f3c6e7dd2280aba9d8000c2866f14d`       |

### 4a. Server endpoints — `server/index.ts`

All use existing `NOTION_PROJECTS_DB`. Filter/sort logic for each view is
resolved and verified — see "Appendix: Resolved View Filters → Projects" above.

```
GET /api/projects/active    → query data source 1f63c6e7dd2281c0b8d5000c6a0be1b4
GET /api/projects/planned   → query data source 1f63c6e7dd228171bb66000cf84eef29
GET /api/projects/board     → query data source 1f63c6e7dd22811d98f4000c7d097f60
GET /api/projects/archived  → query data source 22f3c6e7dd2280aba9d8000c2866f14d
```

Returns `{ projects: ProjectResult[] }` with `pageToProject()`.

### 4b. Types

```ts
interface ProjectResult { id: string; name: string; status?: string }
export interface Project { id: string; name: string; status?: string }
```

### 4c–4e. Client API, State, Context, Screens, Router, Menu, Render, Cache

Same pattern. Screen names: `'projects-active'`, `'projects-planned'`,
`'projects-board'`, `'projects-archived'`.

**`projects/menu.ts`** — wire targets (4 entries, order matches the Notion
submenu screenshot):

```ts
items: [
  { label: 'Active',   target: 'projects-active' },
  { label: 'Planned',  target: 'projects-planned' },
  { label: 'Board',    target: 'projects-board' },
  { label: 'Archived', target: 'projects-archived' },
]
```

**`projects/menu.ts` `open()` router** — add cases for every target calling
the corresponding `ctx.enter*()` method.

---

## Phase 5: Tags Domain (4 views)

All 4 view IDs from `v=…` in Notion URLs. Filter logic resolved — see
"Appendix: Resolved View Filters → Tags" above.

| View   | ID                                       |
|--------|------------------------------------------|
| Recent | `1f63c6e7dd22813cb84a000c221a121b`       |
| Fav.   | `1f63c6e7dd2281848b2a000c4082d6b7`       |
| A-Z    | `1f63c6e7dd2281ecb86c000c4a49831a`       |
| Types  | `1f63c6e7dd22814388fe000cd1880e0d`       |

### 5a. Server endpoints — `server/index.ts`

All use existing `NOTION_TAGS_DB`. Filter/sort logic for each view is
resolved and verified — see "Appendix: Resolved View Filters → Tags" above.

```
GET /api/tags/recent    → query data source 1f63c6e7dd22813cb84a000c221a121b
GET /api/tags/favorites → query data source 1f63c6e7dd2281848b2a000c4082d6b7
GET /api/tags/a-z       → query data source 1f63c6e7dd2281ecb86c000c4a49831a
GET /api/tags/types     → query data source 1f63c6e7dd22814388fe000cd1880e0d
```

Returns `{ tags: TagResult[] }` with `pageToTag()`.

### 5b. Types

```ts
interface TagResult { id: string; name: string }
export interface Tag { id: string; name: string }
```

### 5c–5e. Client API, State, Context, Screens, Router, Menu, Render, Cache

Same pattern. Screen names: `'tags-recent'`, `'tags-favorites'`,
`'tags-a-z'`, `'tags-types'`.

**`tags/menu.ts`** — wire targets (4 entries, order matches the Notion
submenu screenshot):

```ts
items: [
  { label: 'Recent', target: 'tags-recent' },
  { label: 'Fav.',   target: 'tags-favorites' },
  { label: 'A-Z',    target: 'tags-a-z' },
  { label: 'Types',  target: 'tags-types' },
]
```

**`tags/menu.ts` `open()` router** — add cases for every target calling the
corresponding `ctx.enter*()` method.

---

## Phase 6: Refine Inbox Filter

✅ **Resolved** — the Inbox filter is now known from the live Views API
response (`1f63c6e7dd228163aa74000c8101dfdf`):

```json
{
  "and": [
    { "property": "Status",  "status":   { "does_not_equal": "Complete" } },
    { "or":  [ { "property": "Project", "relation": { "is_empty": true } } ] },
    { "and": [
      { "property": "Smart List", "select": { "does_not_equal": ["Do Next","Delegated","Someday"] } },
      { "property": "Snooze",     "date":   { "is_empty": true } }
    ]}
  ]
}
```

The property IDs (`mO?c`, `mvxY`, `Mt_P`, `UAOD`) have already been resolved
against the Tasks data source schema (`GET /v1/data_sources/{id}`) to their
human-readable names — `Status`, `Project`, `Smart List`, `Snooze`
respectively. See "Appendix: Resolved View Filters → Tasks → Inbox" for the
fully-resolved filter/sorts JSON, ready to pass straight into
`dataSources.query({ filter, sorts })` (the Notion SDK accepts either the
raw property ID or the resolved name).

Phase 6 is done: the resolved filter above matches the intended Inbox
semantics (not done, no project, not on a "Do Next/Delegated/Someday" smart
list, not snoozed). The old hand-written server predicate
(`Project.is_empty AND Status.does_not_equal('Done')`) should be replaced
with this exact filter — it was missing the Smart List and Snooze
conditions.

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `server/index.ts` | Add ~15 new endpoints, read new env vars, add `pageToNote`/`pageToProject`/`pageToTag` helpers |
| `src/api.ts` | Add ~15 new fetch functions |
| `src/state.ts` | Extend `Screen` union (18 new values), extend `AppState` (new arrays + selected indices), add `Note`/`Project`/`Tag` types |
| `src/glasses/types.ts` | Extend `GlassCtx` with new `enter*()` methods |
| `src/glasses/context.ts` | Implement new `enter*()` methods (cache-then-fetch pattern) |
| `src/glasses/router.ts` | Import and register 18 new screens |
| `src/glasses/render.ts` | Add `show*()` functions for each new screen |
| `src/glasses/screens/shared.ts` | Add getter helpers for each new task/note/project/tag list |
| `src/glasses/screens/tasks/menu.ts` | Add `target` to 7 items, add cases to `open()` |
| `src/glasses/screens/notes/menu.ts` | Add `target` to 5 items, add `open()` router |
| `src/glasses/screens/projects/menu.ts` | Add `target` to 3 items, add `open()` router |
| `src/glasses/screens/tags/menu.ts` | Add `target` to 3 items, add `open()` router |
| `src/glasses/screens/tasks/*.ts` (16 files) | Replace `makeStubScreen` with real implementation (all 16 views + overdue derived + add-task) |
| `src/glasses/screens/notes/*.ts` (10 files) | Replace `makeStubScreen` with real implementation |
| `src/glasses/screens/projects/*.ts` (4 files) | Replace `makeStubScreen` with real implementation |
| `src/glasses/screens/tags/*.ts` (4 files) | Replace `makeStubScreen` with real implementation |
| `src/cache.ts` | Add cache keys for all new lists |
| `.env` / `.env.example` | Already done — all 4 DB IDs present |

---

## Order of Execution

1. **Phase 1** — Fetch remaining Notion views (Notes, Projects, Tags) to lock
   down exact filters before writing server code.
2. **Phase 2** — Tasks (largest domain, most infrastructure exists, filters known).
3. **Phase 3** — Notes.
4. **Phase 4** — Projects.
5. **Phase 5** — Tags.
6. **Phase 6** — Inbox filter refinement.

Each phase is a self-contained, testable unit.
