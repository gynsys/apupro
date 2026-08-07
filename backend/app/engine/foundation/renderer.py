"""
foundation/renderer.py
Rendering / export mixin: SVG plan, HTML sketch, matplotlib plots, JSON summary.

Provides:
  - PlanRenderer mixin class

All SVG and HTML generation is self-contained here.
matplotlib import is deferred inside plot_results() to keep it optional.
"""

import json
from dataclasses import asdict

import numpy as np


class PlanRenderer:
    """
    Mixin: generate visual outputs for the foundation slab design.

    Requires attributes set by GrillageSolver, PostProcessor, and
    ReinforcementDesigner (Lx, Ly, h, E, nu, f_c, f_y, k, d_eff,
    nx, ny, dx, dy, X, Y, w, Mx, My, Vu, Vc, phiVc, shear_ok,
    shear_ratio, Asx_bot, Asy_bot, Asx_top, Asy_top,
    walls, beams, columns, band_data, settlement_data, punching_data,
    gamma_horm, rho_min).
    """

    # ------------------------------------------------------------------
    # SVG plan (returned as string for API embedding)
    # ------------------------------------------------------------------

    def get_svg_plan(self) -> str:
        """
        Build and return an SVG string showing the reinforcement plan.

        Returns
        -------
        str  SVG markup joined with '\\n'
        """
        margin = 130
        svg_w = 850
        svg_h = 850
        plot_size = min(svg_w, svg_h) - 2 * margin
        scale = plot_size / max(self.Lx, self.Ly)

        def to_svg(x: float, y: float) -> tuple:
            return (margin + x * scale, margin + y * scale)

        svg_parts = []
        svg_parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w} {svg_h}" '
            f'style="width:100%;max-height:600px;border:1px solid #ccc;'
            f'border-radius:8px;background:#fafafa;">'
        )

        # Light grid
        for i in range(self.nx + 1):
            x = i * self.dx
            x1, y1 = to_svg(x, 0)
            x2, y2 = to_svg(x, self.Ly)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#e0e0e0" stroke-width="0.8"/>'
            )
        for j in range(self.ny + 1):
            y = j * self.dy
            x1, y1 = to_svg(0, y)
            x2, y2 = to_svg(self.Lx, y)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#e0e0e0" stroke-width="0.8"/>'
            )

        # Armadura Base Cutout (top right)
        cut_w = self.Lx * 0.35
        cut_h = self.Ly * 0.35
        x0_s, y0_s = to_svg(self.Lx - cut_w, 0)
        x1_s, y1_s = to_svg(self.Lx, cut_h)
        xt_s, yt_s = to_svg(self.Lx, 0)
        
        # Draw a wavy path for the cutout: from (x0_s, y0_s) to (x1_s, y1_s)
        wavy_d = (
            f"M {x0_s:.1f} {y0_s:.1f} "
            f"C {x0_s - 40:.1f} {y0_s + 40:.1f}, {x0_s + 40:.1f} {y1_s - 40:.1f}, {x1_s:.1f} {y1_s:.1f}"
        )
        clip_d = f"{wavy_d} L {xt_s:.1f} {yt_s:.1f} Z"

        svg_parts.insert(1, f'<defs><clipPath id="meshClip"><path d="{clip_d}"/></clipPath>'
                            f'<marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">'
                            f'<path d="M0,0 L0,6 L9,3 z" fill="#000" /></marker></defs>')

        # Draw grid inside the clipPath
        svg_parts.append('<g clip-path="url(#meshClip)">')
        for i in range(7):
            vx, _ = to_svg(self.Lx - cut_w + i * (cut_w/6), 0)
            svg_parts.append(f'<line x1="{vx:.1f}" y1="{y0_s:.1f}" x2="{vx:.1f}" y2="{y1_s + 20:.1f}" stroke="#000" stroke-width="2"/>')
        for i in range(7):
            _, vy = to_svg(0, i * (cut_h/6))
            svg_parts.append(f'<line x1="{x0_s - 20:.1f}" y1="{vy:.1f}" x2="{xt_s:.1f}" y2="{vy:.1f}" stroke="#000" stroke-width="2"/>')
        svg_parts.append('</g>')

        # Draw the wavy border line
        svg_parts.append(f'<path d="{wavy_d}" fill="none" stroke="#000" stroke-width="3"/>')

        # Draw the text and arrow
        arr_en_x, arr_en_y = to_svg(self.Lx - cut_w / 2, 0)
        arr_st_x, arr_st_y = to_svg(self.Lx - cut_w / 2, -1.2)
        
        svg_parts.append(
            f'<line x1="{arr_st_x:.1f}" y1="{arr_st_y:.1f}" x2="{arr_en_x:.1f}" y2="{arr_en_y - 5:.1f}" '
            f'stroke="#000" stroke-width="2" marker-end="url(#arrow)"/>'
        )
        # Determine base mesh text
        mesh_val = getattr(self, "custom_mesh_cm2_m", 0)
        mesh_text = "Armadura Base (Doble Malla)"
        if mesh_val == 0.61: mesh_text = "Malla 6x6 (Ø3.43@15cm) (ambos sentidos)"
        elif mesh_val == 1.41: mesh_text = "Ø6@20cm (ambos sentidos)"
        elif mesh_val == 1.88: mesh_text = "Malla Sima (Ø6@15cm) (ambos sentidos)"
        elif mesh_val == 1.92: mesh_text = "Ø7@20cm (ambos sentidos)"
        elif mesh_val == 2.51: mesh_text = "Ø8@20cm (ambos sentidos)"
        elif mesh_val == 3.93: mesh_text = "Ø10@20cm (ambos sentidos)"
        elif mesh_val == 5.24: mesh_text = "Ø10@15cm (ambos sentidos)"
        else:
            As_min_cm2_normativo = float(getattr(self, "rho_min", 0.0018) * 1.0 * getattr(self, "h", 0.15) * 1e4)
            As_min_m2 = As_min_cm2_normativo / 1e4
            if hasattr(self, "_propose_bars"):
                bx = self._propose_bars(As_min_m2)
                if bx["diam_mm"] > 0:
                    mesh_text = f"Ø{bx['diam_mm']}@{int(bx['sep_m']*100)}cm (ambos sentidos)"

        svg_parts.append(
            f'<text x="{arr_st_x:.1f}" y="{arr_st_y - 5:.1f}" '
            f'font-family="sans-serif" font-size="15" fill="#000" text-anchor="middle" font-weight="bold">'
            f'{mesh_text}</text>'
        )

        # Reinforcement bands (polygons centred on walls)
        for idx, wall in enumerate(self.walls):
            dxw = wall.x2 - wall.x1
            dyw = wall.y2 - wall.y1
            length = wall.length
            if length < 1e-6:
                continue

            # Check if this band actually requires additional reinforcement beyond the base mesh
            b_data = next((b for b in getattr(self, "band_data", []) if b["id"] == idx), None)
            needs_steel = False
            if b_data:
                As_min_cm2_normativo = float(getattr(self, "rho_min", 0.0018) * 1.0 * getattr(self, "h", 0.15) * 1e4)
                mesh_val = getattr(self, "custom_mesh_cm2_m", 0)
                As_min_cm2 = max(As_min_cm2_normativo, float(mesh_val)) if mesh_val > 0 else As_min_cm2_normativo
                
                req_x = b_data.get("Asx_calc_cm2_m", 0)
                req_y = b_data.get("Asy_calc_cm2_m", 0)
                if req_x > As_min_cm2 + 1e-4 or req_y > As_min_cm2 + 1e-4:
                    needs_steel = True
            
            if not needs_steel:
                continue

            nx_vec = -dyw / length
            ny_vec = dxw / length
            hw = wall.band_width / 2.0

            band_corners = [
                (wall.x1 + nx_vec * hw, wall.y1 + ny_vec * hw),
                (wall.x1 - nx_vec * hw, wall.y1 - ny_vec * hw),
                (wall.x2 - nx_vec * hw, wall.y2 - ny_vec * hw),
                (wall.x2 + nx_vec * hw, wall.y2 + ny_vec * hw),
            ]
            pts = " ".join(
                [
                    f"{to_svg(cx, cy)[0]:.1f},{to_svg(cx, cy)[1]:.1f}"
                    for cx, cy in band_corners
                ]
            )
            svg_parts.append(
                f'<polygon points="{pts}" fill="rgba(255,193,7,0.25)" '
                f'stroke="#f9a825" stroke-width="1.5"/>'
            )

            # Add steel text annotation
            if b_data:
                req_str = ""
                bx = b_data.get("bar_x", {})
                by = b_data.get("bar_y", {})
                req_x_str = f"Ø{bx.get('diam_mm', 0)}@{int(bx.get('sep_m', 0)*100)}cm" if req_x > As_min_cm2 + 1e-4 and bx.get("diam_mm", 0) > 0 else ""
                req_y_str = f"Ø{by.get('diam_mm', 0)}@{int(by.get('sep_m', 0)*100)}cm" if req_y > As_min_cm2 + 1e-4 and by.get("diam_mm", 0) > 0 else ""
                
                if req_x_str and req_y_str:
                    if req_x_str == req_y_str:
                        req_str = f"{req_x_str} (ambos sentidos)"
                    else:
                        req_str = f"X {req_x_str}, Y {req_y_str}"
                elif req_x_str:
                    req_str = f"X {req_x_str}"
                elif req_y_str:
                    req_str = f"Y {req_y_str}"
                
                if req_str:
                    mid_x = (wall.x1 + wall.x2) / 2
                    mid_y = (wall.y1 + wall.y2) / 2
                    off_dist = 1.3
                    
                    cx, cy = self.Lx / 2, self.Ly / 2
                    vx = cx - mid_x
                    vy = cy - mid_y
                    dot = vx * nx_vec + vy * ny_vec
                    # We want the normal to point AWAY from the center so text goes outwards
                    if dot > 0:
                        nx_vec, ny_vec = -nx_vec, -ny_vec
                        
                    # Offset for text
                    text_x = mid_x + nx_vec * off_dist
                    text_y = mid_y + ny_vec * off_dist
                    
                    px_arr_st, py_arr_st = to_svg(text_x, text_y)
                    px_arr_en, py_arr_en = to_svg(mid_x, mid_y)
                    
                    # Point arrow towards the band edge, not middle, to be cleaner
                    # band edge is hw away from mid
                    edge_x = mid_x + (-nx_vec) * hw
                    edge_y = mid_y + (-ny_vec) * hw
                    px_arr_en, py_arr_en = to_svg(edge_x, edge_y)
                    
                    svg_parts.append(
                        f'<line x1="{px_arr_st:.1f}" y1="{py_arr_st:.1f}" x2="{px_arr_en:.1f}" y2="{py_arr_en:.1f}" '
                        f'stroke="#000" stroke-width="1.5" marker-end="url(#arrow)"/>'
                    )
                    
                    # Text with white background for readability
                    svg_parts.append(
                        f'<text x="{px_arr_st:.1f}" y="{py_arr_st - 5:.1f}" '
                        f'font-family="sans-serif" font-size="13" fill="#000" '
                        f'text-anchor="middle" font-weight="bold">{req_str}</text>'
                    )

        # Tie beams
        for beam in self.beams:
            x1, y1 = to_svg(beam.x1, beam.y1)
            x2, y2 = to_svg(beam.x2, beam.y2)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#4caf50" stroke-width="5" stroke-linecap="round" opacity="0.85"/>'
            )

        # Walls with labels
        for idx, wall in enumerate(self.walls):
            color = "#e53935" if wall.wall_type == "perimetral" else "#1e88e5"
            width_px = max(2, wall.thickness * scale)
            x1, y1 = to_svg(wall.x1, wall.y1)
            x2, y2 = to_svg(wall.x2, wall.y2)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="{color}" stroke-width="{width_px:.1f}" stroke-linecap="round"/>'
            )

            cx, cy = to_svg((wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2)
            As_min = self.rho_min * 1.0 * self.h * 1e4
            try:
                b = self.band_data[idx]
                needs_extra = False
                extra_txt = ""
                if b["Asx_cm2_m"] > As_min + 0.05:
                    needs_extra = True
                    extra_txt += (
                        f"X: Ø{b['bar_x'].get('diam_mm', 0)}"
                        f"@{b['bar_x'].get('sep_m', 0) * 100:.0f}cm "
                    )
                if b["Asy_cm2_m"] > As_min + 0.05:
                    needs_extra = True
                    extra_txt += (
                        f"Y: Ø{b['bar_y'].get('diam_mm', 0)}"
                        f"@{b['bar_y'].get('sep_m', 0) * 100:.0f}cm"
                    )
                if needs_extra:
                    svg_parts.append(
                        f'<rect x="{cx - 12}" y="{cy - 10}" width="24" height="20" '
                        f'rx="3" fill="rgba(255,255,255,0.9)" stroke="#e65100" stroke-width="2"/>'
                    )
                    svg_parts.append(
                        f'<text x="{cx}" y="{cy + 4}" font-family="sans-serif" '
                        f'font-size="12" font-weight="bold" fill="#e65100" '
                        f'text-anchor="middle">M{idx + 1}</text>'
                    )
                else:
                    svg_parts.append(
                        f'<rect x="{cx - 12}" y="{cy - 10}" width="24" height="20" '
                        f'rx="3" fill="rgba(255,255,255,0.85)" stroke="{color}" stroke-width="1"/>'
                    )
                    svg_parts.append(
                        f'<text x="{cx}" y="{cy + 4}" font-family="sans-serif" '
                        f'font-size="12" font-weight="bold" fill="{color}" '
                        f'text-anchor="middle">M{idx + 1}</text>'
                    )
            except Exception:
                svg_parts.append(
                    f'<rect x="{cx - 12}" y="{cy - 10}" width="24" height="20" '
                    f'rx="3" fill="rgba(255,255,255,0.85)" stroke="{color}" stroke-width="1"/>'
                )
                svg_parts.append(
                    f'<text x="{cx}" y="{cy + 4}" font-family="sans-serif" '
                    f'font-size="12" font-weight="bold" fill="{color}" '
                    f'text-anchor="middle">M{idx + 1}</text>'
                )

        # Columns / machones
        for col in self.columns:
            cx_col, cy_col = to_svg(col.x, col.y)
            w_px_col = max(4, col.width * scale)
            h_px_col = max(4, col.length * scale)
            svg_parts.append(
                f'<rect x="{cx_col - w_px_col / 2:.1f}" y="{cy_col - h_px_col / 2:.1f}" '
                f'width="{w_px_col:.1f}" height="{h_px_col:.1f}" '
                f'fill="#333" stroke="#000" stroke-width="1"/>'
            )

        # Retaining walls with labels
        if hasattr(self, 'retaining_walls'):
            for rw in self.retaining_walls:
                color = "#e65100" # Naranja oscuro
                width_px = max(3, rw.thickness * scale)
                x1, y1 = to_svg(rw.x1, rw.y1)
                x2, y2 = to_svg(rw.x2, rw.y2)
                svg_parts.append(
                    f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                    f'stroke="{color}" stroke-width="{width_px:.1f}" stroke-linecap="round"/>'
                )
                
                cx, cy = to_svg((rw.x1 + rw.x2) / 2, (rw.y1 + rw.y2) / 2)
                label = getattr(rw, 'id', "MC")
                svg_parts.append(
                    f'<rect x="{cx - 15}" y="{cy - 10}" width="30" height="20" '
                    f'rx="3" fill="rgba(255,255,255,0.9)" stroke="{color}" stroke-width="2"/>'
                )
                svg_parts.append(
                    f'<text x="{cx}" y="{cy + 4}" font-family="sans-serif" '
                    f'font-size="11" font-weight="bold" fill="{color}" '
                    f'text-anchor="middle">{label}</text>'
                )

        # Support beams with labels
        if hasattr(self, 'support_beams'):
            for sb in self.support_beams:
                color = "#4a148c" # Morado oscuro
                width_px = max(4, sb.width * scale)
                x1, y1 = to_svg(sb.x1, sb.y1)
                x2, y2 = to_svg(sb.x2, sb.y2)
                svg_parts.append(
                    f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                    f'stroke="{color}" stroke-width="{width_px:.1f}" stroke-linecap="round" stroke-dasharray="8,4"/>'
                )
                
                cx, cy = to_svg((sb.x1 + sb.x2) / 2, (sb.y1 + sb.y2) / 2)
                label = getattr(sb, 'id', "VA")
                svg_parts.append(
                    f'<rect x="{cx - 15}" y="{cy - 10}" width="30" height="20" '
                    f'rx="3" fill="rgba(255,255,255,0.9)" stroke="{color}" stroke-width="2"/>'
                )
                svg_parts.append(
                    f'<text x="{cx}" y="{cy + 4}" font-family="sans-serif" '
                    f'font-size="11" font-weight="bold" fill="{color}" '
                    f'text-anchor="middle">{label}</text>'
                )

        # Openings (windows and doors)
        for wall in self.walls:
            if not wall.openings:
                continue
            color_w = "#e53935" if wall.wall_type == "perimetral" else "#1e88e5"
            thickPx = max(2, wall.thickness * scale)
            for op in wall.openings:
                start = op.get("start_m", 0)
                w_op = op.get("width_m", 0)
                op_type = op.get("type", "window")

                if wall.length > 0:
                    t1 = start / wall.length
                    t2 = (start + w_op) / wall.length
                    x1_op = wall.x1 + t1 * (wall.x2 - wall.x1)
                    y1_op = wall.y1 + t1 * (wall.y2 - wall.y1)
                    x2_op = wall.x1 + t2 * (wall.x2 - wall.x1)
                    y2_op = wall.y1 + t2 * (wall.y2 - wall.y1)

                    ox1, oy1 = to_svg(x1_op, y1_op)
                    ox2, oy2 = to_svg(x2_op, y2_op)

                    w_px_op = float(np.sqrt((ox2 - ox1) ** 2 + (oy2 - oy1) ** 2))
                    if w_px_op > 0:
                        ux = (ox2 - ox1) / w_px_op
                        uy = (oy2 - oy1) / w_px_op
                    else:
                        ux, uy = 0.0, 0.0
                    vx, vy = -uy, ux

                    if op_type.startswith("door"):
                        is_left = "left" in op_type
                        is_out = "out" in op_type

                        vx = -uy
                        vy = ux
                        if is_out:
                            vx = -vx
                            vy = -vy

                        hx = ox1 if is_left else ox2
                        hy = oy1 if is_left else oy2
                        ex = ox2 if is_left else ox1
                        ey = oy2 if is_left else oy1

                        lx = hx + vx * w_px_op
                        ly = hy + vy * w_px_op
                        hl_x = lx - hx
                        hl_y = ly - hy
                        he_x = ex - hx
                        he_y = ey - hy
                        cross_val = (hl_x * he_y) - (hl_y * he_x)
                        sweep = 1 if cross_val > 0 else 0

                        svg_parts.append(
                            f'<line x1="{ox1:.1f}" y1="{oy1:.1f}" x2="{ox2:.1f}" y2="{oy2:.1f}" '
                            f'stroke="#fafafa" stroke-width="{thickPx + 2:.1f}" stroke-linecap="butt"/>'
                        )
                        svg_parts.append(
                            f'<line x1="{hx:.1f}" y1="{hy:.1f}" x2="{lx:.1f}" y2="{ly:.1f}" '
                            f'stroke="#333" stroke-width="2" stroke-linecap="square"/>'
                        )
                        svg_parts.append(
                            f'<path d="M {lx:.1f} {ly:.1f} A {w_px_op:.1f} {w_px_op:.1f} '
                            f'0 0 {sweep} {ex:.1f} {ey:.1f}" fill="none" stroke="#666" '
                            f'stroke-width="1.5" stroke-dasharray="4,4"/>'
                        )
                    else:
                        # Window
                        f1x1 = ox1 + vx * (thickPx / 2)
                        f1y1 = oy1 + vy * (thickPx / 2)
                        f1x2 = ox2 + vx * (thickPx / 2)
                        f1y2 = oy2 + vy * (thickPx / 2)
                        f2x1 = ox1 - vx * (thickPx / 2)
                        f2y1 = oy1 - vy * (thickPx / 2)
                        f2x2 = ox2 - vx * (thickPx / 2)
                        f2y2 = oy2 - vy * (thickPx / 2)

                        svg_parts.append(
                            f'<line x1="{ox1:.1f}" y1="{oy1:.1f}" x2="{ox2:.1f}" y2="{oy2:.1f}" '
                            f'stroke="#fafafa" stroke-width="{thickPx + 2:.1f}" stroke-linecap="butt"/>'
                        )
                        svg_parts.append(
                            f'<line x1="{f1x1:.1f}" y1="{f1y1:.1f}" x2="{f1x2:.1f}" y2="{f1y2:.1f}" '
                            f'stroke="#333" stroke-width="1"/>'
                        )
                        svg_parts.append(
                            f'<line x1="{f2x1:.1f}" y1="{f2y1:.1f}" x2="{f2x2:.1f}" y2="{f2y2:.1f}" '
                            f'stroke="#333" stroke-width="1"/>'
                        )
                        svg_parts.append(
                            f'<line x1="{ox1 + vx * 2:.1f}" y1="{oy1 + vy * 2:.1f}" '
                            f'x2="{ox2 + vx * 2:.1f}" y2="{oy2 + vy * 2:.1f}" '
                            f'stroke="#5bc0de" stroke-width="2"/>'
                        )
                        svg_parts.append(
                            f'<line x1="{ox1 - vx * 2:.1f}" y1="{oy1 - vy * 2:.1f}" '
                            f'x2="{ox2 - vx * 2:.1f}" y2="{oy2 - vy * 2:.1f}" '
                            f'stroke="#5bc0de" stroke-width="2"/>'
                        )

        # Exterior dimension annotations
        cota_y = margin - 35
        x_left, _ = to_svg(0, self.Ly)
        x_right, _ = to_svg(self.Lx, self.Ly)
        svg_parts.append(
            f'<line x1="{x_left:.1f}" y1="{cota_y:.1f}" x2="{x_right:.1f}" y2="{cota_y:.1f}" '
            f'stroke="#555" stroke-width="1" marker-end="url(#arrow)" marker-start="url(#arrow)"/>'
        )
        svg_parts.append(
            f'<text x="{(x_left + x_right) / 2:.1f}" y="{cota_y - 6:.1f}" '
            f'text-anchor="middle" font-size="11" fill="#555" '
            f'font-family="sans-serif">{self.Lx:.2f} m</text>'
        )

        cota_x = margin - 35
        _, y_bottom = to_svg(0, 0)
        _, y_top = to_svg(0, self.Ly)
        svg_parts.append(
            f'<line x1="{cota_x:.1f}" y1="{y_bottom:.1f}" x2="{cota_x:.1f}" y2="{y_top:.1f}" '
            f'stroke="#555" stroke-width="1" marker-end="url(#arrow)" marker-start="url(#arrow)"/>'
        )
        svg_parts.append(
            f'<text x="{cota_x - 6:.1f}" y="{(y_bottom + y_top) / 2:.1f}" '
            f'text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif" '
            f'transform="rotate(-90, {cota_x - 6:.1f}, {(y_bottom + y_top) / 2:.1f})">'
            f'{self.Ly:.2f} m</text>'
        )

        # Graphical scale bar (2 m)
        scale_x = margin
        scale_y = svg_h - margin + 40
        scale_len = 2.0 * scale
        svg_parts.append(
            f'<line x1="{scale_x:.1f}" y1="{scale_y:.1f}" '
            f'x2="{scale_x + scale_len:.1f}" y2="{scale_y:.1f}" stroke="#333" stroke-width="2"/>'
        )
        svg_parts.append(
            f'<line x1="{scale_x:.1f}" y1="{scale_y - 4:.1f}" '
            f'x2="{scale_x:.1f}" y2="{scale_y + 4:.1f}" stroke="#333" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<line x1="{scale_x + scale_len / 2:.1f}" y1="{scale_y - 4:.1f}" '
            f'x2="{scale_x + scale_len / 2:.1f}" y2="{scale_y + 4:.1f}" '
            f'stroke="#333" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<line x1="{scale_x + scale_len:.1f}" y1="{scale_y - 4:.1f}" '
            f'x2="{scale_x + scale_len:.1f}" y2="{scale_y + 4:.1f}" '
            f'stroke="#333" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<text x="{scale_x + scale_len / 2:.1f}" y="{scale_y + 14:.1f}" '
            f'text-anchor="middle" font-size="10" fill="#555" '
            f'font-family="sans-serif">2.0 m</text>'
        )

        svg_parts.append("</svg>")
        return "\n".join(svg_parts)

    def get_svg_details(self) -> str:
        """
        Build and return an SVG string with cross-section construction details for ALL
        retaining walls and support beams in the model.
        - Each retaining wall (MC-1, MC-2, ...) is rendered in its own CAD panel.
        - Each support beam (VA-1, VA-2, ...) is rendered in its own CAD panel.
        If neither exists, returns empty string "".
        """
        import re as _re

        rw_designs = getattr(self, 'retaining_wall_designs', [])
        rw_objs = getattr(self, 'retaining_walls', [])
        sb_designs = getattr(self, 'support_beam_designs', [])
        sb_objs = getattr(self, 'support_beams', [])

        n_rw = max(len(rw_designs), len(rw_objs))
        n_sb = max(len(sb_designs), len(sb_objs))

        if n_rw == 0 and n_sb == 0:
            return ""

        n_rows = max(n_rw, n_sb)
        has_rw = n_rw > 0
        has_sb = n_sb > 0

        if has_rw and has_sb:
            svg_w = 1000
            max_w_style = "100%"
        else:
            svg_w = 500
            max_w_style = "500px"

        svg_h = n_rows * 500

        svg_parts: list = []
        svg_parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w} {svg_h}" '
            f'style="width:100%;max-width:{max_w_style};max-height:{svg_h}px;border:1px solid #cbd5e1;'
            f'border-radius:8px;background:#ffffff;margin:20px auto;display:block;">'
            f'<defs>'
            f'  <pattern id="concreteHatch" width="16" height="16" patternUnits="userSpaceOnUse">'
            f'    <rect width="16" height="16" fill="#f8fafc"/>'
            f'    <circle cx="3" cy="4" r="0.8" fill="#94a3b8"/>'
            f'    <circle cx="11" cy="12" r="0.8" fill="#94a3b8"/>'
            f'    <path d="M 6 9 L 8 12 L 10 9 Z" fill="none" stroke="#cbd5e1" stroke-width="0.6"/>'
            f'    <path d="M 0 16 L 16 0 M -4 4 L 4 -4 M 12 20 L 20 12" fill="none" stroke="#f1f5f9" stroke-width="0.8"/>'
            f'  </pattern>'
            f'  <marker id="arr_cad" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">'
            f'    <path d="M0,0 L0,6 L6,3 z" fill="#000000"/>'
            f'  </marker>'
            f'</defs>'
        )

        for row_idx in range(n_rows):
            y_off = row_idx * 500

            # ----------------------------------------------------------------
            # LEFT PANEL — Muro de Contención CAD (x: 0..480)
            # ----------------------------------------------------------------
            if row_idx < n_rw:
                wd = rw_designs[row_idx] if row_idx < len(rw_designs) else None
                rw_obj = rw_objs[row_idx] if row_idx < len(rw_objs) else None

                rw_soil_h = float(getattr(rw_obj, 'soil_height', 1.5)) if rw_obj else 1.5
                rw_thick_m = float(getattr(rw_obj, 'thickness', 0.20)) if rw_obj else 0.20
                if wd:
                    rw_soil_h = float(wd.get('H_m', rw_soil_h))
                    rw_thick_m = float(wd.get('thickness_m', rw_thick_m))

                rw_thick_cm = round(rw_thick_m * 100)

                rw_trac_lbl = "Ø10@29cm"
                rw_comp_lbl = "Ø10@30cm"
                rw_horiz_trac_lbl = "Ø10@26cm"
                rw_horiz_comp_lbl = "Ø10@26cm"
                bar_diam_mm = 10
                if wd:
                    rw_trac_lbl = wd.get('rebar_trac_vert') or "Ø10@29cm"
                    rw_comp_lbl = wd.get('rebar_comp_vert') or "Ø10@30cm"
                    rw_horiz_trac_lbl = wd.get('rebar_trac_horiz') or "Ø10@26cm"
                    rw_horiz_comp_lbl = wd.get('rebar_comp_horiz') or "Ø10@26cm"
                    m_d = _re.search(r'Ø(\d+)', rw_trac_lbl)
                    if m_d:
                        bar_diam_mm = int(m_d.group(1))

                ld_mm = max(40 * bar_diam_mm, 300)
                ld_cm = round(ld_mm / 10)

                scale_px_per_cm = 3.2
                max_h_px = 310
                stem_h_px = min(max_h_px, max(170, int(rw_soil_h * 130)))
                stem_w_px = max(35, min(120, int(rw_thick_cm * scale_px_per_cm)))
                pata_px = max(85, min(160, int(ld_cm * 1.7)))
                base_h_px = 38
                cover_px = 8

                stem_left_x = 135
                stem_right_x = stem_left_x + stem_w_px
                stem_top_y = 95 + y_off
                stem_bot_y = stem_top_y + stem_h_px
                foot_right_x = stem_right_x + pata_px

                mc_title = f"DETALLE MURO DE CONTENCIÓN MC-{row_idx + 1}"

                svg_parts.append(f'<g id="mc_detail_cad_{row_idx+1}">')
                svg_parts.append(
                    f'<text x="220" y="{38 + y_off}" text-anchor="middle" font-size="17" font-weight="bold" '
                    f'font-family="\'Consolas\', \'Roboto Mono\', \'Courier New\', monospace" fill="#000000">'
                    f'{mc_title}</text>'
                )

                pts = (
                    f"{stem_left_x},{stem_top_y} "
                    f"{stem_right_x},{stem_top_y} "
                    f"{stem_right_x},{stem_bot_y} "
                    f"{foot_right_x},{stem_bot_y} "
                    f"{foot_right_x},{stem_bot_y + base_h_px} "
                    f"{stem_left_x},{stem_bot_y + base_h_px}"
                )
                svg_parts.append(
                    f'<polygon points="{pts}" fill="url(#concreteHatch)" stroke="#000000" stroke-width="2.8"/>'
                )
                mid_foot_y = stem_bot_y + base_h_px / 2
                break_foot_path = (
                    f"M {foot_right_x:.1f} {stem_bot_y - 6:.1f} "
                    f"L {foot_right_x:.1f} {mid_foot_y - 8:.1f} "
                    f"L {foot_right_x + 9:.1f} {mid_foot_y - 2:.1f} "
                    f"L {foot_right_x - 9:.1f} {mid_foot_y + 2:.1f} "
                    f"L {foot_right_x:.1f} {mid_foot_y + 8:.1f} "
                    f"L {foot_right_x:.1f} {stem_bot_y + base_h_px + 6:.1f}"
                )
                svg_parts.append(
                    f'<path d="{break_foot_path}" fill="none" stroke="#000000" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>'
                )

                trac_x = stem_right_x - cover_px - 4
                comp_x = stem_left_x + cover_px + 4
                pata_y = stem_bot_y + base_h_px - cover_px - 4

                svg_parts.append(
                    f'<path d="M {trac_x:.1f} {stem_top_y + 10} L {trac_x:.1f} {pata_y:.1f} '
                    f'L {foot_right_x - 15:.1f} {pata_y:.1f}" fill="none" stroke="#000000" stroke-width="2.5" stroke-linejoin="round"/>'
                )

                svg_parts.append(
                    f'<path d="M {comp_x:.1f} {stem_top_y + 10} L {comp_x:.1f} {pata_y - 8:.1f} '
                    f'L {foot_right_x - 15:.1f} {pata_y - 8:.1f}" fill="none" stroke="#000000" stroke-width="2.2" stroke-linejoin="round"/>'
                )

                dot_spacing = 34
                for bar_y in range(stem_top_y + 25, stem_bot_y - 12, dot_spacing):
                    svg_parts.append(f'<circle cx="{trac_x - 6:.1f}" cy="{bar_y:.1f}" r="3.5" fill="#000000"/>')
                    svg_parts.append(f'<circle cx="{comp_x + 6:.1f}" cy="{bar_y:.1f}" r="3.5" fill="#000000"/>')

                call_trac_h_x1 = trac_x - 6
                call_trac_h_y1 = stem_top_y + 40
                call_trac_h_x2 = stem_right_x + 50
                call_trac_h_y2 = stem_top_y + 65
                call_trac_h_end = stem_right_x + 100
                svg_parts.append(
                    f'<line x1="{call_trac_h_x1:.1f}" y1="{call_trac_h_y1:.1f}" x2="{call_trac_h_x2:.1f}" y2="{call_trac_h_y2:.1f}" stroke="#1d4ed8" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<line x1="{call_trac_h_x2:.1f}" y1="{call_trac_h_y2:.1f}" x2="{call_trac_h_end:.1f}" y2="{call_trac_h_y2:.1f}" stroke="#1d4ed8" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<text x="{call_trac_h_end + 6:.1f}" y="{call_trac_h_y2 + 4:.1f}" font-size="13" font-weight="bold" font-family="monospace" fill="#1d4ed8">{rw_horiz_trac_lbl}</text>'
                )

                call_trac_v_x1 = trac_x
                call_trac_v_y1 = stem_top_y + 110
                call_trac_v_x2 = stem_right_x + 50
                call_trac_v_y2 = stem_top_y + 140
                call_trac_v_end = stem_right_x + 100
                svg_parts.append(
                    f'<line x1="{call_trac_v_x1:.1f}" y1="{call_trac_v_y1:.1f}" x2="{call_trac_v_x2:.1f}" y2="{call_trac_v_y2:.1f}" stroke="#1d4ed8" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<line x1="{call_trac_v_x2:.1f}" y1="{call_trac_v_y2:.1f}" x2="{call_trac_v_end:.1f}" y2="{call_trac_v_y2:.1f}" stroke="#1d4ed8" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<text x="{call_trac_v_end + 6:.1f}" y="{call_trac_v_y2 + 4:.1f}" font-size="13" font-weight="bold" font-family="monospace" fill="#1d4ed8">{rw_trac_lbl}</text>'
                )

                call_comp_h_x1 = comp_x + 6
                call_comp_h_y1 = stem_top_y + 40
                call_comp_h_x2 = stem_left_x - 30
                call_comp_h_y2 = stem_top_y + 70
                call_comp_h_end = stem_left_x - 70
                svg_parts.append(
                    f'<line x1="{call_comp_h_x1:.1f}" y1="{call_comp_h_y1:.1f}" x2="{call_comp_h_x2:.1f}" y2="{call_comp_h_y2:.1f}" stroke="#15803d" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<line x1="{call_comp_h_x2:.1f}" y1="{call_comp_h_y2:.1f}" x2="{call_comp_h_end:.1f}" y2="{call_comp_h_y2:.1f}" stroke="#15803d" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<text x="{call_comp_h_end - 6:.1f}" y="{call_comp_h_y2 + 4:.1f}" text-anchor="end" font-size="13" font-weight="bold" font-family="monospace" fill="#15803d">{rw_horiz_comp_lbl}</text>'
                )

                call_comp_v_x1 = comp_x
                call_comp_v_y1 = stem_top_y + 140
                call_comp_v_x2 = stem_left_x - 30
                call_comp_v_y2 = stem_top_y + 175
                call_comp_v_end = stem_left_x - 70
                svg_parts.append(
                    f'<line x1="{call_comp_v_x1:.1f}" y1="{call_comp_v_y1:.1f}" x2="{call_comp_v_x2:.1f}" y2="{call_comp_v_y2:.1f}" stroke="#15803d" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<line x1="{call_comp_v_x2:.1f}" y1="{call_comp_v_y2:.1f}" x2="{call_comp_v_end:.1f}" y2="{call_comp_v_y2:.1f}" stroke="#15803d" stroke-width="1.5" fill="none"/>'
                )
                svg_parts.append(
                    f'<text x="{call_comp_v_end - 6:.1f}" y="{call_comp_v_y2 + 4:.1f}" text-anchor="end" font-size="13" font-weight="bold" font-family="monospace" fill="#15803d">{rw_comp_lbl}</text>'
                )

                cota_top_y = stem_top_y - 25
                svg_parts.append(
                    f'<line x1="{stem_left_x:.1f}" y1="{cota_top_y:.1f}" x2="{stem_right_x:.1f}" y2="{cota_top_y:.1f}" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<line x1="{stem_left_x - 4:.1f}" y1="{cota_top_y + 4:.1f}" x2="{stem_left_x + 4:.1f}" y2="{cota_top_y - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(f'<line x1="{stem_right_x - 4:.1f}" y1="{cota_top_y + 4:.1f}" x2="{stem_right_x + 4:.1f}" y2="{cota_top_y - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(
                    f'<text x="{(stem_left_x + stem_right_x)/2:.1f}" y="{cota_top_y - 6:.1f}" text-anchor="middle" font-size="14.5" font-weight="bold" font-family="monospace" fill="#000000">{rw_thick_m:.2f}</text>'
                )

                cota_bot_y = stem_bot_y + base_h_px + 24
                svg_parts.append(
                    f'<line x1="{stem_left_x:.1f}" y1="{cota_bot_y:.1f}" x2="{foot_right_x:.1f}" y2="{cota_bot_y:.1f}" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<line x1="{stem_left_x - 4:.1f}" y1="{cota_bot_y + 4:.1f}" x2="{stem_left_x + 4:.1f}" y2="{cota_bot_y - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(f'<line x1="{foot_right_x - 4:.1f}" y1="{cota_bot_y + 4:.1f}" x2="{foot_right_x + 4:.1f}" y2="{cota_bot_y - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(
                    f'<text x="{(stem_left_x + foot_right_x)/2:.1f}" y="{cota_bot_y + 18:.1f}" text-anchor="middle" font-size="14" font-weight="bold" font-family="monospace" fill="#000000">ld ≈ {ld_cm} cm</text>'
                )

                svg_parts.append('</g>')

            # ----------------------------------------------------------------
            # RIGHT PANEL — Viga de Apoyo CAD (x: 500..980)
            # ----------------------------------------------------------------
            if row_idx < n_sb:
                sd = sb_designs[row_idx] if row_idx < len(sb_designs) else None
                sb_obj = sb_objs[row_idx] if row_idx < len(sb_objs) else None

                sb_b_cm = round(float(getattr(sb_obj, 'width', 0.30)) * 100) if sb_obj else 30
                sb_h_cm = round(float(getattr(sb_obj, 'depth', 0.50)) * 100) if sb_obj else 50
                if sd:
                    sb_b_cm = round(float(sd.get('b_m', sb_b_cm / 100)) * 100)
                    sb_h_cm = round(float(sd.get('h_m', sb_h_cm / 100)) * 100)

                slab_h_m = float(getattr(self, 'h', 0.20))
                slab_h_cm = round(slab_h_m * 100)

                n_bot = sd.get('n_bars_bot', 2) if sd else 2
                n_top = sd.get('n_bars_top', 2) if sd else 2
                stirrup_lbl = sd.get('proposed_stirrups', 'Ø8 @ 15 cm') if sd else 'Ø8 @ 15 cm'

                d_bot_mm = 16
                d_top_mm = 12
                if sd:
                    pr_beam = sd.get('proposed_rebar', '')
                    m_beam = _re.match(r'(\d+)Ø(\d+) Inf \+ (\d+)Ø(\d+)', pr_beam)
                    if m_beam:
                        n_bot = int(m_beam.group(1))
                        d_bot_mm = int(m_beam.group(2))
                        n_top = int(m_beam.group(3))
                        d_top_mm = int(m_beam.group(4))

                panel_cx = 740
                panel_cy = 250 + y_off
                scale_px_per_cm = 3.6
                b_px = max(65, min(160, int(sb_b_cm * scale_px_per_cm)))
                h_px = max(140, min(290, int(b_px * (sb_h_cm / max(sb_b_cm, 1)))))
                bx1 = panel_cx - b_px / 2
                by1 = panel_cy - h_px / 2
                cover_beam = max(12, min(22, int(b_px * 0.18)))
                sx1 = bx1 + cover_beam
                sy1 = by1 + cover_beam
                sw = b_px - 2 * cover_beam
                sh = h_px - 2 * cover_beam

                slab_h_px = max(28, int(h_px * (slab_h_cm / max(sb_h_cm, 1))))
                wing_w = 48

                g_transform = f' transform="translate(-490, {y_off})"' if not has_rw else f' transform="translate(0, {y_off})"'
                va_title = f"DETALLE VIGA DE APOYO VA-{row_idx + 1}"

                svg_parts.append(f'<g id="va_detail_cad_{row_idx+1}"{g_transform}>')
                svg_parts.append(
                    f'<text x="740" y="{38 + y_off}" text-anchor="middle" font-size="17" font-weight="bold" '
                    f'font-family="\'Consolas\', \'Roboto Mono\', \'Courier New\', monospace" fill="#000000">'
                    f'{va_title}</text>'
                )

                slab_break_x = bx1 - wing_w
                beam_poly = (
                    f"M {slab_break_x:.1f} {by1:.1f} "
                    f"L {bx1 + b_px:.1f} {by1:.1f} "
                    f"L {bx1 + b_px:.1f} {by1 + h_px:.1f} "
                    f"L {bx1:.1f} {by1 + h_px:.1f} "
                    f"L {bx1:.1f} {by1 + slab_h_px:.1f} "
                    f"L {slab_break_x:.1f} {by1 + slab_h_px:.1f} Z"
                )
                svg_parts.append(
                    f'<path d="{beam_poly}" fill="url(#concreteHatch)" stroke="#000000" stroke-width="2.8" stroke-linejoin="miter"/>'
                )

                mid_slab_y = by1 + slab_h_px / 2
                break_path = (
                    f"M {slab_break_x:.1f} {by1 - 6:.1f} "
                    f"L {slab_break_x:.1f} {mid_slab_y - 8:.1f} "
                    f"L {slab_break_x + 9:.1f} {mid_slab_y - 2:.1f} "
                    f"L {slab_break_x - 9:.1f} {mid_slab_y + 2:.1f} "
                    f"L {slab_break_x:.1f} {mid_slab_y + 8:.1f} "
                    f"L {slab_break_x:.1f} {by1 + slab_h_px + 6:.1f}"
                )
                svg_parts.append(
                    f'<path d="{break_path}" fill="none" stroke="#000000" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>'
                )

                svg_parts.append(
                    f'<rect x="{sx1:.1f}" y="{sy1:.1f}" width="{sw:.1f}" height="{sh:.1f}" '
                    f'fill="none" stroke="#000000" stroke-width="2.2"/>'
                )

                hook_len = max(8, min(14, int(sw * 0.35)))
                hook_off = max(3, min(8, int(sw * 0.15)))
                svg_parts.append(
                    f'<line x1="{sx1 + hook_off:.1f}" y1="{sy1 + hook_off + 6:.1f}" x2="{sx1 + hook_off + hook_len:.1f}" y2="{sy1 + hook_off + 6 + hook_len:.1f}" stroke="#000000" stroke-width="2.0" stroke-linecap="round"/>'
                )
                svg_parts.append(
                    f'<line x1="{sx1 + hook_off + 6:.1f}" y1="{sy1 + hook_off:.1f}" x2="{sx1 + hook_off + 6 + hook_len:.1f}" y2="{sy1 + hook_off + hook_len:.1f}" stroke="#000000" stroke-width="2.0" stroke-linecap="round"/>'
                )

                r_rebar = max(3.5, min(5.0, sw * 0.12))

                bot_y_l1 = sy1 + sh - r_rebar - 3
                bot_xs = [sx1 + r_rebar + 3, sx1 + sw - r_rebar - 3]
                bot_y = bot_y_l1
                if n_bot <= 2:
                    for r_x in bot_xs:
                        svg_parts.append(f'<circle cx="{r_x:.1f}" cy="{bot_y_l1:.1f}" r="{r_rebar:.1f}" fill="#000000"/>')
                else:
                    for r_x in bot_xs:
                        svg_parts.append(f'<circle cx="{r_x:.1f}" cy="{bot_y_l1:.1f}" r="{r_rebar:.1f}" fill="#000000"/>')
                    bot_y_l2 = bot_y_l1 - 2 * r_rebar - 6
                    n_l2 = n_bot - 2
                    if n_l2 == 1:
                        svg_parts.append(f'<circle cx="{sx1 + sw/2:.1f}" cy="{bot_y_l2:.1f}" r="{r_rebar:.1f}" fill="#000000"/>')
                    else:
                        for r_x in bot_xs:
                            svg_parts.append(f'<circle cx="{r_x:.1f}" cy="{bot_y_l2:.1f}" r="{r_rebar:.1f}" fill="#000000"/>')

                n_top_draw = max(2, min(n_top, 4))
                top_xs = [sx1 + r_rebar + 3 + (sw - 2 * r_rebar - 6) * i / (n_top_draw - 1) for i in range(n_top_draw)]
                top_y = sy1 + r_rebar + 3
                for r_x in top_xs:
                    svg_parts.append(f'<circle cx="{r_x:.1f}" cy="{top_y:.1f}" r="{r_rebar:.1f}" fill="#000000"/>')

                call_right_start_x = bx1 + b_px + 22
                call_right_end_x = call_right_start_x + 110

                svg_parts.append(
                    f'<path d="M {top_xs[-1]:.1f} {top_y:.1f} L {call_right_start_x:.1f} {top_y - 20:.1f} H {call_right_end_x:.1f}" '
                    f'fill="none" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<circle cx="{top_xs[-1]:.1f}" cy="{top_y:.1f}" r="3" fill="#000000"/>')
                svg_parts.append(
                    f'<text x="{call_right_start_x + 6:.1f}" y="{top_y - 25:.1f}" font-size="14.5" font-weight="bold" font-family="monospace" fill="#000000">{n_top} - Ø{d_top_mm}</text>'
                )

                call_mid_y = panel_cy
                svg_parts.append(
                    f'<path d="M {sx1 + sw:.1f} {call_mid_y:.1f} L {call_right_start_x:.1f} {call_mid_y:.1f} H {call_right_end_x:.1f}" '
                    f'fill="none" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<circle cx="{sx1 + sw:.1f}" cy="{call_mid_y:.1f}" r="3" fill="#000000"/>')
                svg_parts.append(
                    f'<text x="{call_right_start_x + 6:.1f}" y="{call_mid_y - 6:.1f}" font-size="14.5" font-weight="bold" font-family="monospace" fill="#000000">Est. {stirrup_lbl}</text>'
                )

                svg_parts.append(
                    f'<path d="M {bot_xs[-1]:.1f} {bot_y:.1f} L {call_right_start_x:.1f} {bot_y + 20:.1f} H {call_right_end_x:.1f}" '
                    f'fill="none" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<circle cx="{bot_xs[-1]:.1f}" cy="{bot_y:.1f}" r="3" fill="#000000"/>')
                svg_parts.append(
                    f'<text x="{call_right_start_x + 6:.1f}" y="{bot_y + 15:.1f}" font-size="14.5" font-weight="bold" font-family="monospace" fill="#000000">{n_bot} - Ø{d_bot_mm}</text>'
                )

                cuelgue_h_cm = max(0, sb_h_cm - slab_h_cm)
                dim_h_x1 = bx1 - wing_w - 20
                dim_h_x2 = dim_h_x1 - 45

                svg_parts.append(
                    f'<line x1="{dim_h_x1:.1f}" y1="{by1:.1f}" x2="{dim_h_x1:.1f}" y2="{by1 + slab_h_px:.1f}" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<line x1="{dim_h_x1 - 4:.1f}" y1="{by1 + 4:.1f}" x2="{dim_h_x1 + 4:.1f}" y2="{by1 - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(f'<line x1="{dim_h_x1 - 4:.1f}" y1="{by1 + slab_h_px + 4:.1f}" x2="{dim_h_x1 + 4:.1f}" y2="{by1 + slab_h_px - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(
                    f'<text x="{dim_h_x1 - 8:.1f}" y="{by1 + slab_h_px / 2:.1f}" text-anchor="middle" font-size="13" font-weight="bold" '
                    f'font-family="monospace" fill="#000000" transform="rotate(-90,{dim_h_x1 - 8:.1f},{by1 + slab_h_px / 2:.1f})">'
                    f'{slab_h_cm} cm</text>'
                )

                svg_parts.append(
                    f'<line x1="{dim_h_x1:.1f}" y1="{by1 + slab_h_px:.1f}" x2="{dim_h_x1:.1f}" y2="{by1 + h_px:.1f}" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<line x1="{dim_h_x1 - 4:.1f}" y1="{by1 + h_px + 4:.1f}" x2="{dim_h_x1 + 4:.1f}" y2="{by1 + h_px - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                mid_cuelgue_y = by1 + slab_h_px + (h_px - slab_h_px) / 2
                svg_parts.append(
                    f'<text x="{dim_h_x1 - 8:.1f}" y="{mid_cuelgue_y:.1f}" text-anchor="middle" font-size="13" font-weight="bold" '
                    f'font-family="monospace" fill="#000000" transform="rotate(-90,{dim_h_x1 - 8:.1f},{mid_cuelgue_y:.1f})">'
                    f'{cuelgue_h_cm} cm</text>'
                )

                svg_parts.append(
                    f'<line x1="{dim_h_x2:.1f}" y1="{by1:.1f}" x2="{dim_h_x2:.1f}" y2="{by1 + h_px:.1f}" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<line x1="{dim_h_x2 - 4:.1f}" y1="{by1 + 4:.1f}" x2="{dim_h_x2 + 4:.1f}" y2="{by1 - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(f'<line x1="{dim_h_x2 - 4:.1f}" y1="{by1 + h_px + 4:.1f}" x2="{dim_h_x2 + 4:.1f}" y2="{by1 + h_px - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(
                    f'<text x="{dim_h_x2 - 9:.1f}" y="{panel_cy:.1f}" text-anchor="middle" font-size="14" font-weight="bold" '
                    f'font-family="monospace" fill="#000000" transform="rotate(-90,{dim_h_x2 - 9:.1f},{panel_cy:.1f})">'
                    f'{sb_h_cm} cm</text>'
                )

                dim_b_y = by1 - 22
                svg_parts.append(
                    f'<line x1="{bx1:.1f}" y1="{dim_b_y:.1f}" x2="{bx1 + b_px:.1f}" y2="{dim_b_y:.1f}" stroke="#000000" stroke-width="1.2"/>'
                )
                svg_parts.append(f'<line x1="{bx1 - 4:.1f}" y1="{dim_b_y + 4:.1f}" x2="{bx1 + 4:.1f}" y2="{dim_b_y - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(f'<line x1="{bx1 + b_px - 4:.1f}" y1="{dim_b_y + 4:.1f}" x2="{bx1 + b_px + 4:.1f}" y2="{dim_b_y - 4:.1f}" stroke="#000000" stroke-width="1.8"/>')
                svg_parts.append(
                    f'<text x="{panel_cx:.1f}" y="{dim_b_y - 6:.1f}" text-anchor="middle" font-size="14.5" font-weight="bold" font-family="monospace" fill="#000000">b = {sb_b_cm} cm</text>'
                )

                svg_parts.append('</g>')

        svg_parts.append('</svg>')
        return '\n'.join(svg_parts)

    # ------------------------------------------------------------------
    # HTML plan sketch export

    def export_plan_sketch(
        self, filepath: str = "plano_armado.html", load_factor: float = 1.5
    ) -> None:
        """
        Export the reinforcement plan as a self-contained HTML file with embedded SVG.

        Parameters
        ----------
        filepath    : output HTML file path
        load_factor : kept for API compatibility (unused internally)
        """
        margin = 80
        svg_w = 700
        svg_h = 700
        plot_size = min(svg_w, svg_h) - 2 * margin
        scale = plot_size / max(self.Lx, self.Ly)

        def to_svg(x: float, y: float) -> tuple:
            return (margin + x * scale, margin + (self.Ly - y) * scale)

        svg_parts = []
        svg_parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w} {svg_h}" '
            f'style="width:100%;max-height:600px;border:1px solid #ccc;'
            f'border-radius:8px;background:#fafafa;">'
        )

        # Grid
        for i in range(self.nx + 1):
            x = i * self.dx
            x1, y1 = to_svg(x, 0)
            x2, y2 = to_svg(x, self.Ly)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#e0e0e0" stroke-width="0.8"/>'
            )
        for j in range(self.ny + 1):
            y = j * self.dy
            x1, y1 = to_svg(0, y)
            x2, y2 = to_svg(self.Lx, y)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#e0e0e0" stroke-width="0.8"/>'
            )

        # Bands
        for wall in self.walls:
            dxw = wall.x2 - wall.x1
            dyw = wall.y2 - wall.y1
            length = wall.length
            if length < 1e-6:
                continue
            nx_vec = -dyw / length
            ny_vec = dxw / length
            hw = wall.band_width / 2.0
            band_corners = [
                (wall.x1 + nx_vec * hw, wall.y1 + ny_vec * hw),
                (wall.x1 - nx_vec * hw, wall.y1 - ny_vec * hw),
                (wall.x2 - nx_vec * hw, wall.y2 - ny_vec * hw),
                (wall.x2 + nx_vec * hw, wall.y2 + ny_vec * hw),
            ]
            pts = " ".join(
                [
                    f"{to_svg(cx, cy)[0]:.1f},{to_svg(cx, cy)[1]:.1f}"
                    for cx, cy in band_corners
                ]
            )
            svg_parts.append(
                f'<polygon points="{pts}" fill="rgba(255,193,7,0.25)" '
                f'stroke="#f9a825" stroke-width="1.5"/>'
            )

        # Tie beams
        for beam in self.beams:
            x1, y1 = to_svg(beam.x1, beam.y1)
            x2, y2 = to_svg(beam.x2, beam.y2)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#4caf50" stroke-width="5" stroke-linecap="round" opacity="0.85"/>'
            )

        # Walls
        for wall in self.walls:
            color = "#e53935" if wall.wall_type == "perimetral" else "#1e88e5"
            width_px = max(2, wall.thickness * scale)
            x1, y1 = to_svg(wall.x1, wall.y1)
            x2, y2 = to_svg(wall.x2, wall.y2)
            svg_parts.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="{color}" stroke-width="{width_px:.1f}" stroke-linecap="round"/>'
            )

        # Dimension annotations
        cota_y = margin - 35
        x_left, _ = to_svg(0, self.Ly)
        x_right, _ = to_svg(self.Lx, self.Ly)
        svg_parts.append(
            f'<line x1="{x_left:.1f}" y1="{cota_y:.1f}" x2="{x_right:.1f}" y2="{cota_y:.1f}" '
            f'stroke="#555" stroke-width="1" marker-end="url(#arrow)" marker-start="url(#arrow)"/>'
        )
        svg_parts.append(
            f'<text x="{(x_left + x_right) / 2:.1f}" y="{cota_y - 6:.1f}" '
            f'text-anchor="middle" font-size="11" fill="#555" '
            f'font-family="sans-serif">{self.Lx:.2f} m</text>'
        )

        cota_x = margin - 35
        _, y_bottom = to_svg(0, 0)
        _, y_top = to_svg(0, self.Ly)
        svg_parts.append(
            f'<line x1="{cota_x:.1f}" y1="{y_bottom:.1f}" x2="{cota_x:.1f}" y2="{y_top:.1f}" '
            f'stroke="#555" stroke-width="1" marker-end="url(#arrow)" marker-start="url(#arrow)"/>'
        )
        svg_parts.append(
            f'<text x="{cota_x - 6:.1f}" y="{(y_bottom + y_top) / 2:.1f}" '
            f'text-anchor="middle" font-size="11" fill="#555" font-family="sans-serif" '
            f'transform="rotate(-90, {cota_x - 6:.1f}, {(y_bottom + y_top) / 2:.1f})">'
            f'{self.Ly:.2f} m</text>'
        )

        # Scale bar
        scale_x = margin
        scale_y = svg_h - margin + 40
        scale_len = 2.0 * scale
        svg_parts.append(
            f'<line x1="{scale_x:.1f}" y1="{scale_y:.1f}" '
            f'x2="{scale_x + scale_len:.1f}" y2="{scale_y:.1f}" stroke="#333" stroke-width="2"/>'
        )
        svg_parts.append(
            f'<line x1="{scale_x:.1f}" y1="{scale_y - 4:.1f}" '
            f'x2="{scale_x:.1f}" y2="{scale_y + 4:.1f}" stroke="#333" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<line x1="{scale_x + scale_len / 2:.1f}" y1="{scale_y - 4:.1f}" '
            f'x2="{scale_x + scale_len / 2:.1f}" y2="{scale_y + 4:.1f}" '
            f'stroke="#333" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<line x1="{scale_x + scale_len:.1f}" y1="{scale_y - 4:.1f}" '
            f'x2="{scale_x + scale_len:.1f}" y2="{scale_y + 4:.1f}" '
            f'stroke="#333" stroke-width="1"/>'
        )
        svg_parts.append(
            f'<text x="{scale_x + scale_len / 2:.1f}" y="{scale_y + 14:.1f}" '
            f'text-anchor="middle" font-size="10" fill="#555" '
            f'font-family="sans-serif">2.0 m</text>'
        )
        svg_parts.append("</svg>")
        svg_str = "\n".join(svg_parts)

        # --- HTML reinforcement table ---
        rows_html = []
        for b in self.band_data:
            bx = b.get("bar_x", {})
            by = b.get("bar_y", {})
            px = (
                f"Ø{bx.get('diam_mm', 0)}@{bx.get('sep_m', 0) * 100:.0f} cm"
                if bx.get("diam_mm", 0) > 0
                else "Mínimo"
            )
            py = (
                f"Ø{by.get('diam_mm', 0)}@{by.get('sep_m', 0) * 100:.0f} cm"
                if by.get("diam_mm", 0) > 0
                else "Mínimo"
            )
            muro_id = f"M{b['id'] + 1}"
            tipo_tag = "Perimetral" if b["type"] == "perimetral" else "Interno"
            rows_html.append(
                f"""
            <tr>
                <td>{muro_id}</td>
                <td>{tipo_tag}</td>
                <td>{b['band_width']:.2f} m</td>
                <td>{b['Mx_design_kNm_m']:.2f}</td>
                <td>{b['My_design_kNm_m']:.2f}</td>
                <td>{b['Asx_cm2_m']:.2f}</td>
                <td>{b['Asy_cm2_m']:.2f}</td>
                <td>{px}</td>
                <td>{py}</td>
                <td style="color:#2e7d32;font-weight:600;">OK</td>
            </tr>"""
            )

        As_min = self.rho_min * 1.0 * self.h * 1e4
        rows_html.append(
            f"""
            <tr style="opacity:0.75;">
                <td colspan="2">Zona intermedia</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>{As_min:.2f}</td>
                <td>{As_min:.2f}</td>
                <td>Ø10 @ 15 cm</td>
                <td>Ø10 @ 15 cm</td>
                <td style="color:#2e7d32;font-weight:600;">Min</td>
            </tr>"""
        )

        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Plano de Armado — Losa de Cimentación</title>
<style>
  body {{ font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #222; background: #fff; }}
  h1 {{ font-size: 18px; margin-bottom: 4px; }}
  h2 {{ font-size: 14px; color: #555; margin-top: 0; margin-bottom: 16px; font-weight: 400; }}
  .meta {{ font-size: 12px; color: #666; margin-bottom: 16px; }}
  .legend {{ display: flex; flex-wrap: wrap; gap: 12px 20px; margin: 12px 0; font-size: 12px; }}
  .legend-item {{ display: flex; align-items: center; gap: 6px; }}
  .box {{ width: 14px; height: 10px; border-radius: 2px; }}
  .line {{ width: 14px; height: 3px; border-radius: 2px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }}
  th {{ text-align: left; padding: 8px; border-bottom: 2px solid #ddd; color: #555; font-weight: 600; white-space: nowrap; }}
  td {{ padding: 8px; border-bottom: 1px solid #eee; white-space: nowrap; }}
  tr:hover td {{ background: #f5f5f5; }}
  .note {{ font-size: 11px; color: #777; margin-top: 16px; line-height: 1.5; }}
  .tag {{ display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }}
  .tag-perim {{ background: #ffebee; color: #c62828; }}
  .tag-inner {{ background: #e3f2fd; color: #1565c0; }}
</style>
</head>
<body>

<h1>Croquis de Planta — Losa de Cimentación</h1>
<h2>{self.Lx:.2f} × {self.Ly:.2f} m · h = {self.h * 100:.0f} cm · H-{self.f_c:.0f} · d = {self.d_eff * 100:.1f} cm</h2>

<div class="meta">
  Grilla {self.nx}×{self.ny} · Suelo k = {self.k / 1e6:.1f} MN/m³ · fy = {self.f_y:.0f} MPa · γ = {self.gamma_horm} kg/m³
</div>

<svg style="position:absolute;width:0;height:0;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#555"/>
    </marker>
  </defs>
</svg>

{svg_str}

<div class="legend">
  <div class="legend-item"><div class="line" style="background:#e53935;"></div>Muro perimetral</div>
  <div class="legend-item"><div class="line" style="background:#1e88e5;"></div>Muro interno</div>
  <div class="legend-item"><div class="line" style="background:#4caf50;"></div>Viga amarre (20×30)</div>
  <div class="legend-item"><div class="box" style="background:rgba(255,193,7,0.25);border:1px solid #f9a825;"></div>Banda refuerzo</div>
</div>

<table>
  <thead>
    <tr>
      <th>Muro</th>
      <th>Tipo</th>
      <th>Ancho banda</th>
      <th>Mx diseño<br>(kN·m/m)</th>
      <th>My diseño<br>(kN·m/m)</th>
      <th>Asx<br>(cm²/m)</th>
      <th>Asy<br>(cm²/m)</th>
      <th>Propuesta X</th>
      <th>Propuesta Y</th>
      <th>Estado</th>
    </tr>
  </thead>
  <tbody>
    {''.join(rows_html)}
  </tbody>
</table>

<div class="note">
  <strong>Notas:</strong><br>
  • Bandas de refuerzo calculadas como espesor_muro + 2·h (mínimo 1.0 m), factorizado por band_width_factor.<br>
  • Armadura mínima fuera de bandas: ρ_min = 0.0018 → {As_min:.2f} cm²/m (ej. Ø10 @ 15 cm).<br>
  • Las propuestas de barra usan diámetros comerciales y separación redondeada a múltiplos de 2.5 cm.<br>
  • Verificar asentamientos diferenciales y cortante/punzonamiento en informe numérico.<br>
  • Este plano es esquemático; el detalle constructivo debe incluir recubrimiento, anclajes y junta de construcción si aplica.
</div>

</body>
</html>"""

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Plano de armado exportado: {filepath}")

    # ------------------------------------------------------------------
    # JSON summary export
    # ------------------------------------------------------------------

    def export_summary(self, filepath: str) -> None:
        """
        Export a JSON summary of all results.

        Parameters
        ----------
        filepath : output JSON file path
        """
        summary = {
            "geometry": {
                "Lx": self.Lx, "Ly": self.Ly, "h": self.h,
                "nx": self.nx, "ny": self.ny,
            },
            "materials": {
                "E_MPa": self.E / 1e6, "nu": self.nu,
                "f_c_MPa": self.f_c, "f_y_MPa": self.f_y,
                "k_N_m3": self.k, "d_eff_m": self.d_eff,
            },
            "results": {
                "w_max_mm": float(np.max(np.abs(self.w)) * 1000),
                "Mx_max_kNm_m": float(np.max(np.abs(self.Mx)) / 1000),
                "My_max_kNm_m": float(np.max(np.abs(self.My)) / 1000),
                "Vu_max_kN_m": float(np.max(self.Vu) / 1000),
                "Vc_kN_m": float(self.Vc / 1000),
                "phiVc_kN_m": float(self.phiVc / 1000),
                "shear_ok": bool(np.all(self.shear_ok)),
                "Asx_bot_max_cm2_m": float(np.max(self.Asx_bot) * 1e4),
                "Asy_bot_max_cm2_m": float(np.max(self.Asy_bot) * 1e4),
                "Asx_top_max_cm2_m": float(np.max(self.Asx_top) * 1e4),
                "Asy_top_max_cm2_m": float(np.max(self.Asy_top) * 1e4),
            },
            "bands": self.band_data,
            "settlements": self.settlement_data,
            "punching": self.punching_data,
            "walls": [asdict(w) for w in self.walls],
            "beams": [asdict(b) for b in self.beams],
        }
        with open(filepath, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"Resumen exportado: {filepath}")

    # ------------------------------------------------------------------
    # Matplotlib plots
    # ------------------------------------------------------------------

    def plot_results(self, save_path: str = None) -> None:
        """
        Generate 8-panel result plots using matplotlib.

        Parameters
        ----------
        save_path : optional file path to save the figure (PNG/SVG/PDF)

        Raises a user-friendly message if matplotlib is not installed.
        """
        try:
            import matplotlib.pyplot as plt
            from matplotlib.lines import Line2D
            from matplotlib.patches import Rectangle
        except ImportError:
            print(
                "plot_results requiere matplotlib. "
                "Instalar con: pip install matplotlib"
            )
            return

        fig, axes = plt.subplots(2, 4, figsize=(22, 11))
        fig.suptitle(
            f"Losa {self.Lx:.1f}x{self.Ly:.1f}m | h={self.h * 100:.0f}cm | "
            f"H-{self.f_c:.0f} | Grilla {self.nx}x{self.ny} | d={self.d_eff * 100:.1f}cm",
            fontsize=14,
            fontweight="bold",
        )

        # 1. Vertical displacement
        ax = axes[0, 0]
        im = ax.contourf(self.X, self.Y, self.w * 1000, levels=20, cmap="viridis")
        ax.set_title("Desplazamiento w [mm]")
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 2. Mx
        ax = axes[0, 1]
        vmax = float(np.max(np.abs(self.Mx / 1000)))
        im = ax.contourf(
            self.X, self.Y, self.Mx / 1000,
            levels=20, cmap="RdBu_r", vmin=-vmax, vmax=vmax,
        )
        ax.set_title("Momento Mx [kN·m/m]")
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 3. My
        ax = axes[0, 2]
        vmax = float(np.max(np.abs(self.My / 1000)))
        im = ax.contourf(
            self.X, self.Y, self.My / 1000,
            levels=20, cmap="RdBu_r", vmin=-vmax, vmax=vmax,
        )
        ax.set_title("Momento My [kN·m/m]")
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 4. Shear
        ax = axes[0, 3]
        im = ax.contourf(self.X, self.Y, self.Vu / 1000, levels=20, cmap="YlOrRd")
        ax.set_title(
            f"Cortante Vu [kN/m]\nphi_Vc={self.phiVc / 1000:.1f} kN/m"
        )
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 5. Bottom steel X (with bands)
        ax = axes[1, 0]
        im = ax.contourf(
            self.X, self.Y, self.Asx_bot * 1e4, levels=15, cmap="YlOrRd"
        )
        ax.set_title("As inferior X [cm²/m]\n(Bandas bajo muros)")
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 6. Bottom steel Y (with bands)
        ax = axes[1, 1]
        im = ax.contourf(
            self.X, self.Y, self.Asy_bot * 1e4, levels=15, cmap="YlOrRd"
        )
        ax.set_title("As inferior Y [cm²/m]\n(Bandas bajo muros)")
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 7. Shear ratio
        ax = axes[1, 2]
        im = ax.contourf(
            self.X, self.Y, self.shear_ratio, levels=15, cmap="RdYlGn_r"
        )
        ax.set_title(
            f"Ratio Vu/phi_Vc\n"
            f"{'CUMPLE OK' if np.all(self.shear_ok) else 'NO CUMPLE FAIL'}"
        )
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        plt.colorbar(im, ax=ax)

        # 8. Plan with bands and architecture
        ax = axes[1, 3]
        ax.set_xlim(0, self.Lx)
        ax.set_ylim(0, self.Ly)
        ax.set_aspect("equal")
        ax.set_title("Planta - Bandas de refuerzo")
        ax.set_xlabel("x [m]")
        ax.set_ylabel("y [m]")
        ax.grid(True, alpha=0.3)

        for wall in self.walls:
            dxw = wall.x2 - wall.x1
            dyw = wall.y2 - wall.y1
            length = wall.length
            if length < 1e-6:
                continue
            cx = (wall.x1 + wall.x2) / 2
            cy = (wall.y1 + wall.y2) / 2
            angle = float(np.degrees(np.arctan2(dyw, dxw)))
            rect = Rectangle(
                (cx - length / 2, -wall.band_width / 2),
                length, wall.band_width,
                angle=angle,
                rotation_point="center",
                facecolor="yellow",
                alpha=0.3,
                edgecolor="orange",
                linewidth=2,
            )
            ax.add_patch(rect)

        for wall in self.walls:
            color = "red" if wall.wall_type == "perimetral" else "blue"
            ax.plot(
                [wall.x1, wall.x2], [wall.y1, wall.y2],
                color=color, linewidth=4, solid_capstyle="round",
            )

        for beam in self.beams:
            ax.plot(
                [beam.x1, beam.x2], [beam.y1, beam.y2],
                color="green", linewidth=6, solid_capstyle="round", alpha=0.7,
            )

        legend_elements = [
            Line2D([0], [0], color="red", lw=4, label="Muro perimetral"),
            Line2D([0], [0], color="blue", lw=4, label="Muro interno"),
            Line2D([0], [0], color="green", lw=6, label="Viga amarre", alpha=0.7),
            Line2D(
                [0], [0],
                color="orange", lw=2, marker="s", markersize=10,
                markerfacecolor="yellow", alpha=0.5, label="Banda refuerzo",
            ),
        ]
        ax.legend(handles=legend_elements, loc="upper right", fontsize=9)

        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches="tight")
            print(f"Gráfico guardado: {save_path}")
        plt.close(fig)
