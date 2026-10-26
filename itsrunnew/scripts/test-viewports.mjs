export function selectViewports(viewports) {
  const selected = process.env.ITSRUN_TEST_VIEWPORT ?? 'all';
  if (!['all', 'desktop', 'mobile'].includes(selected)) throw new Error(`Invalid test viewport: ${selected}`);
  return viewports.filter(viewport => selected === 'all' || (viewport.width < 600 ? 'mobile' : 'desktop') === selected);
}
