import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request) {
  const {
    theme,
    hero,
    place,
    history = [],
    scene = 1,
    totalScenes = 4,
  } = await request.json();

  const safeHistory = Array.isArray(history) ? history : [history];
  const historyText = safeHistory.length > 0 ? safeHistory.join(" → ") : "без попередніх виборів";
  const isFinalScene = Number(scene) >= Number(totalScenes);

  const systemPrompt = `Ти оповідач дитячих інтерактивних казок українською мовою для дітей 6-8 років. Казка має бути теплою, доступною, барвистою й легкою для сприйняття.`;
  const userPrompt = isFinalScene
    ? `Тема: ${theme}. Герой: ${hero}. Місце: ${place}. Історія: ${historyText}. Це остання сцена (${scene} із ${totalScenes}). Підготуй коротку пораду для батька, щоб він допоміг дитині завершити казку. Відповідай тільки JSON у форматі {"scene": ${scene}, "parent_prompt": "..."}.`
    : `Тема: ${theme}. Герой: ${hero}. Місце: ${place}. Історія: ${historyText}. Це сцена ${scene} із ${totalScenes}. Напиши 3-5 речень казки українською, а потім запропонуй два варіанти вибору. Відповідай тільки JSON у форматі {"scene": ${scene}, "scene_text": "...", "choice_a": "...", "choice_b": "..."}.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      { role: "user", content: userPrompt },
    ],
  });

  const text = message.content[0].text;
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  const data = JSON.parse(clean);

  return Response.json(data);
}
