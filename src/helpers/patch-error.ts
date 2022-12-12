interface PatchData {
  tags: string[];
}
export function patchDOMException(
  error: DOMException,
  patchData: PatchData
): Error {
  const res = new Error();
  const { tags } = patchData;
  res.message = `${tags.map((tag) => `[${tag}]`).join("")} ${error.message}`;
  return res;
}
