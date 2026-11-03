import 'server-only';
import daily from '@/data/poker-gto/daily-quiz.json';
import type {QuizQuestion} from './gto-quiz';

/** 今日のGTOクイズ (owner 2026/10/31): five questions per Japan-time day, fixed in advance by
 * scripts/poker-gto/daily-quiz.cjs so past days never change. */
const DAYS=(daily as {days:Record<string,QuizQuestion[]>}).days;
export const DAILY_COUNT=5;
/** Today's date in Japan (YYYY-MM-DD). */
export function todayJst(now=Date.now()){return new Date(now+9*3600e3).toISOString().slice(0,10);}
export function dailyQuestions(date:string):QuizQuestion[]|null{return DAYS[date]??null;}
/** Days before `date` that have questions, newest first. */
export function pastDays(date:string):string[]{return Object.keys(DAYS).filter(d=>d<date).sort((a,b)=>a<b?1:-1);}
