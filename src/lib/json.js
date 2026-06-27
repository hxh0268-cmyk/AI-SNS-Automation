/**
 * テキストから JSON を安全に抽出する
 * @param {string} text - 抽出元テキスト
 * @returns {unknown}
 */
export function extractJsonFromText(text) {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("JSONとして解析できませんでした。");
  }
}
