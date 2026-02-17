from __future__ import annotations

import html

from ..schemas import PlanGraph


def render_plan_svg(plan: PlanGraph, *, px_per_ft: float = 12.0) -> str:
    w = int(plan.outline_ft.w * px_per_ft)
    h = int(plan.outline_ft.h * px_per_ft)

    def _rect(x: float, y: float, rw: float, rh: float) -> str:
        return (
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
            'fill="white" stroke="#0f172a" stroke-width="2"/>'
        )

    def _label(cx: float, cy: float, text: str) -> str:
        safe = html.escape(text)
        return (
            f'<text x="{cx:.1f}" y="{cy:.1f}" text-anchor="middle" dominant-baseline="middle" '
            'font-family="ui-sans-serif, system-ui" font-size="14" fill="#0f172a">'
            f"{safe}</text>"
        )

    parts: list[str] = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
    )
    parts.append('<rect width="100%" height="100%" fill="#f8fafc"/>')
    parts.append(
        f'<rect x="8" y="8" width="{w-16}" height="{h-16}" fill="none" stroke="#0f172a" stroke-width="3"/>'
    )

    for r in plan.rooms:
        x = 8 + r.rect_ft.x * px_per_ft
        y = 8 + r.rect_ft.y * px_per_ft
        rw = r.rect_ft.w * px_per_ft
        rh = r.rect_ft.h * px_per_ft
        parts.append(_rect(x, y, rw, rh))
        parts.append(_label(x + rw / 2, y + rh / 2, r.name))

    parts.append("</svg>")
    return "\n".join(parts)
