/**
 * Specs Inc. 2026
 * TranslationJudge — grades whether a spoken transcript is a valid translation
 * of an English sentence into a target language. Used by the spell-casting
 * round controller to gate the throw mechanic on a correct answer.
 */
import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini";
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";

const TAG = "[TranslationJudge]";

export interface TranslationJudgment {
  correct: boolean;
  reason: string;
}

const SYSTEM_INSTRUCTION =
  `You are a fast, lenient language tutor grading a spoken translation in a real-time AR game. ` +
  `RESPOND AS QUICKLY AS POSSIBLE — players are waiting in real-time. ` +
  `You receive an English sentence, a target language, and a transcript of what the player said. ` +
  `The transcript comes from speech-to-text and may contain ASR errors: missing accent marks, ` +
  `homophone substitutions, missing punctuation, or minor spelling drift. Treat those as correct. ` +
  `Accept any semantically equivalent translation, including minor grammatical variations ` +
  `(e.g. simple present vs present continuous), reasonable synonyms, and regional dialect choices. ` +
  `Reject only if the meaning is wrong, the wrong language was spoken, or the transcript is empty/unrelated. ` +
  `Reply with ONLY a JSON object on a single line, no markdown, no code fences, no prose. ` +
  `Schema: {"correct": boolean, "reason": string}. ` +
  `If correct: keep "reason" SHORT (under 6 words), e.g. "Correct!" or "Nice!". ` +
  `If incorrect: "reason" MUST start with "Try: " followed by the correct translation in the target language ` +
  `(e.g. "Try: El gato está durmiendo"). This teaches the player the right answer without ` +
  `using the word "Correct" which would be ambiguous in the UI.`;

function buildContents(
  english: string,
  targetLanguage: string,
  transcript: string,
): GoogleGenAITypes.Common.Content[] {
  return [
    {
      parts: [
        {
          text:
            `English: "${english}"\n` +
            `Target: ${targetLanguage}\n` +
            `Player: "${transcript}"\n` +
            `Grade. JSON only.`,
        },
      ],
      role: "user",
    },
  ];
}

function parseJudgment(raw: string): TranslationJudgment | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = trimmed.substring(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    if (typeof obj.correct !== "boolean") return null;
    const reason = typeof obj.reason === "string" ? obj.reason : "";
    return { correct: obj.correct, reason };
  } catch (_) {
    return null;
  }
}

export class TranslationJudge {
  static grade(
    english: string,
    targetLanguage: string,
    transcript: string,
  ): Promise<TranslationJudgment> {
    if (english.trim().length === 0) {
      return Promise.resolve({ correct: false, reason: "No prompt given" });
    }
    if (transcript.trim().length === 0) {
      return Promise.resolve({ correct: false, reason: "Didn't catch that" });
    }

  const request: GoogleGenAITypes.Gemini.Models.GenerateContentRequest = {
    model: "gemini-2.0-flash",  // Fastest Gemini model with good quality
    type: "generateContent",
      body: {
        contents: buildContents(english, targetLanguage, transcript),
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          temperature: 0,         // Deterministic — fastest, most consistent
          maxOutputTokens: 120,   // Room for correct answer in reason field
          topP: 0.1,              // Constrain sampling for speed
        },
      },
    };

    return Gemini.models(request)
      .then((response) => {
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          print(`${TAG} Empty response from Gemini`);
          return { correct: false, reason: "Judge unavailable" };
        }
        const parsed = parseJudgment(text);
        if (!parsed) {
          print(`${TAG} Could not parse judgment: ${text}`);
          return { correct: false, reason: "Judge response malformed" };
        }
        print(
          `${TAG} ${parsed.correct ? "PASS" : "FAIL"} — "${transcript}" → ${parsed.reason}`,
        );
        return parsed;
      })
      .catch((error) => {
        print(`${TAG} Gemini request failed: ${error}`);
        return { correct: false, reason: "Network error" };
      });
  }
}
