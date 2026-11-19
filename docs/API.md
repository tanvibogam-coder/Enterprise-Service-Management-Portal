# REST API Documentation

Base URL: `http://localhost:5000/api` · JSON unless noted · Auth: `Authorization: Bearer <token>`

**Error format:** `{ "message": "...", "errors": { "field": "..." } }`
**Status codes:** `200` OK · `201` created · `400` bad request / invalid status transition · `401` not logged in / bad token · `403` not permitted · `404` not found · `409` duplicate (email) · `422` validation failed · `429` too many login attempts · `500` server error

## Auth
| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | public | `name, email, password` → creates an Employee, returns `{token,user}` |
| POST | `/auth/login` | public | `email, password` → `{token,user}` |
| GET | `/auth/me` | any | current user |
| POST | `/auth/logout` | any | client discards the token |

## Lookups
| GET | `/departments` | public | list of departments |
|---|---|---|---|

## Users
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/users/agents?department_id=` | admin, agent | active agents with current `workload` |
| GET | `/users?q=&role=` | admin | list users |
| POST | `/users` | admin | `name,email,password,role,department_id` (agents require a department) |
| PATCH | `/users/:id` | admin | any of `name,email,role,department_id,is_active,password`; cannot demote/disable self |

## Service requests
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/requests` | any (scoped by role) | query: `q,status,priority,department_id,category,from,to,overdue=1,mine=1,sort,order,page,limit` · sort ∈ `created_at,due_date,title,request_no,status,priority` · returns `{data,pagination}` |
| POST | `/requests` | any | `multipart/form-data`: `title,description,department_id,category,priority,attachments[]` (≤5 files, 5 MB) → auto-assigns |
| GET | `/requests/:id` | owner / dept agent / assignee / admin | request + attachments, comments, assignments, timeline, `permissions` |
| PUT | `/requests/:id` | see rules | any of `title,description,category` (owner while Open/Assigned, admin), `priority` (+owner, assignee), `due_date` (assignee, admin), `department_id` (admin; re-routes) |
| PATCH | `/requests/:id/status` | see workflow | `status, note?` → `400` for invalid transitions, `403` for disallowed role |
| PATCH | `/requests/:id/assign` | admin, agent | `assigned_to, note?` · agent must belong to the request department; agents can only take unassigned requests of their own department |
| POST | `/requests/:id/comments` | anyone with access | `comment` |
| POST | `/requests/:id/attachments` | anyone with access | multipart `attachments[]` |
| GET | `/requests/:id/attachments/:attId` | anyone with access | file download |
| DELETE | `/requests/:id` | admin; owner while Open/Assigned | |
| GET | `/requests/export/csv` | admin, agent | same filters as the list; returns `text/csv` |

## Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?page=&limit=&unread=1` | own notifications |
| GET | `/notifications/unread-count` | `{count}` |
| PATCH | `/notifications/:id/read` | |
| PATCH | `/notifications/read-all` | |

## Dashboard
| GET | `/dashboard/summary?from=&to=&department_id=` | any (scoped) | `totals` (total, open, assigned, in_progress, resolved, closed, overdue, avg_resolution_hours), `byDepartment`, `byPriority`, `byStatus`, `overdueList`, `agentWorkload` (admin only) |
|---|---|---|---|

## Health
`GET /health` → `{status:"ok"}`
