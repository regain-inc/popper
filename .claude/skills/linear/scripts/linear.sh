#!/bin/bash

# Linear API Script - Lightweight replacement for Linear MCP
# Saves ~33k tokens of context

set -e

API_URL="https://api.linear.app/graphql"

if [ -z "$LINEAR_API_KEY" ]; then
    echo '{"error": "LINEAR_API_KEY not set. Get your key at https://linear.app/settings/api"}'
    exit 1
fi

graphql() {
    local query="$1"
    curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_KEY" \
        -d "$query"
}

cmd_my_issues() {
    graphql '{
        "query": "query { viewer { assignedIssues(first: 50) { nodes { identifier title state { name } priority priorityLabel project { name } cycle { name number } url } } } }"
    }' | jq '.data.viewer.assignedIssues.nodes | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, project: .project.name, cycle: .cycle.name, url: .url})'
}

cmd_search() {
    local query="$1"
    graphql "{
        \"query\": \"query { issueSearch(first: 25, query: \\\"$query\\\") { nodes { identifier title state { name } priority priorityLabel assignee { name } url } } }\"
    }" | jq '(.data.issueSearch.nodes // []) | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, assignee: .assignee.name, url: .url})'
}

cmd_team_issues() {
    local team="$1"
    local limit="${2:-50}"

    # Get team ID first
    local team_id=$(graphql "{
        \"query\": \"query { teams(filter: { name: { containsIgnoreCase: \\\"$team\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.teams.nodes[0].id')

    if [ "$team_id" = "null" ] || [ -z "$team_id" ]; then
        echo '{"error": "Team not found"}'
        exit 1
    fi

    graphql "{
        \"query\": \"query { team(id: \\\"$team_id\\\") { issues(first: $limit) { nodes { identifier title state { name } priority priorityLabel assignee { name } project { name } url createdAt } } } }\"
    }" | jq '(.data.team.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, assignee: .assignee.name, project: .project.name, url: .url, created: .createdAt})'
}

cmd_all_issues() {
    local limit="${1:-50}"

    # Get all issues across all teams in one query
    graphql "{
        \"query\": \"query { issues(first: $limit) { nodes { identifier title state { name } priority priorityLabel assignee { name } team { name key } project { name } url createdAt } } }\"
    }" | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, assignee: .assignee.name, team: .team.name, project: .project.name, url: .url, created: .createdAt})'
}

# ============================================
# CTO DASHBOARD COMMANDS
# ============================================

# Resolve team member aliases to the actual name/email in Linear
# Based on Linear users API: some have actual names, others have email as name
resolve_member_name() {
    local input=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    case "$input" in
        anton|антон|kim) echo "kim.anton" ;;         # name: "kim.anton@gmail.com" (CEO)
        davr|давр|davron) echo "Davron" ;;           # name: "Davron Yuldashev"
        ania|аня|ания|anna) echo "aniashevtsova" ;;  # name: "aniashevtsova@gmail.com"
        harsh|харш) echo "Harsh" ;;                  # name: "Harsh Manwani"
        katya|катя|kate) echo "katya.rsh" ;;         # name: "katya.rsh@gmail.com"
        *) echo "$input" ;;  # Return as-is if no alias match
    esac
}

cmd_status() {
    # Status breakdown - count issues by state
    graphql '{
        "query": "query { issues(first: 200) { nodes { state { name } } } }"
    }' | jq '(.data.issues.nodes // []) | group_by(.state.name) | map({status: .[0].state.name, count: length}) | sort_by(-.count)'
}

cmd_workload() {
    # Who's working on what - issues grouped by assignee
    # Linear API max is 250 per query
    graphql '{
        "query": "query { issues(first: 250) { nodes { assignee { name } state { name } identifier title } } }"
    }' | jq '
        (.data.issues.nodes // [])
        | group_by((.assignee.name // "Unassigned"))
        | map({
            assignee: (.[0].assignee.name // "Unassigned"),
            total: length,
            in_progress: [.[] | select(.state.name == "In Progress")] | length,
            issues: [.[] | {id: .identifier, title: .title, status: .state.name}] | .[0:10]
        })
        | sort_by(-.total)
    '
}

cmd_blocked() {
    # Blocked issues - status "Blocked" or has blocker label
    graphql '{
        "query": "query { issues(first: 100, filter: { state: { name: { containsIgnoreCase: \"blocked\" } } }) { nodes { identifier title state { name } assignee { name } priority priorityLabel url } } }"
    }' | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, assignee: .assignee.name, priority: .priorityLabel, url: .url})'
}

cmd_urgent() {
    # Urgent/High priority issues
    graphql '{
        "query": "query { issues(first: 50, filter: { priority: { in: [1, 2] } }) { nodes { identifier title state { name } assignee { name } priorityLabel url } } }"
    }' | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, assignee: .assignee.name, priority: .priorityLabel, url: .url})'
}

cmd_cycle_status() {
    local team="${1:-Salomatic}"

    # Get team ID first
    local team_id=$(graphql "{
        \"query\": \"query { teams(filter: { name: { containsIgnoreCase: \\\"$team\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.teams.nodes[0].id')

    if [ "$team_id" = "null" ] || [ -z "$team_id" ]; then
        echo '{"error": "Team not found"}'
        exit 1
    fi

    # Get active cycle with issue stats
    graphql "{
        \"query\": \"query { team(id: \\\"$team_id\\\") { activeCycle { id name number startsAt endsAt issues { nodes { state { name } } } } } }\"
    }" | jq '
        .data.team.activeCycle as $cycle |
        if $cycle then
            {
                cycle: $cycle.name,
                number: $cycle.number,
                starts: $cycle.startsAt,
                ends: $cycle.endsAt,
                total: ($cycle.issues.nodes | length),
                completed: ([$cycle.issues.nodes[] | select(.state.name == "Done" or .state.name == "Completed")] | length),
                in_progress: ([$cycle.issues.nodes[] | select(.state.name == "In Progress")] | length),
                progress_percent: (if ($cycle.issues.nodes | length) > 0 then (([$cycle.issues.nodes[] | select(.state.name == "Done" or .state.name == "Completed")] | length) * 100 / ($cycle.issues.nodes | length)) else 0 end)
            }
        else
            {"error": "No active cycle"}
        end
    '
}

cmd_recent() {
    local hours="${1:-24}"

    # Calculate timestamp for X hours ago
    local since=$(date -u -v-${hours}H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "$hours hours ago" +"%Y-%m-%dT%H:%M:%SZ")

    graphql "{
        \"query\": \"query { issues(first: 50, filter: { updatedAt: { gte: \\\"$since\\\" } }) { nodes { identifier title state { name } assignee { name } updatedAt url } } }\"
    }" | jq '(.data.issues.nodes // []) | sort_by(.updatedAt) | reverse | map({id: .identifier, title: .title, status: .state.name, assignee: .assignee.name, updated: .updatedAt, url: .url})'
}

cmd_unassigned() {
    # Issues without assignee
    graphql '{
        "query": "query { issues(first: 50, filter: { assignee: { null: true } }) { nodes { identifier title state { name } priorityLabel createdAt url } } }"
    }' | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, created: .createdAt, url: .url})'
}

cmd_member() {
    local name_input="$1"
    local project_filter="$2"
    local name=$(resolve_member_name "$name_input")

    # Build project filter if specified
    local project_condition=""
    if [ -n "$project_filter" ]; then
        project_condition=", project: { name: { containsIgnoreCase: \\\"$project_filter\\\" } }"
    fi

    # Search issues by assignee name (includes labels for phase filtering)
    graphql "{
        \"query\": \"query { issues(first: 100, filter: { assignee: { name: { containsIgnoreCase: \\\"$name\\\" } }$project_condition }) { nodes { identifier title state { name } priorityLabel project { name } labels { nodes { name } } url createdAt } } }\"
    }" | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, project: .project.name, labels: [.labels.nodes[]?.name], url: .url, created: .createdAt})'
}

cmd_project_issues() {
    local project="$1"
    local limit="${2:-100}"

    if [ -z "$project" ]; then
        echo '{"error": "Usage: project-issues <project-name> [limit]"}'
        exit 1
    fi

    graphql "{
        \"query\": \"query { issues(first: $limit, filter: { project: { name: { containsIgnoreCase: \\\"$project\\\" } } }) { nodes { identifier title state { name } priorityLabel assignee { name } labels { nodes { name } } url createdAt } } }\"
    }" | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, assignee: .assignee.name, labels: [.labels.nodes[]?.name], url: .url, created: .createdAt})'
}

cmd_project_member() {
    local project="$1"
    local name_input="$2"

    if [ -z "$project" ] || [ -z "$name_input" ]; then
        echo '{"error": "Usage: project-member <project-name> <member-name>"}'
        exit 1
    fi

    cmd_member "$name_input" "$project"
}

cmd_summary() {
    local team="${1:-Salomatic}"

    echo "{"
    echo "  \"status_breakdown\":"
    cmd_status
    echo ","
    echo "  \"workload\":"
    cmd_workload
    echo ","
    echo "  \"blocked\":"
    cmd_blocked
    echo ","
    echo "  \"urgent\":"
    cmd_urgent
    echo ","
    echo "  \"cycle\":"
    cmd_cycle_status "$team"
    echo "}"
}

# ============================================
# END CTO DASHBOARD COMMANDS
# ============================================

# Resolve POP-XXX to SAL-XXX by searching title
resolve_pop_id() {
    local input="$1"

    # If already SAL-XXX format, return as-is
    if [[ "$input" =~ ^SAL-[0-9]+$ ]]; then
        echo "$input"
        return
    fi

    # If POP-XXX format, search by title
    if [[ "$input" =~ ^POP-[0-9]+$ ]]; then
        local sal_id=$(graphql "{
            \"query\": \"query { issues(first: 1, filter: { title: { startsWith: \\\"$input:\\\" } }) { nodes { identifier } } }\"
        }" | jq -r '.data.issues.nodes[0].identifier // empty')

        if [ -n "$sal_id" ]; then
            echo "$sal_id"
            return
        fi
    fi

    # Fallback: return as-is
    echo "$input"
}

cmd_get() {
    local issue_id_input="$1"
    local issue_id=$(resolve_pop_id "$issue_id_input")

    graphql "{
        \"query\": \"query { issue(id: \\\"$issue_id\\\") { identifier title description state { name } priority priorityLabel assignee { name email } project { name } cycle { name number } labels { nodes { name } } comments { nodes { body user { name } createdAt } } url createdAt updatedAt } }\"
    }" | jq '.data.issue | {id: .identifier, title: .title, description: .description, status: .state.name, priority: .priorityLabel, assignee: .assignee, project: .project.name, cycle: .cycle, labels: [.labels.nodes[].name], comments: .comments.nodes, url: .url, created: .createdAt, updated: .updatedAt}'
}

cmd_create() {
    local team="$1"
    local title="$2"
    local description="${3:-}"
    local assignee="${4:-}"

    # Get team ID first
    local team_id=$(graphql "{
        \"query\": \"query { teams(filter: { name: { containsIgnoreCase: \\\"$team\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.teams.nodes[0].id')

    if [ "$team_id" = "null" ] || [ -z "$team_id" ]; then
        echo '{"error": "Team not found"}'
        exit 1
    fi

    # Get default project ID (Unified Health App)
    local project_id=$(graphql "{
        \"query\": \"query { projects(first: 50, filter: { name: { containsIgnoreCase: \\\"Unified Health App\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.projects.nodes[0].id')

    local project_input=""
    if [ "$project_id" != "null" ] && [ -n "$project_id" ]; then
        project_input=", projectId: \\\"$project_id\\\""
    fi

    # Escape special characters in title and description
    title=$(echo "$title" | sed 's/"/\\"/g' | sed 's/\n/\\n/g')
    description=$(echo "$description" | sed 's/"/\\"/g' | sed 's/\n/\\n/g')

    # Build input with optional assignee
    local assignee_input=""
    if [ -n "$assignee" ]; then
        local user_id=$(graphql "{
            \"query\": \"query { users { nodes { id name email displayName } } }\"
        }" | jq -r --arg q "$assignee" '[.data.users.nodes[] | select((.name | ascii_downcase | contains($q | ascii_downcase)) or (.email | ascii_downcase | contains($q | ascii_downcase)) or (.displayName | ascii_downcase | contains($q | ascii_downcase)))] | .[0].id')

        if [ "$user_id" != "null" ] && [ -n "$user_id" ]; then
            assignee_input=", assigneeId: \\\"$user_id\\\""
        fi
    fi

    graphql "{
        \"query\": \"mutation { issueCreate(input: { teamId: \\\"$team_id\\\", title: \\\"$title\\\", description: \\\"$description\\\"$assignee_input$project_input }) { success issue { identifier title url assignee { name } project { name } } } }\"
    }" | jq '.data.issueCreate | {success: .success, issue: {id: .issue.identifier, title: .issue.title, url: .issue.url, assignee: .issue.assignee.name, project: .issue.project.name}}'
}

cmd_update() {
    local issue_id_input="$1"
    local field="$2"
    local value="$3"

    # Resolve POP-XXX to SAL-XXX if needed
    local issue_id=$(resolve_pop_id "$issue_id_input")

    # Get issue UUID from identifier
    local issue_uuid=$(graphql "{
        \"query\": \"query { issue(id: \\\"$issue_id\\\") { id } }\"
    }" | jq -r '.data.issue.id')

    if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
        echo '{"error": "Issue not found"}'
        exit 1
    fi

    case "$field" in
        status|state)
            # Get state ID
            local state_id=$(graphql "{
                \"query\": \"query { workflowStates(filter: { name: { containsIgnoreCase: \\\"$value\\\" } }) { nodes { id name } } }\"
            }" | jq -r '.data.workflowStates.nodes[0].id')

            graphql "{
                \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { stateId: \\\"$state_id\\\" }) { success issue { identifier title state { name } } } }\"
            }" | jq '.data.issueUpdate'
            ;;
        priority)
            local priority_num
            case "$value" in
                urgent|Urgent|0) priority_num=1 ;;
                high|High|1) priority_num=2 ;;
                medium|Medium|normal|Normal|2) priority_num=3 ;;
                low|Low|3) priority_num=4 ;;
                none|None|4) priority_num=0 ;;
                *) priority_num="$value" ;;
            esac
            graphql "{
                \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { priority: $priority_num }) { success issue { identifier title priorityLabel } } }\"
            }" | jq '.data.issueUpdate'
            ;;
        title)
            value=$(echo "$value" | sed 's/"/\\"/g')
            graphql "{
                \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { title: \\\"$value\\\" }) { success issue { identifier title } } }\"
            }" | jq '.data.issueUpdate'
            ;;
        description)
            # Use jq to properly construct JSON with multiline description
            local query='mutation($id: String!, $desc: String!) { issueUpdate(id: $id, input: { description: $desc }) { success issue { identifier title } } }'
            local payload=$(jq -n --arg uuid "$issue_uuid" --arg desc "$value" --arg query "$query" '{
                query: $query,
                variables: { id: $uuid, desc: $desc }
            }')
            curl -s -X POST "$API_URL" \
                -H "Content-Type: application/json" \
                -H "Authorization: $LINEAR_API_KEY" \
                -d "$payload" | jq '.data.issueUpdate'
            ;;
        assignee)
            # Support "none" or "null" to unassign
            if [ "$value" = "none" ] || [ "$value" = "null" ] || [ "$value" = "unassign" ]; then
                graphql "{
                    \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { assigneeId: null }) { success issue { identifier title assignee { name } } } }\"
                }" | jq '.data.issueUpdate'
            else
                # Find user ID by name/email
                local user_id=$(graphql "{
                    \"query\": \"query { users { nodes { id name email displayName } } }\"
                }" | jq -r --arg q "$value" '.data.users.nodes | map(select(.name | ascii_downcase | contains($q | ascii_downcase)) // select(.email | ascii_downcase | contains($q | ascii_downcase)) // select(.displayName | ascii_downcase | contains($q | ascii_downcase))) | .[0].id')

                if [ "$user_id" = "null" ] || [ -z "$user_id" ]; then
                    echo '{"error": "User not found"}'
                    exit 1
                fi

                graphql "{
                    \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { assigneeId: \\\"$user_id\\\" }) { success issue { identifier title assignee { name } } } }\"
                }" | jq '.data.issueUpdate'
            fi
            ;;
        project)
            # Support "none" or "null" to remove from project
            if [ "$value" = "none" ] || [ "$value" = "null" ]; then
                graphql "{
                    \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { projectId: null }) { success issue { identifier title project { name } } } }\"
                }" | jq '.data.issueUpdate'
            else
                # Find project ID by name
                local project_id=$(graphql "{
                    \"query\": \"query { projects(first: 50, filter: { name: { containsIgnoreCase: \\\"$value\\\" } }) { nodes { id name } } }\"
                }" | jq -r '.data.projects.nodes[0].id')

                if [ "$project_id" = "null" ] || [ -z "$project_id" ]; then
                    echo "{\"error\": \"Project not found: $value\"}"
                    exit 1
                fi

                graphql "{
                    \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { projectId: \\\"$project_id\\\" }) { success issue { identifier title project { name } } } }\"
                }" | jq '.data.issueUpdate'
            fi
            ;;
        *)
            echo "{\"error\": \"Unknown field: $field. Use: status, priority, title, description, assignee, project\"}"
            exit 1
            ;;
    esac
}

cmd_comment() {
    local issue_id_input="$1"
    local body="$2"

    # Resolve POP-XXX to SAL-XXX if needed
    local issue_id=$(resolve_pop_id "$issue_id_input")

    # Get issue UUID
    local issue_uuid=$(graphql "{
        \"query\": \"query { issue(id: \\\"$issue_id\\\") { id } }\"
    }" | jq -r '.data.issue.id')

    if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
        echo '{"error": "Issue not found"}'
        exit 1
    fi

    # Use jq to properly construct JSON with multiline body (handles escaping)
    local query='mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success comment { id body } } }'
    local payload=$(jq -n --arg issueId "$issue_uuid" --arg body "$body" --arg query "$query" '{
        query: $query,
        variables: { issueId: $issueId, body: $body }
    }')

    curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_KEY" \
        -d "$payload" | jq '.data.commentCreate'
}

cmd_teams() {
    graphql '{
        "query": "query { teams { nodes { id key name description } } }"
    }' | jq '.data.teams.nodes | map({id: .id, key: .key, name: .name, description: .description})'
}

cmd_projects() {
    graphql '{
        "query": "query { projects(first: 50) { nodes { id name description state startDate targetDate lead { name } teams { nodes { name } } } } }"
    }' | jq '.data.projects.nodes | map({id: .id, name: .name, description: .description, state: .state, startDate: .startDate, targetDate: .targetDate, lead: .lead.name, teams: [.teams.nodes[].name]})'
}

cmd_cycles() {
    local team="$1"

    local team_id=$(graphql "{
        \"query\": \"query { teams(filter: { name: { containsIgnoreCase: \\\"$team\\\" } }) { nodes { id } } }\"
    }" | jq -r '.data.teams.nodes[0].id')

    graphql "{
        \"query\": \"query { team(id: \\\"$team_id\\\") { cycles { nodes { id number name startsAt endsAt } } } }\"
    }" | jq '.data.team.cycles.nodes | map({id: .id, number: .number, name: .name, starts: .startsAt, ends: .endsAt})'
}

cmd_labels() {
    graphql '{
        "query": "query { issueLabels(first: 100) { nodes { id name color } } }"
    }' | jq '.data.issueLabels.nodes | map({id: .id, name: .name, color: .color})'
}

cmd_users() {
    graphql '{
        "query": "query { users { nodes { id name email displayName } } }"
    }' | jq '.data.users.nodes | map({id: .id, name: .name, email: .email, displayName: .displayName})'
}

cmd_assigned_to() {
    local user_query="$1"

    # First find user ID by name/email
    local user_id=$(graphql "{
        \"query\": \"query { users { nodes { id name email displayName } } }\"
    }" | jq -r --arg q "$user_query" '.data.users.nodes | map(select(.name | ascii_downcase | contains($q | ascii_downcase)) // select(.email | ascii_downcase | contains($q | ascii_downcase)) // select(.displayName | ascii_downcase | contains($q | ascii_downcase))) | .[0].id')

    if [ "$user_id" = "null" ] || [ -z "$user_id" ]; then
        echo '{"error": "User not found"}'
        exit 1
    fi

    graphql "{
        \"query\": \"query { user(id: \\\"$user_id\\\") { name assignedIssues(first: 50) { nodes { identifier title state { name } priority priorityLabel project { name } url } } } }\"
    }" | jq '{user: .data.user.name, issues: [.data.user.assignedIssues.nodes[] | {id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, project: .project.name, url: .url}]}'
}

cmd_help() {
    cat << 'EOF'
Linear CLI - Lightweight Linear API client

USAGE:
    linear.sh <command> [arguments]

COMMANDS:
    my-issues                     List issues assigned to you
    all-issues [limit]            List ALL issues across all teams (default: 50)
    team-issues <team> [limit]    List ALL issues for a specific team
    project-issues <proj> [limit] List issues for a specific project (e.g., "Popper")
    project-member <proj> <name>  List member issues filtered by project
    search <query>                Search issues by text
    get <ISSUE-ID>                Get issue details (supports POP-XXX or SAL-XXX)
    get-with-context <ID>         Get issue with auto-injected context (spec, gotchas, patterns)
    create <team> <title> [desc]  Create new issue
    update <id> <field> <value>   Update issue (fields: status, priority, title, description)
    comment <id> <text>           Add comment to issue
    teams                         List all teams
    projects                      List all projects
    cycles <team>                 List cycles for a team
    labels                        List all labels
    users                         List all users
    help                          Show this help

  CTO DASHBOARD:
    status                        Issue count by status (Backlog, In Progress, Done...)
    workload                      Who's working on what (grouped by assignee)
    blocked                       List blocked issues
    urgent                        List urgent/high priority issues
    cycle-status [team]           Current sprint progress (default: Salomatic)
    recent [hours]                Recently updated issues (default: 24 hours)
    unassigned                    Issues without assignee
    member <name>                 Issues for team member (Davr, Rato, Ania, Harsh)
    summary [team]                Full CTO dashboard (combines above)

  SPRINT MANAGEMENT:
    cycle-create <team> <name> <starts> <ends>
                                  Create new sprint (dates: YYYY-MM-DD)
    cycle-update <id> <field> <value>
                                  Update sprint (fields: name, starts, ends, description)
    cycle-archive <id>            Archive/close a sprint
    cycle-add <issue> <cycle-id>  Add issue to sprint
    cycle-remove <issue>          Remove issue from sprint
    cycle-issues <cycle-id>       List all issues in a sprint
    cycle-setup-roadmap <team> <start-date>
                                  Bulk create 8 phases from project roadmap

  LABEL MANAGEMENT:
    label-create <name> [color]   Create new label (color: hex like #FF0000)
    label-add <issue> <label>     Add label to issue
    label-remove <issue> <label>  Remove label from issue

  PHASE COMMANDS:
    phase <number>                List issues in phase (1-8)
    phase-summary                 Phase breakdown with team matrix
    phase-labels-setup            Create all 8 phase labels (phase-1 to phase-8)
    phase-apply                   Auto-apply phase labels based on title prefix

  PROJECT & PHASE SYNC:
    sync-all                      Sync all tickets: assign to project + apply phase labels
    sync-project [name]           Assign all tickets to project (default: Unified Health App)
    sync-phases                   Apply phase labels from roadmap mapping

  STANDUP:
    standup-data <since> [user]   Get all standup data since date (YYYY-MM-DD)
                                  Returns: completed, in_progress, in_review,
                                  upcoming, and blocked issues
                                  Optional: filter by assignee name

EXAMPLES:
    linear.sh my-issues
    linear.sh assigned-to "Harsh"
    linear.sh search "login bug"
    linear.sh get PROJ-123
    linear.sh create "Engineering" "Fix login" "Users can't log in on mobile"
    linear.sh update PROJ-123 status "Done"
    linear.sh update PROJ-123 priority high
    linear.sh comment PROJ-123 "Fixed in commit abc123"

  Sprint Management:
    linear.sh cycle-create "Salomatic" "Sprint 1: Foundation" "2025-01-06" "2025-01-19"
    linear.sh cycle-update abc123 name "Sprint 1 - Extended"
    linear.sh cycle-add SAL-123 abc123
    linear.sh cycle-setup-roadmap "Salomatic" "2025-01-06"

  Standup:
    linear.sh standup-data "2025-12-27"                # All issues since Dec 27
    linear.sh standup-data "2025-12-27" "Rato"         # Rato's issues since Dec 27

ENVIRONMENT:
    LINEAR_API_KEY    Required. Get at https://linear.app/settings/api
EOF
}

# ============================================
# SPRINT MANAGEMENT COMMANDS
# ============================================

# Helper: Get team ID from name
get_team_id() {
    local team="$1"
    graphql "{
        \"query\": \"query { teams(filter: { name: { containsIgnoreCase: \\\"$team\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.teams.nodes[0].id'
}

# Helper: Get issue UUID from identifier (e.g., SAL-123 or POP-004)
get_issue_uuid() {
    local issue_id_input="$1"
    local issue_id=$(resolve_pop_id "$issue_id_input")

    graphql "{
        \"query\": \"query { issue(id: \\\"$issue_id\\\") { id } }\"
    }" | jq -r '.data.issue.id'
}

cmd_cycle_create() {
    local team="$1"
    local name="$2"
    local starts="$3"
    local ends="$4"

    if [ -z "$team" ] || [ -z "$name" ] || [ -z "$starts" ] || [ -z "$ends" ]; then
        echo '{"error": "Usage: cycle-create <team> <name> <starts-YYYY-MM-DD> <ends-YYYY-MM-DD>"}'
        exit 1
    fi

    # Validate dates are not in the past
    local today=$(date +%Y-%m-%d)
    if [[ "$ends" < "$today" ]]; then
        echo "{\"error\": \"End date $ends is in the past. Today is $today. Cycles cannot end in the past.\"}"
        exit 1
    fi

    # Get team ID
    local team_id=$(get_team_id "$team")

    if [ "$team_id" = "null" ] || [ -z "$team_id" ]; then
        echo '{"error": "Team not found"}'
        exit 1
    fi

    # Convert dates to ISO format with timezone
    local starts_iso="${starts}T00:00:00Z"
    local ends_iso="${ends}T23:59:59Z"

    # Escape name
    name=$(echo "$name" | sed 's/"/\\"/g')

    local response=$(graphql "{
        \"query\": \"mutation { cycleCreate(input: { teamId: \\\"$team_id\\\", name: \\\"$name\\\", startsAt: \\\"$starts_iso\\\", endsAt: \\\"$ends_iso\\\" }) { success cycle { id number name startsAt endsAt } } }\"
    }")

    # Check for errors in response
    local error_msg=$(echo "$response" | jq -r '.errors[0].extensions.userPresentableMessage // .errors[0].message // empty')
    if [ -n "$error_msg" ]; then
        echo "{\"error\": \"$error_msg\"}"
        exit 1
    fi

    echo "$response" | jq '.data.cycleCreate | {success: .success, cycle: {id: .cycle.id, number: .cycle.number, name: .cycle.name, starts: .cycle.startsAt, ends: .cycle.endsAt}}'
}

cmd_cycle_update() {
    local cycle_id="$1"
    local field="$2"
    local value="$3"

    if [ -z "$cycle_id" ] || [ -z "$field" ] || [ -z "$value" ]; then
        echo '{"error": "Usage: cycle-update <cycle-id> <field> <value>. Fields: name, starts, ends, description"}'
        exit 1
    fi

    case "$field" in
        name)
            value=$(echo "$value" | sed 's/"/\\"/g')
            graphql "{
                \"query\": \"mutation { cycleUpdate(id: \\\"$cycle_id\\\", input: { name: \\\"$value\\\" }) { success cycle { id number name } } }\"
            }" | jq '.data.cycleUpdate'
            ;;
        starts|startsAt)
            local starts_iso="${value}T00:00:00Z"
            graphql "{
                \"query\": \"mutation { cycleUpdate(id: \\\"$cycle_id\\\", input: { startsAt: \\\"$starts_iso\\\" }) { success cycle { id name startsAt } } }\"
            }" | jq '.data.cycleUpdate'
            ;;
        ends|endsAt)
            local ends_iso="${value}T23:59:59Z"
            graphql "{
                \"query\": \"mutation { cycleUpdate(id: \\\"$cycle_id\\\", input: { endsAt: \\\"$ends_iso\\\" }) { success cycle { id name endsAt } } }\"
            }" | jq '.data.cycleUpdate'
            ;;
        description)
            value=$(echo "$value" | sed 's/"/\\"/g' | sed 's/\n/\\n/g')
            graphql "{
                \"query\": \"mutation { cycleUpdate(id: \\\"$cycle_id\\\", input: { description: \\\"$value\\\" }) { success cycle { id name description } } }\"
            }" | jq '.data.cycleUpdate'
            ;;
        *)
            echo "{\"error\": \"Unknown field: $field. Use: name, starts, ends, description\"}"
            exit 1
            ;;
    esac
}

cmd_cycle_archive() {
    local cycle_id="$1"

    if [ -z "$cycle_id" ]; then
        echo '{"error": "Usage: cycle-archive <cycle-id>"}'
        exit 1
    fi

    graphql "{
        \"query\": \"mutation { cycleArchive(id: \\\"$cycle_id\\\") { success } }\"
    }" | jq '.data.cycleArchive'
}

cmd_cycle_add() {
    local issue_id="$1"
    local cycle_id="$2"

    if [ -z "$issue_id" ] || [ -z "$cycle_id" ]; then
        echo '{"error": "Usage: cycle-add <issue-id> <cycle-id>"}'
        exit 1
    fi

    # Get issue UUID from identifier
    local issue_uuid=$(get_issue_uuid "$issue_id")

    if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
        echo '{"error": "Issue not found"}'
        exit 1
    fi

    graphql "{
        \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { cycleId: \\\"$cycle_id\\\" }) { success issue { identifier title cycle { name number } } } }\"
    }" | jq '.data.issueUpdate | {success: .success, issue: {id: .issue.identifier, title: .issue.title, cycle: .issue.cycle.name}}'
}

cmd_cycle_remove() {
    local issue_id="$1"

    if [ -z "$issue_id" ]; then
        echo '{"error": "Usage: cycle-remove <issue-id>"}'
        exit 1
    fi

    # Get issue UUID from identifier
    local issue_uuid=$(get_issue_uuid "$issue_id")

    if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
        echo '{"error": "Issue not found"}'
        exit 1
    fi

    graphql "{
        \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { cycleId: null }) { success issue { identifier title } } }\"
    }" | jq '.data.issueUpdate | {success: .success, issue: {id: .issue.identifier, title: .issue.title, cycle: null}}'
}

cmd_cycle_issues() {
    local cycle_id="$1"

    if [ -z "$cycle_id" ]; then
        echo '{"error": "Usage: cycle-issues <cycle-id>"}'
        exit 1
    fi

    graphql "{
        \"query\": \"query { cycle(id: \\\"$cycle_id\\\") { id name number startsAt endsAt issues { nodes { identifier title state { name } assignee { name } priorityLabel } } } }\"
    }" | jq '{
        cycle: {
            id: .data.cycle.id,
            name: .data.cycle.name,
            number: .data.cycle.number,
            starts: .data.cycle.startsAt,
            ends: .data.cycle.endsAt
        },
        issues: [.data.cycle.issues.nodes[] | {id: .identifier, title: .title, status: .state.name, assignee: .assignee.name, priority: .priorityLabel}]
    }'
}

cmd_cycle_setup_roadmap() {
    local team="$1"
    local start_date="$2"

    if [ -z "$team" ] || [ -z "$start_date" ]; then
        echo '{"error": "Usage: cycle-setup-roadmap <team> <start-date-YYYY-MM-DD>"}'
        exit 1
    fi

    # Get team ID
    local team_id=$(get_team_id "$team")

    if [ "$team_id" = "null" ] || [ -z "$team_id" ]; then
        echo '{"error": "Team not found"}'
        exit 1
    fi

    # Define phases from roadmap (name|start_week|end_week)
    local phases=(
        "Phase 1: Foundation|1|2"
        "Phase 2: Core Data & AI|3|4"
        "Phase 3: MVP Polish|5|6"
        "Phase 4: Programs & Billing|7|8"
        "Phase 5: Launch|9|10"
        "Phase 6: Labs & Advanced|11|14"
        "Phase 7: Clinical Services|15|18"
        "Phase 8: Mini-Apps|19|22"
    )

    echo '{"phases": ['
    local first=true

    for phase in "${phases[@]}"; do
        local name=$(echo "$phase" | cut -d'|' -f1)
        local start_week=$(echo "$phase" | cut -d'|' -f2)
        local end_week=$(echo "$phase" | cut -d'|' -f3)

        # Calculate actual dates (macOS date command)
        # Start week offset: (start_week - 1) * 7 days
        local start_offset=$(( (start_week - 1) * 7 ))
        local end_offset=$(( end_week * 7 - 1 ))

        # macOS date calculation
        local phase_start=$(date -j -v+${start_offset}d -f "%Y-%m-%d" "$start_date" "+%Y-%m-%d" 2>/dev/null)
        local phase_end=$(date -j -v+${end_offset}d -f "%Y-%m-%d" "$start_date" "+%Y-%m-%d" 2>/dev/null)

        # Fallback for Linux
        if [ -z "$phase_start" ]; then
            phase_start=$(date -d "$start_date + $start_offset days" "+%Y-%m-%d" 2>/dev/null)
            phase_end=$(date -d "$start_date + $end_offset days" "+%Y-%m-%d" 2>/dev/null)
        fi

        # Create cycle
        local starts_iso="${phase_start}T00:00:00Z"
        local ends_iso="${phase_end}T23:59:59Z"

        local result=$(graphql "{
            \"query\": \"mutation { cycleCreate(input: { teamId: \\\"$team_id\\\", name: \\\"$name\\\", startsAt: \\\"$starts_iso\\\", endsAt: \\\"$ends_iso\\\" }) { success cycle { id number name startsAt endsAt } } }\"
        }")

        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi

        echo "$result" | jq -c '.data.cycleCreate | {name: .cycle.name, id: .cycle.id, starts: .cycle.startsAt, ends: .cycle.endsAt, success: .success}'
    done

    echo ']}'
}

# ============================================
# END SPRINT MANAGEMENT COMMANDS
# ============================================

# ============================================
# LABEL MANAGEMENT COMMANDS
# ============================================

cmd_label_create() {
    local name="$1"
    local color="${2:-#6B7280}"  # Default gray

    if [ -z "$name" ]; then
        echo '{"error": "Usage: label-create <name> [color-hex]"}'
        exit 1
    fi

    # Get team ID (labels are team-scoped in Linear)
    local team_id=$(get_team_id "Salomatic")

    graphql "{
        \"query\": \"mutation { issueLabelCreate(input: { name: \\\"$name\\\", color: \\\"$color\\\", teamId: \\\"$team_id\\\" }) { success issueLabel { id name color } } }\"
    }" | jq '.data.issueLabelCreate | {success: .success, label: {id: .issueLabel.id, name: .issueLabel.name, color: .issueLabel.color}}'
}

cmd_label_add() {
    local issue_id="$1"
    local label_name="$2"

    if [ -z "$issue_id" ] || [ -z "$label_name" ]; then
        echo '{"error": "Usage: label-add <issue-id> <label-name>"}'
        exit 1
    fi

    # Get label ID
    local label_id=$(graphql "{
        \"query\": \"query { issueLabels(filter: { name: { eq: \\\"$label_name\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.issueLabels.nodes[0].id')

    if [ "$label_id" = "null" ] || [ -z "$label_id" ]; then
        echo "{\"error\": \"Label not found: $label_name\"}"
        exit 1
    fi

    # Get current label IDs as JSON array
    local current_labels_json=$(graphql "{
        \"query\": \"query { issue(id: \\\"$issue_id\\\") { labels { nodes { id } } } }\"
    }" | jq -c '[.data.issue.labels.nodes[]?.id]')

    # Check if already has this label
    if echo "$current_labels_json" | jq -e "index(\"$label_id\")" > /dev/null 2>&1; then
        # Already has label, just return current state
        graphql "{
            \"query\": \"query { issue(id: \\\"$issue_id\\\") { identifier title labels { nodes { name } } } }\"
        }" | jq '.data.issue | {success: true, issue: {id: .identifier, title: .title, labels: [.labels.nodes[]?.name]}}'
        return
    fi

    # Add new label ID to array
    local all_labels_json=$(echo "$current_labels_json" | jq -c ". + [\"$label_id\"]")

    # Build mutation with proper JSON escaping
    local mutation="mutation { issueUpdate(id: \"$issue_id\", input: { labelIds: $all_labels_json }) { success issue { identifier title labels { nodes { name } } } } }"

    curl -s -X POST "https://api.linear.app/graphql" \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_KEY" \
        -d "$(jq -n --arg q "$mutation" '{query: $q}')" | \
    jq '.data.issueUpdate | {success: .success, issue: {id: .issue.identifier, title: .issue.title, labels: [.issue.labels.nodes[]?.name]}}'
}

cmd_label_remove() {
    local issue_id="$1"
    local label_name="$2"

    if [ -z "$issue_id" ] || [ -z "$label_name" ]; then
        echo '{"error": "Usage: label-remove <issue-id> <label-name>"}'
        exit 1
    fi

    # Get issue UUID
    local issue_uuid=$(get_issue_uuid "$issue_id")
    if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
        echo '{"error": "Issue not found"}'
        exit 1
    fi

    # Get label ID to remove
    local label_id=$(graphql "{
        \"query\": \"query { issueLabels(filter: { name: { eq: \\\"$label_name\\\" } }) { nodes { id } } }\"
    }" | jq -r '.data.issueLabels.nodes[0].id')

    # Get current labels, filter out the one to remove
    local remaining_labels=$(graphql "{
        \"query\": \"query { issue(id: \\\"$issue_id\\\") { labels { nodes { id } } } }\"
    }" | jq -r --arg remove "$label_id" '[.data.issue.labels.nodes[].id | select(. != $remove)] | map("\"" + . + "\"") | join(",")')

    graphql "{
        \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { labelIds: [$remaining_labels] }) { success issue { identifier labels { nodes { name } } } } }\"
    }" | jq '.data.issueUpdate | {success: .success, issue: {id: .issue.identifier, labels: [.issue.labels.nodes[].name]}}'
}

# ============================================
# LEGACY LABEL CLEANUP COMMANDS
# ============================================

cmd_remove_legacy_labels() {
    echo "========================================"
    echo "Removing Legacy Labels from All Tickets"
    echo "========================================"
    echo ""

    # Define legacy labels to remove
    local legacy_labels=("P0" "P1" "P2" "P3" "P4" "phi-service")

    local total_removed=0
    local total_errors=0

    for label_name in "${legacy_labels[@]}"; do
        echo "Processing label: $label_name"

        # Get label ID
        local label_id=$(graphql "{
            \"query\": \"query { issueLabels(filter: { name: { eq: \\\"$label_name\\\" } }) { nodes { id name } } }\"
        }" | jq -r '.data.issueLabels.nodes[0].id')

        if [ "$label_id" = "null" ] || [ -z "$label_id" ]; then
            echo "  Label '$label_name' not found, skipping"
            echo ""
            continue
        fi

        # Get all issues with this label
        local issues=$(graphql "{
            \"query\": \"query { issues(first: 250, filter: { labels: { id: { eq: \\\"$label_id\\\" } } }) { nodes { id identifier title } } }\"
        }" | jq -r '.data.issues.nodes[]?.identifier')

        if [ -z "$issues" ]; then
            echo "  No tickets found with label '$label_name'"
            echo ""
            continue
        fi

        local count=0
        local errors=0

        for issue_id in $issues; do
            # Get current labels, filter out the legacy one
            local remaining_labels=$(graphql "{
                \"query\": \"query { issue(id: \\\"$issue_id\\\") { id labels { nodes { id } } } }\"
            }" | jq -r --arg remove "$label_id" '[.data.issue.labels.nodes[]?.id | select(. != $remove)] | map("\"" + . + "\"") | join(",")')

            # Get issue UUID for mutation
            local issue_uuid=$(graphql "{
                \"query\": \"query { issue(id: \\\"$issue_id\\\") { id } }\"
            }" | jq -r '.data.issue.id')

            if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
                errors=$((errors + 1))
                echo "  ✗ $issue_id (not found)"
                continue
            fi

            # Update issue to remove label
            local result=$(graphql "{
                \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { labelIds: [$remaining_labels] }) { success } }\"
            }" | jq -r '.data.issueUpdate.success')

            if [ "$result" = "true" ]; then
                count=$((count + 1))
                echo "  ✓ $issue_id - removed $label_name"
            else
                errors=$((errors + 1))
                echo "  ✗ $issue_id (update failed)"
            fi
        done

        echo "  Removed from $count tickets, $errors errors"
        echo ""

        total_removed=$((total_removed + count))
        total_errors=$((total_errors + errors))
    done

    echo "========================================"
    echo "Summary:"
    echo "  Labels removed: $total_removed"
    echo "  Errors: $total_errors"
    echo "========================================"

    echo "{\"success\": true, \"labels_removed\": $total_removed, \"errors\": $total_errors}"
}

# ============================================
# PHASE COMMANDS
# ============================================

cmd_phase() {
    local phase_num="$1"
    local limit="${2:-100}"

    if [ -z "$phase_num" ]; then
        echo '{"error": "Usage: phase <phase-number> [limit]"}'
        exit 1
    fi

    # Query issues with phase label
    local label_name="phase-$phase_num"

    graphql "{
        \"query\": \"query { issues(first: $limit, filter: { labels: { name: { eq: \\\"$label_name\\\" } } }) { nodes { identifier title state { name } assignee { name } priorityLabel url } } }\"
    }" | jq '(.data.issues.nodes // []) | map({id: .identifier, title: .title, status: .state.name, assignee: .assignee.name, priority: .priorityLabel, url: .url})'
}

cmd_phase_summary() {
    # Get all issues with labels
    local all_issues=$(graphql '{
        "query": "query { issues(first: 250) { nodes { identifier title state { name } assignee { name } labels { nodes { name } } } } }"
    }')

    # Process with jq to create phase × member × status matrix
    echo "$all_issues" | jq '
        # Extract phase from labels (phase-1, phase-2, etc.)
        def get_phase:
            [.labels.nodes[].name | select(startswith("phase-"))] | first // "untagged";

        # Get assignee name or "Unassigned"
        def get_assignee:
            .assignee.name // "Unassigned";

        .data.issues.nodes
        | map({
            phase: get_phase,
            status: .state.name,
            assignee: get_assignee
        })
        | group_by(.phase)
        | map({
            phase: .[0].phase,
            total: length,
            backlog: [.[] | select(.status == "Backlog")] | length,
            in_progress: [.[] | select(.status == "In Progress")] | length,
            in_review: [.[] | select(.status == "In Review")] | length,
            done: [.[] | select(.status == "Done" or .status == "Completed")] | length,
            by_member: (group_by(.assignee) | map({
                name: .[0].assignee,
                count: length
            }) | sort_by(-.count))
        })
        | sort_by(.phase)
    '
}

cmd_phase_labels_setup() {
    # Create all 8 phase labels with distinct colors
    local phases=(
        "phase-1|#10B981"
        "phase-2|#3B82F6"
        "phase-3|#8B5CF6"
        "phase-4|#F59E0B"
        "phase-5|#EF4444"
        "phase-6|#EC4899"
        "phase-7|#06B6D4"
        "phase-8|#6366F1"
    )

    echo '{"labels": ['
    local first=true

    for phase in "${phases[@]}"; do
        local name=$(echo "$phase" | cut -d'|' -f1)
        local color=$(echo "$phase" | cut -d'|' -f2)

        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi

        cmd_label_create "$name" "$color"
    done

    echo ']}'
}

cmd_phase_apply() {
    # Apply phase labels to all issues based on title prefix
    # [P1], [P2], ..., [P8] or [Phase 1], [Phase 2], etc.

    local all_issues=$(graphql '{
        "query": "query { issues(first: 250) { nodes { identifier title labels { nodes { name } } } } }"
    }')

    # Get issues that need phase labels
    local issues_to_update=$(echo "$all_issues" | jq -r '
        .data.issues.nodes[]
        | select(.title | test("^\\[P[1-8]\\]|^\\[Phase [1-8]\\]"))
        | select([.labels.nodes[].name | select(startswith("phase-"))] | length == 0)
        | {
            id: .identifier,
            title: .title,
            phase: (
                if (.title | test("^\\[P1\\]|^\\[Phase 1\\]")) then "phase-1"
                elif (.title | test("^\\[P2\\]|^\\[Phase 2\\]")) then "phase-2"
                elif (.title | test("^\\[P3\\]|^\\[Phase 3\\]")) then "phase-3"
                elif (.title | test("^\\[P4\\]|^\\[Phase 4\\]")) then "phase-4"
                elif (.title | test("^\\[P5\\]|^\\[Phase 5\\]")) then "phase-5"
                elif (.title | test("^\\[P6\\]|^\\[Phase 6\\]")) then "phase-6"
                elif (.title | test("^\\[P7\\]|^\\[Phase 7\\]")) then "phase-7"
                elif (.title | test("^\\[P8\\]|^\\[Phase 8\\]")) then "phase-8"
                else null end
            )
        }
        | select(.phase != null)
        | "\(.id)|\(.phase)"
    ')

    local count=0
    local results='{"applied": ['
    local first=true

    while IFS='|' read -r issue_id phase_label; do
        if [ -n "$issue_id" ] && [ -n "$phase_label" ]; then
            if [ "$first" = true ]; then
                first=false
            else
                results+=","
            fi

            # Add label silently
            local result=$(cmd_label_add "$issue_id" "$phase_label" 2>/dev/null)
            results+="{\"id\":\"$issue_id\",\"label\":\"$phase_label\"}"
            count=$((count + 1))
        fi
    done <<< "$issues_to_update"

    results+='], "count": '$count'}'
    echo "$results"
}

# ============================================
# END LABEL AND PHASE COMMANDS
# ============================================

# ============================================
# STANDUP DATA COMMAND
# ============================================

cmd_standup_data() {
    local since_date="$1"
    local assignee_filter="$2"

    if [ -z "$since_date" ]; then
        echo '{"error": "Usage: standup-data <since-date-YYYY-MM-DD> [assignee]"}'
        exit 1
    fi

    # Convert date to ISO format for Linear API
    local since_iso="${since_date}T00:00:00Z"

    # Get current user info if no assignee specified
    local assignee_condition=""
    if [ -n "$assignee_filter" ]; then
        local resolved_name=$(resolve_member_name "$assignee_filter")
        assignee_condition=", assignee: { name: { containsIgnoreCase: \\\"$resolved_name\\\" } }"
    fi

    # Query 1: Completed issues since date (Done, Completed, Cancelled)
    local completed=$(graphql "{
        \"query\": \"query { issues(first: 100, filter: { state: { name: { in: [\\\"Done\\\", \\\"Completed\\\"] } }, updatedAt: { gte: \\\"$since_iso\\\" }$assignee_condition }) { nodes { identifier title state { name } completedAt updatedAt url } } }\"
    }" | jq '[(.data.issues.nodes // [])[] | {id: .identifier, title: .title, status: .state.name, completed: .completedAt, updated: .updatedAt, url: .url}]')

    # Query 2: In Progress issues
    local in_progress=$(graphql "{
        \"query\": \"query { issues(first: 50, filter: { state: { name: { eq: \\\"In Progress\\\" } }$assignee_condition }) { nodes { identifier title state { name } priorityLabel url } } }\"
    }" | jq '[(.data.issues.nodes // [])[] | {id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, url: .url}]')

    # Query 3: In Review issues
    local in_review=$(graphql "{
        \"query\": \"query { issues(first: 50, filter: { state: { name: { eq: \\\"In Review\\\" } }$assignee_condition }) { nodes { identifier title state { name } priorityLabel url } } }\"
    }" | jq '[(.data.issues.nodes // [])[] | {id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, url: .url}]')

    # Query 4: Upcoming issues (Todo, Backlog) - only high/urgent priority for backlog
    local upcoming=$(graphql "{
        \"query\": \"query { issues(first: 50, filter: { state: { name: { in: [\\\"Todo\\\", \\\"Backlog\\\"] } }$assignee_condition }) { nodes { identifier title state { name } priorityLabel url } } }\"
    }" | jq '[(.data.issues.nodes // [])[] | {id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, url: .url}] | sort_by(.priority)')

    # Query 5: Blocked issues
    local blocked=$(graphql "{
        \"query\": \"query { issues(first: 50, filter: { state: { name: { containsIgnoreCase: \\\"blocked\\\" } }$assignee_condition }) { nodes { identifier title state { name } priorityLabel url } } }\"
    }" | jq '[(.data.issues.nodes // [])[] | {id: .identifier, title: .title, status: .state.name, priority: .priorityLabel, url: .url}]')

    # Combine all data
    jq -n \
        --argjson completed "$completed" \
        --argjson in_progress "$in_progress" \
        --argjson in_review "$in_review" \
        --argjson upcoming "$upcoming" \
        --argjson blocked "$blocked" \
        --arg since "$since_date" \
        '{
            since_date: $since,
            completed: $completed,
            completed_count: ($completed | length),
            in_progress: $in_progress,
            in_progress_count: ($in_progress | length),
            in_review: $in_review,
            in_review_count: ($in_review | length),
            upcoming: $upcoming,
            upcoming_count: ($upcoming | length),
            blocked: $blocked,
            blocked_count: ($blocked | length)
        }'
}

# ============================================
# END STANDUP DATA COMMAND
# ============================================

# ============================================
# CONTEXT-ENHANCED GET COMMAND
# ============================================

cmd_get_with_context() {
    local issue_id="$1"

    if [ -z "$issue_id" ]; then
        echo '{"error": "Usage: get-with-context <issue-id>"}'
        exit 1
    fi

    # Get base ticket data
    local ticket_data=$(cmd_get "$issue_id")

    # Extract title to detect domain
    local title=$(echo "$ticket_data" | jq -r '.title // ""')
    local description=$(echo "$ticket_data" | jq -r '.description // ""')
    local labels=$(echo "$ticket_data" | jq -r '.labels | join(",") // ""')

    # Detect domain from labels, title, and description
    local domain=""
    local all_text="$labels,$title,$description"
    case "$all_text" in
        *mobile*|*expo*|*react-native*|*Mobile*|*Expo*|*screen*|*Screen*) domain="mobile" ;;
        *database*|*schema*|*migration*|*Database*|*table*|*Table*) domain="database" ;;
        *web*|*next*|*frontend*|*Web*|*Frontend*|*Next*) domain="web" ;;
        *billing*|*polar*|*subscription*|*Billing*|*Polar*) domain="billing" ;;
        *backend*|*api*|*elysia*|*Backend*|*API*|*endpoint*|*Endpoint*) domain="backend" ;;
        *) domain="backend" ;;  # Default to backend
    esac

    # Check for spec file
    local spec_file=""
    local specs_dir="docs/01-product/technical-specs/specs"
    if [ -d "$specs_dir" ]; then
        spec_file=$(find "$specs_dir" -name "${issue_id}*.spec.md" 2>/dev/null | head -1)
    fi

    local spec_content=""
    if [ -n "$spec_file" ] && [ -f "$spec_file" ]; then
        spec_content=$(cat "$spec_file")
    fi

    # Get gotchas from SQLite
    local gotchas=""
    if [ -f ".claude/meta.db" ]; then
        gotchas=$(sqlite3 -json .claude/meta.db "SELECT description, severity, mitigation FROM v_critical_gotchas WHERE domain = '$domain'" 2>/dev/null || echo "[]")
    else
        gotchas="[]"
    fi

    # Get relevant patterns from SQLite
    local patterns=""
    if [ -f ".claude/meta.db" ]; then
        patterns=$(sqlite3 -json .claude/meta.db "SELECT pattern_name, usage_count FROM v_pattern_usage WHERE domain = '$domain' AND status = 'active' ORDER BY usage_count DESC LIMIT 5" 2>/dev/null || echo "[]")
    else
        patterns="[]"
    fi

    # Find relevant canonical doc based on title keywords
    local canonical_doc=""
    local canonical_section=""

    # Map keywords to canonical docs
    case "$title,$description" in
        *health*state*|*Health*State*|*metric*)
            canonical_doc="docs/00-vision/02-Core-Product-System.md"
            canonical_section="Health State"
            ;;
        *assessment*|*Assessment*|*agent*)
            canonical_doc="docs/00-vision/03-Evidence-Engine.md"
            canonical_section="Assessment Engine"
            ;;
        *lab*|*Lab*|*marker*)
            canonical_doc="docs/00-vision/04-Labs-LifeSense-Future.md"
            canonical_section="Labs Integration"
            ;;
        *safety*|*claim*|*escalation*)
            canonical_doc="docs/00-vision/05-Safety-Privacy-Constraints.md"
            canonical_section="Safety & Claims"
            ;;
        *program*|*cohort*|*metabolic*)
            canonical_doc="docs/00-vision/06-Example-Program-Metabolic-Reset.md"
            canonical_section="Programs"
            ;;
        *clinical*|*provider*|*CEM*)
            canonical_doc="docs/00-vision/07-Clinical-Services-Layer.md"
            canonical_section="Clinical Services"
            ;;
        *billing*|*subscription*|*payment*)
            canonical_doc="docs/00-vision/08-Billing-Product-Roadmap.md"
            canonical_section="Billing"
            ;;
    esac

    local canonical_content=""
    if [ -n "$canonical_doc" ] && [ -f "$canonical_doc" ]; then
        # Extract first 100 lines of canonical doc as context
        canonical_content=$(head -100 "$canonical_doc" 2>/dev/null || echo "")
    fi

    # Build enhanced output
    echo "$ticket_data" | jq --arg domain "$domain" \
        --arg spec_file "$spec_file" \
        --arg spec_content "$spec_content" \
        --argjson gotchas "$gotchas" \
        --argjson patterns "$patterns" \
        --arg canonical_doc "$canonical_doc" \
        --arg canonical_section "$canonical_section" \
        --arg canonical_content "$canonical_content" \
        '. + {
            context: {
                domain: $domain,
                spec_file: (if $spec_file != "" then $spec_file else null end),
                spec_content: (if $spec_content != "" then $spec_content else null end),
                gotchas: $gotchas,
                patterns: $patterns,
                canonical: {
                    doc: (if $canonical_doc != "" then $canonical_doc else null end),
                    section: (if $canonical_section != "" then $canonical_section else null end),
                    preview: (if $canonical_content != "" then ($canonical_content | split("\n") | .[0:20] | join("\n")) else null end)
                }
            }
        }'
}

# ============================================
# END CONTEXT-ENHANCED GET COMMAND
# ============================================

# ============================================
# ISSUE DELETE COMMAND
# ============================================

cmd_delete() {
    local issue_id="$1"

    if [ -z "$issue_id" ]; then
        echo '{"error": "Usage: delete <issue-id>"}'
        exit 1
    fi

    # Get issue UUID from identifier
    local issue_uuid=$(get_issue_uuid "$issue_id")

    if [ "$issue_uuid" = "null" ] || [ -z "$issue_uuid" ]; then
        echo "{\"error\": \"Issue not found: $issue_id\"}"
        exit 1
    fi

    graphql "{
        \"query\": \"mutation { issueDelete(id: \\\"$issue_uuid\\\") { success } }\"
    }" | jq "{success: .data.issueDelete.success, deleted: \"$issue_id\"}"
}

# ============================================
# END ISSUE DELETE COMMAND
# ============================================

# ============================================
# PROJECT & PHASE SYNC COMMANDS
# ============================================

# Get script directory for finding data files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"

cmd_sync_project() {
    local project_name="${1:-Unified Health App}"

    echo "Syncing all tickets to project: $project_name"

    # Get project ID
    local project_id=$(graphql "{
        \"query\": \"query { projects(first: 50, filter: { name: { containsIgnoreCase: \\\"$project_name\\\" } }) { nodes { id name } } }\"
    }" | jq -r '.data.projects.nodes[0].id')

    if [ "$project_id" = "null" ] || [ -z "$project_id" ]; then
        echo "{\"error\": \"Project not found: $project_name\"}"
        exit 1
    fi

    # Get all issues without project
    local issues=$(graphql '{
        "query": "query { issues(first: 250) { nodes { id identifier project { id } } } }"
    }' | jq -r '.data.issues.nodes[] | select(.project == null or .project.id == null) | .id')

    local count=0
    local errors=0

    for issue_uuid in $issues; do
        local result=$(graphql "{
            \"query\": \"mutation { issueUpdate(id: \\\"$issue_uuid\\\", input: { projectId: \\\"$project_id\\\" }) { success issue { identifier } } }\"
        }")

        local success=$(echo "$result" | jq -r '.data.issueUpdate.success')
        local identifier=$(echo "$result" | jq -r '.data.issueUpdate.issue.identifier')

        if [ "$success" = "true" ]; then
            count=$((count + 1))
            echo "  ✓ $identifier → $project_name"
        else
            errors=$((errors + 1))
            echo "  ✗ Failed to update issue"
        fi
    done

    echo "{\"success\": true, \"updated\": $count, \"errors\": $errors, \"project\": \"$project_name\"}"
}

cmd_sync_phases() {
    local map_file="$DATA_DIR/ticket-phase-map.yaml"

    if [ ! -f "$map_file" ]; then
        echo "{\"error\": \"Phase map file not found: $map_file\"}"
        exit 1
    fi

    echo "Syncing phase labels from roadmap mapping..."

    # Parse YAML and extract ticket-to-phase mappings
    # Using grep since we can't rely on yq being installed
    local count=0
    local errors=0
    local current_phase=""

    while IFS= read -r line; do
        # Match phase headers like "  phase-1:"
        if echo "$line" | grep -qE '^\s+phase-[0-9]+:'; then
            current_phase=$(echo "$line" | grep -oE 'phase-[0-9]+')
        fi

        # Match ticket IDs like "      - SAL-123"
        if echo "$line" | grep -qE '^\s+-\s+SAL-[0-9]+'; then
            local ticket_id=$(echo "$line" | grep -oE 'SAL-[0-9]+')

            if [ -n "$current_phase" ] && [ -n "$ticket_id" ]; then
                # Check if ticket already has this phase label
                local has_label=$(graphql "{
                    \"query\": \"query { issue(id: \\\"$ticket_id\\\") { labels { nodes { name } } } }\"
                }" | jq -r ".data.issue.labels.nodes[] | select(.name == \"$current_phase\") | .name" 2>/dev/null)

                if [ "$has_label" != "$current_phase" ]; then
                    # Add the phase label
                    local result=$(cmd_label_add "$ticket_id" "$current_phase" 2>/dev/null)
                    local success=$(echo "$result" | jq -r '.success // false')

                    if [ "$success" = "true" ]; then
                        count=$((count + 1))
                        echo "  ✓ $ticket_id → $current_phase"
                    else
                        errors=$((errors + 1))
                        echo "  ✗ $ticket_id (may not exist)"
                    fi
                fi
            fi
        fi
    done < "$map_file"

    echo "{\"success\": true, \"labels_added\": $count, \"errors\": $errors}"
}

cmd_sync_all() {
    echo "========================================"
    echo "Linear Sync: Project & Phase Labels"
    echo "========================================"
    echo ""

    echo "Step 1/2: Assigning tickets to project..."
    cmd_sync_project "Unified Health App"
    echo ""

    echo "Step 2/2: Applying phase labels..."
    cmd_sync_phases
    echo ""

    echo "========================================"
    echo "Sync complete!"
    echo "========================================"
}

# ============================================
# END PROJECT & PHASE SYNC COMMANDS
# ============================================

# Main dispatch
case "${1:-help}" in
    my-issues)      cmd_my_issues ;;
    all-issues)     cmd_all_issues "$2" ;;
    team-issues)    cmd_team_issues "$2" "$3" ;;
    search)         cmd_search "$2" ;;
    get)            cmd_get "$2" ;;
    get-with-context) cmd_get_with_context "$2" ;;
    create)         cmd_create "$2" "$3" "$4" ;;
    update)         cmd_update "$2" "$3" "$4" ;;
    comment)        cmd_comment "$2" "$3" ;;
    teams)          cmd_teams ;;
    projects)       cmd_projects ;;
    cycles)         cmd_cycles "$2" ;;
    labels)         cmd_labels ;;
    users)          cmd_users ;;
    # CTO Dashboard commands
    status)         cmd_status ;;
    workload)       cmd_workload ;;
    blocked)        cmd_blocked ;;
    urgent)         cmd_urgent ;;
    cycle-status)   cmd_cycle_status "$2" ;;
    recent)         cmd_recent "$2" ;;
    unassigned)     cmd_unassigned ;;
    member)         cmd_member "$2" "$3" ;;
    project-issues) cmd_project_issues "$2" "$3" ;;
    project-member) cmd_project_member "$2" "$3" ;;
    summary)        cmd_summary "$2" ;;
    # Sprint Management commands
    cycle-create)       cmd_cycle_create "$2" "$3" "$4" "$5" ;;
    cycle-update)       cmd_cycle_update "$2" "$3" "$4" ;;
    cycle-archive)      cmd_cycle_archive "$2" ;;
    cycle-add)          cmd_cycle_add "$2" "$3" ;;
    cycle-remove)       cmd_cycle_remove "$2" ;;
    cycle-issues)       cmd_cycle_issues "$2" ;;
    cycle-setup-roadmap) cmd_cycle_setup_roadmap "$2" "$3" ;;
    # Label Management commands
    label-create)       cmd_label_create "$2" "$3" ;;
    label-add)          cmd_label_add "$2" "$3" ;;
    label-remove)       cmd_label_remove "$2" "$3" ;;
    # Phase commands
    phase)              cmd_phase "$2" "$3" ;;
    phase-summary)      cmd_phase_summary ;;
    phase-labels-setup) cmd_phase_labels_setup ;;
    phase-apply)        cmd_phase_apply ;;
    # Issue management commands
    delete)             cmd_delete "$2" ;;
    # Standup data command
    standup-data)       cmd_standup_data "$2" "$3" ;;
    # Project & Phase sync commands
    sync-project)       cmd_sync_project "$2" ;;
    sync-phases)        cmd_sync_phases ;;
    sync-all)           cmd_sync_all ;;
    # Legacy label cleanup
    remove-legacy-labels) cmd_remove_legacy_labels ;;
    help|--help|-h) cmd_help ;;
    *)
        echo "{\"error\": \"Unknown command: $1. Run 'linear.sh help' for usage.\"}"
        exit 1
        ;;
esac
