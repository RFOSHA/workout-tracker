<script lang="ts">
  import type { ProgressPoint } from '$lib/utils/strengthProgressLogic';

  export let points: ProgressPoint[];
  export let metric: 'weight' | 'est1rm' = 'weight';

  // SVG canvas
  const W = 400;
  const H = 200;
  const PAD = { left: 44, right: 16, top: 24, bottom: 40 };
  const PW = W - PAD.left - PAD.right; // 340
  const PH = H - PAD.top - PAD.bottom; // 136

  function epley(weight: number, reps: number) {
    return Math.round(weight * (1 + reps / 30));
  }

  $: values = points.map(p =>
    metric === 'est1rm' ? epley(p.bestWeight, p.bestReps) : p.bestWeight
  );

  $: rawMin = Math.min(...values);
  $: rawMax = Math.max(...values);
  $: rawRange = rawMax - rawMin || 1;

  // 15% padding above/below so points don't sit on the edge
  $: yMin = Math.max(0, rawMin - rawRange * 0.15);
  $: yMax = rawMax + rawRange * 0.15;
  $: yRange = yMax - yMin || 1;

  function xPos(i: number): number {
    if (points.length <= 1) return PAD.left + PW / 2;
    return PAD.left + (i / (points.length - 1)) * PW;
  }

  function yPos(val: number): number {
    return PAD.top + (1 - (val - yMin) / yRange) * PH;
  }

  $: linePoints = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');

  // Closed polygon for gradient area fill (line + bottom edge)
  $: areaPoints = [
    `${xPos(0)},${PAD.top + PH}`,
    ...values.map((v, i) => `${xPos(i)},${yPos(v)}`),
    `${xPos(values.length - 1)},${PAD.top + PH}`
  ].join(' ');

  // 4 evenly-spaced y-axis guide values
  $: yGuides = [0, 1/3, 2/3, 1].map(t => ({
    y: PAD.top + (1 - t) * PH,
    label: Math.round((yMin + t * yRange) / 5) * 5
  }));

  let hoveredIndex: number | null = null;

  function tooltipPos(i: number, cy: number) {
    const tipW = 130;
    const tipH = 54;
    const cx = xPos(i);
    const x = Math.min(Math.max(cx - tipW / 2, PAD.left), W - PAD.right - tipW);
    // Show above the point, flip below if it would clip the top
    const y = cy - tipH - 10 < PAD.top ? cy + 12 : cy - tipH - 10;
    return { x, y, tipW, tipH };
  }
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" style="height: 200px; overflow: visible;">
  <defs>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Y-axis guide lines + labels -->
  {#each yGuides as g}
    <line
      x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y}
      stroke="#374151" stroke-width="1" stroke-dasharray="4 4"
    />
    <text
      x={PAD.left - 6} y={g.y + 4}
      text-anchor="end" fill="#6b7280" font-size="10" font-family="monospace"
    >{g.label}</text>
  {/each}

  <!-- Area fill -->
  {#if points.length > 1}
    <polygon points={areaPoints} fill="url(#areaGrad)" />
  {/if}

  <!-- Trend line -->
  {#if points.length > 1}
    <polyline
      points={linePoints}
      fill="none" stroke="#3b82f6" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"
    />
  {/if}

  <!-- Data points -->
  {#each points as p, i}
    {@const cx = xPos(i)}
    {@const cy = yPos(values[i])}
    {@const hovered = hoveredIndex === i}

    <!-- X-axis label -->
    <text
      x={cx} y={H - 6}
      text-anchor="middle"
      fill={hovered ? '#93c5fd' : '#6b7280'}
      font-size="9" font-family="monospace"
    >{p.mesoName.length > 9 ? p.mesoName.slice(0, 9) + '…' : p.mesoName}</text>

    <!-- Hit-area (larger invisible circle for easy hover) -->
    <circle
      cx={cx} cy={cy} r="14"
      fill="transparent"
      on:mouseenter={() => hoveredIndex = i}
      on:mouseleave={() => hoveredIndex = null}
      class="cursor-pointer"
      role="img"
      aria-label="{p.mesoName}: {values[i]} lbs"
    />

    <!-- Visible dot -->
    <circle
      cx={cx} cy={cy} r={hovered ? 6 : 4}
      fill={hovered ? '#93c5fd' : '#3b82f6'}
      stroke={hovered ? '#1d4ed8' : '#1e3a8a'}
      stroke-width="2"
      style="pointer-events: none; transition: r 0.1s;"
    />

    <!-- Tooltip -->
    {#if hovered}
      {@const t = tooltipPos(i, cy)}
      <g style="pointer-events: none;">
        <rect
          x={t.x} y={t.y} width={t.tipW} height={t.tipH}
          rx="6" fill="#1f2937" stroke="#374151" stroke-width="1"
        />
        <text
          x={t.x + t.tipW / 2} y={t.y + 15}
          text-anchor="middle" fill="#e5e7eb" font-size="10" font-weight="bold"
        >{p.mesoName.length > 16 ? p.mesoName.slice(0, 16) + '…' : p.mesoName}</text>
        <text
          x={t.x + t.tipW / 2} y={t.y + 31}
          text-anchor="middle" fill="#93c5fd" font-size="13" font-weight="bold"
        >{values[i]} lbs</text>
        <text
          x={t.x + t.tipW / 2} y={t.y + 46}
          text-anchor="middle" fill="#9ca3af" font-size="9"
        >{p.bestWeight} × {p.bestReps} reps</text>
      </g>
    {/if}
  {/each}
</svg>
