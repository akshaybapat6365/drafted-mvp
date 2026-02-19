"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlanGraph = generatePlanGraph;
exports.renderPlanSvg = renderPlanSvg;
const node_crypto_1 = require("node:crypto");
function generatePlanGraph(spec) {
    const outlineW = 52.0;
    const outlineH = 34.0;
    const outline = { x: 0, y: 0, w: outlineW, h: outlineH };
    const leftW = 32.0;
    const rightW = outlineW - leftW;
    const rooms = [];
    const edges = [];
    const warnings = [];
    let y = 0.0;
    let publicRooms = spec.rooms.filter((r) => ["living", "kitchen", "dining"].includes(r.type));
    if (publicRooms.length === 0) {
        warnings.push("No public rooms in spec; added a default Great Room.");
        publicRooms = [
            {
                id: (0, node_crypto_1.randomUUID)(),
                type: "living",
                name: "Great Room",
                area_ft2: 320,
            },
        ];
    }
    for (const r of publicRooms) {
        const h = clamp(r.area_ft2 / leftW, 8.0, 14.0);
        if (y + h > outlineH)
            break;
        rooms.push({
            id: r.id,
            name: r.name,
            type: r.type,
            area_ft2: r.area_ft2,
            rect_ft: { x: 0, y, w: leftW, h },
        });
        y += h;
    }
    const hallH = Math.max(4.0, outlineH - y);
    const hallId = (0, node_crypto_1.randomUUID)();
    if (hallH >= 4.0) {
        rooms.push({
            id: hallId,
            name: "Hall",
            type: "hall",
            area_ft2: leftW * hallH,
            rect_ft: { x: 0, y, w: leftW, h: hallH },
        });
    }
    let y2 = 0.0;
    const privateRooms = spec.rooms.filter((r) => ["bedroom", "bathroom", "laundry"].includes(r.type));
    if (privateRooms.length === 0) {
        warnings.push("No private rooms in spec; private zone is empty.");
    }
    for (const r of privateRooms) {
        const h = clamp(r.area_ft2 / rightW, 6.0, 12.0);
        if (y2 + h > outlineH)
            break;
        rooms.push({
            id: r.id,
            name: r.name,
            type: r.type,
            area_ft2: r.area_ft2,
            rect_ft: { x: leftW, y: y2, w: rightW, h },
        });
        y2 += h;
    }
    const living = rooms.find((r) => r.type === "living");
    const kitchen = rooms.find((r) => r.type === "kitchen");
    const dining = rooms.find((r) => r.type === "dining");
    if (living && kitchen)
        edges.push({ a: living.id, b: kitchen.id, kind: "adjacent" });
    if (kitchen && dining)
        edges.push({ a: kitchen.id, b: dining.id, kind: "adjacent" });
    if (living && dining)
        edges.push({ a: living.id, b: dining.id, kind: "adjacent" });
    const firstBed = rooms.find((r) => r.type === "bedroom");
    if (firstBed)
        edges.push({ a: hallId, b: firstBed.id, kind: "circulation" });
    return {
        version: "1.0",
        outline_ft: outline,
        rooms,
        edges,
        warnings,
    };
}
function renderPlanSvg(plan, pxPerFt = 12) {
    const w = Math.round(plan.outline_ft.w * pxPerFt);
    const h = Math.round(plan.outline_ft.h * pxPerFt);
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
    parts.push('<rect width="100%" height="100%" fill="#f8fafc"/>');
    parts.push(`<rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="#0f172a" stroke-width="3"/>`);
    for (const room of plan.rooms) {
        const x = 8 + room.rect_ft.x * pxPerFt;
        const y = 8 + room.rect_ft.y * pxPerFt;
        const rw = room.rect_ft.w * pxPerFt;
        const rh = room.rect_ft.h * pxPerFt;
        const label = escapeXml(room.name);
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="white" stroke="#0f172a" stroke-width="2"/>`);
        parts.push(`<text x="${(x + rw / 2).toFixed(1)}" y="${(y + rh / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif,system-ui" font-size="14" fill="#0f172a">${label}</text>`);
    }
    parts.push("</svg>");
    return parts.join("\n");
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function escapeXml(raw) {
    return raw
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}
//# sourceMappingURL=geometry.js.map