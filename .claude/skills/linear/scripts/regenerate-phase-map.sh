#!/bin/bash

# Regenerate ticket-phase-map.yaml from docs/01-product/tickets spec files
# Source of truth: ticket spec filenames with pattern SAL-XXX-p#-*.spec.md

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
OUTPUT="$SCRIPT_DIR/../data/ticket-phase-map.yaml"
TICKETS_DIR="$ROOT_DIR/docs/01-product/tickets"

echo "Regenerating ticket-phase-map.yaml from spec files..."
echo "Source: $TICKETS_DIR"
echo "Output: $OUTPUT"
echo ""

# Initialize YAML file
cat > "$OUTPUT" << 'EOF'
# Ticket-to-Phase Mapping
# Generated from docs/01-product/tickets spec files
# Source of truth: ticket spec filenames with pattern SAL-XXX-p#-*.spec.md
#
# DO NOT EDIT MANUALLY - Run regenerate-phase-map.sh to update

# Default project for all tickets
default_project: "Unified Health App"

# Phase mappings
phases:
EOF

# Track totals
total_tickets=0

# Process each phase
for phase in 1 2 3 4 5 6 7 8; do
    # Find all tickets for this phase
    # Match both patterns: -p#- and -phase-#-
    tickets_p=$(ls "$TICKETS_DIR"/SAL-*-p${phase}-*.spec.md 2>/dev/null | \
        grep -oE 'SAL-[0-9]+' || true)
    tickets_phase=$(ls "$TICKETS_DIR"/SAL-*-phase-${phase}-*.spec.md 2>/dev/null | \
        grep -oE 'SAL-[0-9]+' || true)

    # Combine and dedupe
    tickets=$(echo -e "${tickets_p}\n${tickets_phase}" | grep -v '^$' | sort -t- -k2 -n | uniq || true)

    if [ -n "$tickets" ]; then
        count=$(echo "$tickets" | wc -l | tr -d ' ')
        total_tickets=$((total_tickets + count))

        # Get phase name based on number
        case $phase in
            1) phase_name="Foundation" ;;
            2) phase_name="Core Data & AI" ;;
            3) phase_name="MVP Polish" ;;
            4) phase_name="Programs & Billing" ;;
            5) phase_name="Launch" ;;
            6) phase_name="Labs & Advanced" ;;
            7) phase_name="Clinical Services" ;;
            8) phase_name="Mini-Apps" ;;
        esac

        echo "  Phase $phase ($phase_name): $count tickets"

        # Write to YAML
        echo "  phase-${phase}:" >> "$OUTPUT"
        echo "    name: \"$phase_name\"" >> "$OUTPUT"
        echo "    tickets:" >> "$OUTPUT"

        for t in $tickets; do
            # Extract title from filename for comment
            # Try both patterns
            filename=$(ls "$TICKETS_DIR"/${t}-p${phase}-*.spec.md 2>/dev/null | head -1)
            if [ -z "$filename" ]; then
                filename=$(ls "$TICKETS_DIR"/${t}-phase-${phase}-*.spec.md 2>/dev/null | head -1)
            fi

            if [ -n "$filename" ]; then
                title=$(basename "$filename" .spec.md | sed "s/${t}-p${phase}-//" | sed "s/${t}-phase-${phase}-//")
                title=$(echo "$title" | tr '-' ' ' | sed 's/all tasks//')
                echo "      - $t   # $title" >> "$OUTPUT"
            else
                echo "      - $t" >> "$OUTPUT"
            fi
        done

        echo "" >> "$OUTPUT"
    fi
done

# Find unphased tickets
echo ""
echo "Unphased tickets (no p#- prefix):"

unphased=$(ls "$TICKETS_DIR"/SAL-*.spec.md 2>/dev/null | \
    grep -v '\-p[0-9]\-' | \
    grep -v '\-phase-[0-9]\-' | \
    grep -oE 'SAL-[0-9]+' | sort -t- -k2 -n | uniq || true)

if [ -n "$unphased" ]; then
    unphased_count=$(echo "$unphased" | wc -l | tr -d ' ')
    echo "  Found $unphased_count unphased tickets"

    # Add unphased section
    echo "  # Unphased tickets - no phase label will be applied" >> "$OUTPUT"
    echo "  unphased:" >> "$OUTPUT"
    echo "    name: \"Unphased\"" >> "$OUTPUT"
    echo "    tickets:" >> "$OUTPUT"

    for t in $unphased; do
        echo "      - $t" >> "$OUTPUT"
    done
else
    echo "  None found"
fi

echo ""
echo "========================================"
echo "Summary:"
echo "  Phased tickets: $total_tickets"
if [ -n "$unphased" ]; then
    echo "  Unphased tickets: $unphased_count"
fi
echo "  Output: $OUTPUT"
echo "========================================"
