// Keep a coherent evaluated snapshot: never mix play and realisation from different rounds.
const TARGET = { BTN: .84, CO: .78, HJ: .70, UTG: .57 };
function bbPass(report) {
  return Object.entries(TARGET).every(([seat, target]) =>
    Number.isFinite(report?.defend?.[seat]) && Math.abs(report.defend[seat] - target) <= .04 + 1e-12);
}
function bestRound(rounds) {
  return rounds.filter(x => bbPass(x.report) && Number.isFinite(x.report.perHandDiff))
    .reduce((best, x) => !best || x.report.perHandDiff < best.report.perHandDiff ? x : best, null);
}
module.exports = { bbPass, bestRound };
