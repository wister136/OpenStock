export function bindVisibleRangeSync(charts: any[]) {
  const list = charts.filter(Boolean);
  if (list.length < 2) return () => {};

  let syncing = false;
  const unsubs: Array<() => void> = [];

  for (const src of list) {
    const cb = (range: any) => {
      if (!range) return;
      if (syncing) return;
      syncing = true;
      for (const dst of list) {
        if (dst === src) continue;
        try {
          dst.timeScale().setVisibleRange(range);
        } catch {}
      }
      syncing = false;
    };

    try {
      src.timeScale().subscribeVisibleTimeRangeChange(cb);
      unsubs.push(() => src.timeScale().unsubscribeVisibleTimeRangeChange(cb));
    } catch {}
  }

  return () => unsubs.forEach((fn) => fn());
}
