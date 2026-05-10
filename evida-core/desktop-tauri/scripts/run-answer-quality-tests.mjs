import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import ts from "typescript";

async function importTsModule(path) {
  const sourcePath = new URL(path, import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      strict: true
    }
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;
  return import(moduleUrl);
}

const { classifyUserQuestion } = await importTsModule("../src/lib/intentParser.ts");
const {
  createSafeFallbackStructuredAnswer,
  mainAnswerHasBlockedMetadata,
  structuredToDisplayAnswer,
  validateStructuredAnswer
} = await importTsModule("../src/lib/answerQuality.ts");

const fixtures = JSON.parse(
  await readFile(new URL("../../../docs/fixtures/ai_answer_golden_tests.json", import.meta.url), "utf8")
);
const allowedSourceIds = ["SRC-1", "SRC-2", "SRC-3"];

const answerByIntent = {
  case_content: {
    direct_answer: "Jeg kan ikke fastslå sikkert hvem som hadde kontroll, men kildene bør undersøkes gjennom beslutninger, økonomi og hvem som disponerte betalinger.",
    partner_assessment: "Kontrollspørsmålet bør vurderes praktisk, ikke bare formelt. Se etter beslutninger, fullmakter, betalinger og kommunikasjon.",
    reasoning_points: ["Kontroll kan ligge i handlinger selv om formelle roller sier noe annet.", "Grunnlaget er foreløpig og må kontrolleres mot kilder."],
    uncertainty: "Jeg kan ikke konkludere sikkert uten tydeligere kildegrunnlag.",
    next_best_step: "Start med å bygge kronologi over beslutninger og betalinger.",
    suggested_followups: ["Hvem disponerte betalingene?", "Hvilke personer går igjen i beslutningene?"]
  },
  recommendation: {
    direct_answer: "Jeg ville startet med dokumentgrunnlaget og kronologien før du går videre til vurdering eller utkast.",
    partner_assessment: "Det er tryggest å kontrollere hva som faktisk er kildeklart, fordi senere arbeid blir svakere hvis grunnlaget er ufullstendig.",
    reasoning_points: ["Første steg bør være kontroll av dekning.", "Deretter kan kronologi og bevismatrise bygges."],
    uncertainty: "Hvis dokumentgrunnlaget mangler sider, må arbeidet merkes som foreløpig.",
    next_best_step: "Se behandlingsstatus og bygg deretter kronologi.",
    suggested_followups: ["Se behandlingsstatus", "Bygg kronologi"]
  },
  process_status: {
    direct_answer: "Det gjenstår sider fordi dokumentbehandlingen ikke har gjort alle sider om til sporbare kildeutdrag ennå.",
    partner_assessment: "Dette er et prosess- og kildegrunnlagsspørsmål, ikke en vurdering av sakens innhold.",
    reasoning_points: ["Behandling og kildedekning er to forskjellige tall.", "Sider uten lesbar tekst kan ikke brukes som sikre kilder."],
    uncertainty: "Hvis teksthenting ikke er tilgjengelig, må manglende sider avklares manuelt.",
    next_best_step: "Åpne behandlingsstatus og se hvilke sider som mangler.",
    suggested_followups: ["Hvilke sider mangler?", "Jobber Evida fortsatt?"]
  },
  source_question: {
    direct_answer: "Dette bygger på de sporbare kildene som er koblet til svaret, ikke på dokumenttitler eller metadata.",
    partner_assessment: "Kildene bør åpnes separat slik at du kan kontrollere originalutdragene.",
    reasoning_points: ["Hovedsvaret holder metadata ute.", "Kilde-ID-er brukes til kontroll og åpning av kilder."],
    uncertainty: "Hvis kildene ikke dekker spørsmålet, må svaret behandles som foreløpig.",
    next_best_step: "Åpne kildedetaljene under svaret.",
    suggested_followups: ["Vis kilder", "Hva mangler i grunnlaget?"]
  },
  risk_assessment: {
    direct_answer: "Foreløpig kan jeg ikke si at saken er sterk nok til en sikker konklusjon uten mer kontroll av grunnlaget.",
    partner_assessment: "Styrken avhenger av om sentrale fakta støttes av lesbare kilder og om motstrid er avklart.",
    reasoning_points: ["Svake eller manglende kilder reduserer sikkerheten.", "Risiko må vurderes etter kronologi og bevismatrise."],
    uncertainty: "Vurderingen er foreløpig og må kontrolleres juridisk.",
    next_best_step: "Finn svakeste punkt i dokumentgrunnlaget før utkast.",
    suggested_followups: ["Hva er svakheten?", "Vurder risiko"]
  },
  timeline: {
    direct_answer: "Jeg kan ikke bekrefte at tidslinjen stemmer før datoer og forklaringer er sammenlignet punkt for punkt.",
    partner_assessment: "Tidslinjen bør bygges fra kilder og kontrolleres mot forklaringer for avvik.",
    reasoning_points: ["Datoer må kobles til kildeutdrag.", "Forklaringer må sjekkes mot dokumentasjon."],
    uncertainty: "Det kan finnes avvik som ikke er synlige før kronologien er bygget.",
    next_best_step: "Bygg kronologi og marker avvik.",
    suggested_followups: ["Bygg kronologi", "Finn avvik"]
  },
  contradiction: {
    direct_answer: "Jeg ville lett etter motstrid mellom forklaring og dokumentasjon før saken brukes til utkast.",
    partner_assessment: "Motstrid må knyttes til konkrete kilder og kontrolleres manuelt.",
    reasoning_points: ["Forklaringer kan avvike fra dokumenterte hendelser.", "Avvik bør grupperes etter tema og dato."],
    uncertainty: "Jeg kan ikke konkludere uten full kildekontroll.",
    next_best_step: "Se etter motstrid og dokumenter hvert avvik med kilde.",
    suggested_followups: ["Se etter motstrid", "Hvilke avvik finnes?"]
  }
};

for (const fixture of fixtures) {
  const expectedIntent = fixture.expectedIntent;
  assert.equal(classifyUserQuestion(fixture.question), expectedIntent, `${fixture.question} intent`);
  const base = answerByIntent[expectedIntent] || answerByIntent.case_content;
  const answer = {
    ...base,
    source_ids: ["SRC-1"],
    answer_quality: {
      answered_user_question: true,
      question_type: expectedIntent,
      confidence: "medium"
    }
  };
  const validation = validateStructuredAnswer({
    answer,
    allowedSourceIds,
    weakSourceBasis: true
  });
  assert.equal(validation.ok, true, `${fixture.question} validates: ${validation.reasons.join(", ")}`);
  const display = structuredToDisplayAnswer(answer);
  assert.equal(fixture.mustNotContain.some((pattern) => display.includes(pattern)), false, `${fixture.question} has no blocked metadata`);
  assert.equal(fixture.mustContainAny.some((term) => display.toLowerCase().includes(term.toLowerCase())), true, `${fixture.question} has expected terms`);
}

assert.equal(mainAnswerHasBlockedMetadata("ØKOKRIM - EVIDA STRESSTEST Bates OKO-0001"), true, "blocked metadata is detected");
assert.equal(
  validateStructuredAnswer({
    answer: {
      ...answerByIntent.case_content,
      direct_answer: "ØKOKRIM - EVIDA STRESSTEST Bates OKO-0001",
      source_ids: ["SRC-NOPE"],
      answer_quality: {
        answered_user_question: true,
        question_type: "case_content",
        confidence: "low"
      }
    },
    allowedSourceIds,
    weakSourceBasis: true
  }).ok,
  false,
  "invalid metadata answer is blocked"
);

const fallback = createSafeFallbackStructuredAnswer({
  intent: "case_content",
  allowedSourceIds,
  nextBestStep: "Åpne Kontrollstatus."
});
assert.equal(mainAnswerHasBlockedMetadata(structuredToDisplayAnswer(fallback)), false, "fallback is safe");

console.log(`answer quality tests passed (${fixtures.length + 3} assertions).`);
