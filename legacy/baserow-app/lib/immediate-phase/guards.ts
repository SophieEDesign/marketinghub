export function shouldApplyResolvedTableId(
  cancelled: boolean,
  resolutionSeq: number,
  currentSeq: number
) {
  return !cancelled && resolutionSeq === currentSeq
}

export async function mapInStableOrder<TInput, TOutput>(
  items: TInput[],
  worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  return Promise.all(items.map(worker))
}

export function attachScrollSyncListener(
  bodyEl: HTMLElement,
  onScroll: () => void
): () => void {
  bodyEl.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    bodyEl.removeEventListener('scroll', onScroll)
  }
}
