interface PaceImage {
  title: string;
  goalLabel: string;
  goal: string;
  paceLabel: string;
  pace: string;
  distance: string;
  elapsed: string;
  rows: [string, string][];
  note: string;
  filename: string;
}

/** Render the same values as the visible table, without DOM capture or network requests. */
export async function downloadPaceImage(data: PaceImage) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 460 + data.rows.length * 70;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const text = (value: string, x: number, y: number, size: number, color = '#202c43', align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color;
    ctx.font = `${size >= 30 ? '600' : '400'} ${size}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(value, x, y, 880);
  };
  text('ITS RUN  /  PACE PLANNER', 60, 65, 20, '#3f51b5');
  text(data.title, 60, 125, 40);
  ctx.fillStyle = '#edf0fc';
  ctx.fillRect(40, 160, 920, 135);
  text(data.goalLabel, 60, 200, 22);
  text(data.goal, 60, 255, 40);
  text(data.paceLabel, 550, 200, 22);
  text(data.pace, 550, 255, 40);
  text(data.distance, 60, 345, 22);
  text(data.elapsed, 940, 345, 22, '#202c43', 'right');
  data.rows.forEach(([distance, time], index) => {
    const y = 360 + index * 70;
    if (index % 2 === 0) { ctx.fillStyle = '#f5f7fc'; ctx.fillRect(40, y, 920, 70); }
    text(distance, 60, y + 46, 30);
    text(time, 940, y + 46, 32, '#202c43', 'right');
  });
  text(data.note, 60, canvas.height - 50, 20, '#526079');
  text('itsrun.info/pace/marathon', 60, canvas.height - 20, 18, '#3f51b5');
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = data.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give browsers time to start reading the object URL before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
