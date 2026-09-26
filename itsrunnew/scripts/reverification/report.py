"""Render the machine-checked change evidence for an automated pull request."""

import json
import pathlib
import sys


def render(report):
    lines = [
        '# Facility information reverification',
        '',
        f"Checked on {report['date']} (JST). AI calls: {report['apiCalls']}; billed search actions: {report['searchCalls']}; conservative API cost for this run: ${report['costUpperUsd']:.4f}.",
        '',
        'Affirmative field changes require an exact quote from a fetched official source and an independent Luna xhigh confirmation. A separate conservative rule can downgrade individual-use status to unknown after every known official source has been unreadable for 28 days. The required Node 24 validation check must pass before auto-merge.',
        '',
    ]
    for facility in report['changed']:
        lines.extend([f"## {facility['trackId']}", ''])
        for field in facility['fields']:
            old = json.dumps(field['old'], ensure_ascii=False)
            new = json.dumps(field['new'], ensure_ascii=False)
            lines.append(f"- `{field['field']}`: `{old}` → `{new}`")
            if field.get('reason'):
                lines.append(f"  - Reason: {field['reason']}")
            else:
                quote = field['quote'].replace('\n', ' ').replace('|', '\\|')[:180]
                lines.extend([f"  - Source: {field['sourceUrl']}", f"  - Excerpt: {quote}"])
        lines.append('')
    if report['unresolved']:
        lines.extend([f"Unresolved findings: {len(report['unresolved'])}. See the workflow artifact for the machine-readable report.", ''])
    return '\n'.join(lines)


if __name__ == '__main__':
    source, target = map(pathlib.Path, sys.argv[1:3])
    target.write_text(render(json.loads(source.read_text())))
