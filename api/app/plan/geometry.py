from __future__ import annotations

import uuid

from ..schemas import HouseSpec, PlanEdge, PlanGraph, PlanRoom, Rect


def _rid() -> str:
    return str(uuid.uuid4())


def generate_plan_graph(spec: HouseSpec) -> PlanGraph:
    """
    Deterministic MVP layout.

    Coordinate system in feet:
    - origin at top-left
    - x to the right, y down
    """
    outline_w = 52.0
    outline_h = 34.0
    outline = Rect(x=0, y=0, w=outline_w, h=outline_h)

    left_w = 32.0
    right_w = outline_w - left_w

    rooms: list[PlanRoom] = []
    edges: list[PlanEdge] = []
    warnings: list[str] = []

    # Zone A (left): public rooms stacked
    y = 0.0
    public = [r for r in spec.rooms if r.type in {"living", "kitchen", "dining"}]
    if not public:
        warnings.append("No public rooms (living/kitchen/dining) in spec; adding default Great Room.")
        public = []
        public.append(type(spec.rooms[0]).model_validate({"id": _rid(), "type": "living", "name": "Great Room", "area_ft2": 320}))  # type: ignore[attr-defined]

    # Assign heights by area / width; clamp to keep readable rectangles.
    for r in public:
        h = max(8.0, min(14.0, r.area_ft2 / left_w))
        if y + h > outline_h:
            break
        rooms.append(
            PlanRoom(
                id=r.id,
                name=r.name,
                type=r.type,
                area_ft2=r.area_ft2,
                rect_ft=Rect(x=0, y=y, w=left_w, h=h),
            )
        )
        y += h

    # Add a small entry/hall connector if space permits.
    hall_h = max(4.0, outline_h - y)
    hall_id = _rid()
    if hall_h >= 4.0:
        rooms.append(
            PlanRoom(
                id=hall_id,
                name="Hall",
                type="hall",
                area_ft2=left_w * hall_h,
                rect_ft=Rect(x=0, y=y, w=left_w, h=hall_h),
            )
        )

    # Zone B (right): bedrooms + baths stacked
    y2 = 0.0
    priv = [r for r in spec.rooms if r.type in {"bedroom", "bathroom", "laundry"}]
    if not priv:
        warnings.append("No private rooms (bedroom/bathroom/laundry) in spec; adding defaults.")

    for r in priv:
        h = max(6.0, min(12.0, r.area_ft2 / right_w))
        if y2 + h > outline_h:
            break
        rooms.append(
            PlanRoom(
                id=r.id,
                name=r.name,
                type=r.type,
                area_ft2=r.area_ft2,
                rect_ft=Rect(x=left_w, y=y2, w=right_w, h=h),
            )
        )
        y2 += h

    # Edges: naive adjacency based on types.
    living = next((r for r in rooms if r.type == "living"), None)
    kitchen = next((r for r in rooms if r.type == "kitchen"), None)
    dining = next((r for r in rooms if r.type == "dining"), None)
    if living and kitchen:
        edges.append(PlanEdge(a=living.id, b=kitchen.id))
    if kitchen and dining:
        edges.append(PlanEdge(a=kitchen.id, b=dining.id))
    if living and dining:
        edges.append(PlanEdge(a=living.id, b=dining.id))

    # Hall connects to first bedroom if present
    first_bed = next((r for r in rooms if r.type == "bedroom"), None)
    if first_bed and hall_id:
        edges.append(PlanEdge(a=hall_id, b=first_bed.id, kind="circulation"))

    return PlanGraph(outline_ft=outline, rooms=rooms, edges=edges, warnings=warnings)
