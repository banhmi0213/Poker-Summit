import {registrationSummary,type RegistrationSummary} from './registration';
export type RegistrationManagementStatus={policy:RegistrationSummary|null;enabled:boolean;finalization:{roomId:string;participants:number;assigned:boolean}|null};
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function managementStatus(value:unknown,tournamentId:string):RegistrationManagementStatus{
 const v=value as RegistrationManagementStatus;if(!v||typeof v!=='object'||!Object.hasOwn(v,'policy')||!Object.hasOwn(v,'finalization')||typeof v.enabled!=='boolean')throw Error('Invalid management status');
 const policy=v.policy===null?null:registrationSummary(v.policy);if(policy&&policy.tournamentId!==tournamentId.toLowerCase())throw Error('Policy mismatch');
 const f=v.finalization;if(f!==null&&(!f||!uuid.test(f.roomId)||!Number.isSafeInteger(f.participants)||f.participants<2||f.participants>200||typeof f.assigned!=='boolean'))throw Error('Invalid finalization status');
 return {policy,enabled:v.enabled,finalization:f?{roomId:f.roomId.toLowerCase(),participants:f.participants,assigned:f.assigned}:null};
}
