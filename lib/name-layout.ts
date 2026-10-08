// Preserve the registered name; expose word boundaries rather than cutting at a character count.
const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
const suffix = /^(?:店|本店|支店|号店|会|大会|駅|前|町|区|市|県|府|の|を|に|で|と|へ|は|が|も|や)$/;
const opening = /^[（(「『【\[＠@#＆&・\/／|｜]$/;
const closing = /^[）)」』】\]、。，,.!！?？:：;；]$/;

export function nameParts(name: string): string[] {
  const result: string[] = [];
  for (const { segment } of Array.from(segmenter.segment(name))) {
    const last = result.length - 1;
    const previous = (result[last] || "").replace(/^[（(「『【\[]+/, "");
    const sameKana = (/^[ぁ-ゖー]+$/.test(segment) && /^[ぁ-ゖー]+$/.test(previous)) ||
      (/^[ァ-ヶー]+$/.test(segment) && /^[ァ-ヶー]+$/.test(previous));
    if (last >= 0 && !/\s$/.test(result[last]) &&
      (suffix.test(segment) || closing.test(segment) || opening.test(result[last]) || sameKana)) {
      result[last] += segment;
    } else {
      result.push(segment);
    }
  }
  // Keep an opening bracket / @ / # attached to the following word.
  for (let i = result.length - 2; i >= 0; i--) {
    if (opening.test(result[i]) && !/^\s/.test(result[i + 1])) {
      result.splice(i, 2, result[i] + result[i + 1]);
    }
  }
  // Keep connected names such as トーナメント・イベント and Cafe&Bar together.
  for (let i = result.length - 1; i >= 1; i--) {
    if (/^[＆&・\/／|｜]/.test(result[i]) && !/\s/.test(result[i]) && !/\s$/.test(result[i-1])) {
      result.splice(i-1, 2, result[i-1] + result[i]);
    }
  }
  return result;
}

export const nameWidth = (text: string) => [...text].reduce((n, c) => n + (/[\x00-\x7f]/.test(c) ? 0.6 : 1), 0);

export function nameTitleLines(title: string, singleLineWidth = 12): string[] {
  const name = title.trim().replace(/\s+/g, " ");
  if (nameWidth(name) <= singleLineWidth) return [name];
  const parts = nameParts(name);
  const candidates: number[] = [];
  let offset = 0;
  for (const part of parts.slice(0, -1)) {
    offset += part.length;
    const left = name.slice(0, offset).trim(), right = name.slice(offset).trim();
    if (nameWidth(left) >= 3 && nameWidth(right) >= 3 && !/[（(「『【\[＠@#＆&・\/／|｜]$/.test(left)) candidates.push(offset);
  }
  if (!candidates.length) return [name];
  const score = (i: number) => Math.max(nameWidth(name.slice(0, i)), nameWidth(name.slice(i)));
  const split = candidates.reduce((best, i) => score(i) < score(best) ? i : best, candidates[0]);
  return [name.slice(0, split).trim(), name.slice(split).trim()];
}
