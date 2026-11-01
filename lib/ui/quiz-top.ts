/** 「次の問題は上から」 (owner 2026/11/1): after moving to the next question, bring the quiz's top back into view, so
 * a phone does not stay scrolled down at the old explanation. The quiz root is the nearest section (or [data-quiz-top]). */
export function toQuizTop(from:EventTarget|null){
 const root=(from as Element|null)?.closest?.('[data-quiz-top],section');
 if(!root)return;
 requestAnimationFrame(()=>{if(root.getBoundingClientRect().top<0)root.scrollIntoView({behavior:'smooth',block:'start'});});
}
